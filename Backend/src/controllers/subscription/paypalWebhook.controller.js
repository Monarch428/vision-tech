const paypalUtil = require('../../utils/paypal');
const { fulfilPaypalCapture, recordPendingCapture, recordFailedCapture } = require('../../utils/paypalPayments');
const { recordExternalRefund } = require('../../utils/refunds');
const notifyStaff = require('../../utils/notifyStaff');
const systemLogger = require('../../utils/systemLogger');

// POST /api/payments/paypal/webhook — PayPal event notifications. Each event is
// verified with PayPal (verify-webhook-signature) before anything is acted on.
// Configure the webhook in the PayPal developer dashboard and set PAYPAL_WEBHOOK_ID.

const verifyWithPayPal = async (req) => {
  const result = await paypalUtil.client.execute({
    verb: 'POST',
    path: '/v1/notifications/verify-webhook-signature',
    headers: { 'Content-Type': 'application/json' },
    body: {
      auth_algo: req.get('paypal-auth-algo'),
      cert_url: req.get('paypal-cert-url'),
      transmission_id: req.get('paypal-transmission-id'),
      transmission_sig: req.get('paypal-transmission-sig'),
      transmission_time: req.get('paypal-transmission-time'),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: req.body,
    },
  });
  return result.result?.verification_status === 'SUCCESS';
};

// Refund / reversal resources link back to their capture ("up").
const captureIdFrom = (resource) => {
  const up = (resource.links || []).find((l) => l.rel === 'up' && /\/captures\//.test(l.href));
  return up ? up.href.split('/captures/')[1].split(/[/?]/)[0] : resource.id;
};

const handlePaypalWebhook = async (req, res) => {
  if (!process.env.PAYPAL_WEBHOOK_ID) return res.status(503).send('PayPal webhook id not configured');

  let verified = false;
  try {
    verified = await verifyWithPayPal(req);
  } catch (error) {
    // PayPal answers malformed/forged notifications with 400: treat as unverified.
    if (error.statusCode !== 400) return res.status(502).send('Could not verify with PayPal');
  }
  if (!verified) return res.status(400).send('PayPal webhook verification failed');

  const event = req.body;
  const resource = event.resource || {};
  try {
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await fulfilPaypalCapture(resource);
        break;
      case 'PAYMENT.CAPTURE.PENDING':
        await recordPendingCapture(resource);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
        await recordFailedCapture(resource.id, event.event_type);
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        await recordExternalRefund({ transactionId: captureIdFrom(resource), refundReference: resource.id, reason: 'Refunded in PayPal' });
        break;
      case 'PAYMENT.CAPTURE.REVERSED':
        await recordExternalRefund({ transactionId: captureIdFrom(resource), refundReference: resource.id, reason: 'Payment reversed by PayPal (chargeback)' });
        break;
      case 'CUSTOMER.DISPUTE.CREATED':
        await systemLogger({
          type: 'error', action: 'PAYPAL_DISPUTE_CREATED', module: 'payments',
          details: `PayPal dispute ${resource.dispute_id}: ${resource.reason} — $${resource.dispute_amount?.value}`,
        });
        await notifyStaff({
          subject: 'PayPal dispute opened',
          html: `<p>A PayPal dispute was opened (${resource.reason}) for $${resource.dispute_amount?.value}.</p><p>Respond in the PayPal Resolution Center.</p>`,
        });
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (error) {
    await systemLogger({
      type: 'error', action: 'PAYPAL_WEBHOOK_ERROR', module: 'payments',
      details: `${event.event_type} ${event.id}: ${error.message}`,
    });
    // 4xx = permanent problem with this event (don't retry); 5xx = let PayPal retry.
    res.status(error.status && error.status < 500 ? 200 : 500).json({ received: true, error: error.message });
  }
};

module.exports = { handlePaypalWebhook };
