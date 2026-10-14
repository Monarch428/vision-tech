const Payment = require('../models/subscription/Payment');
const Plan = require('../models/subscription/Plan');
const UserManagement = require('../models/user-management/User');
const { activatePlan } = require('./planActivation');
const { claim, release } = require('./paymentClaims');
const { getStripe } = require('./stripe');
const { paypal, client: paypalClient } = require('./paypal');
const { sendRefundNotice } = require('./paymentNotifications');
const systemLogger = require('./systemLogger');

// Full refunds for PayPal and Stripe payments. Policy: a refunded payment
// moves the customer to the Free plan, unless they have paid again since.
const httpError = (status, message) => Object.assign(new Error(message), { status });

const refundAtGateway = async (payment) => {
  if (payment.paymentMethod === 'stripe') {
    const refund = await getStripe().refunds.create({
      payment_intent: payment.transactionId,
      reason: 'requested_by_customer',
      metadata: { paymentId: String(payment._id), invoice: payment.invoiceNumber || '' },
    });
    return refund.id;
  }
  if (payment.paymentMethod === 'paypal') {
    const request = new paypal.payments.CapturesRefundRequest(payment.transactionId);
    request.requestBody({}); // empty body = full refund
    const response = await paypalClient.execute(request);
    return response.result.id;
  }
  throw httpError(400, 'Only PayPal and Stripe payments can be refunded from the portal.');
};

// Moves the customer to Free if this was their latest successful payment.
const downgradeIfCurrent = async (payment) => {
  const newer = await Payment.exists({
    user: payment.user, status: 'success', _id: { $ne: payment._id }, paidAt: { $gte: payment.paidAt },
  });
  if (newer) return false;
  const free = await Plan.findOne({ name: 'free' });
  await activatePlan({ userId: payment.user, plan: free });
  // Device limits are re-checked by the RMM sync (newest extra devices get flagged).
  return true;
};

const markRefunded = async (payment, { refundReference, actorId = null, reason = null }) => {
  Object.assign(payment, {
    status: 'refunded',
    refundedAt: new Date(),
    refundReference,
    refundedBy: actorId,
    refundReason: reason,
  });
  await payment.save();
  const downgraded = await downgradeIfCurrent(payment);
  sendRefundNotice(payment); // best effort
  return downgraded;
};

// Refund requested by staff in the portal: refunds at the gateway, then records it.
const refundPayment = async ({ paymentId, actor, reason }) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw httpError(404, 'Payment not found');
  if (payment.status === 'refunded') throw httpError(409, 'This payment has already been refunded.');
  if (payment.status !== 'success' || !payment.transactionId) {
    throw httpError(400, 'Only completed gateway payments can be refunded.');
  }

  const key = `refund:${payment._id}`;
  if (!(await claim(key, payment.user))) throw httpError(409, 'A refund for this payment is already in progress or done.');

  let refundReference;
  try {
    refundReference = await refundAtGateway(payment);
  } catch (error) {
    await release(key);
    await systemLogger({
      type: 'error', action: 'PAYMENT_REFUND_FAILED', user: actor.id, userEmail: actor.email,
      details: `${payment.invoiceNumber} (${payment.paymentMethod}): ${error.message}`, module: 'payments',
    });
    throw httpError(error.status || 502, `The ${payment.paymentMethod} refund failed: ${error.message}`);
  }

  const downgraded = await markRefunded(payment, { refundReference, actorId: actor.id, reason });
  const customer = await UserManagement.findById(payment.user).select('email').lean();
  await systemLogger({
    type: 'warning', action: 'PAYMENT_REFUNDED', user: actor.id, userEmail: actor.email,
    details: `Refunded ${payment.invoiceNumber} ($${payment.amount}, ${payment.paymentMethod}) for ${customer?.email}`
      + `${reason ? ` — reason: ${reason}` : ''}${downgraded ? '; moved to Free' : ''}`,
    module: 'payments',
  });
  return { payment, downgraded };
};

// Refund made outside the portal (e.g. in the Stripe Dashboard, or a lost
// dispute where the bank took the money back), reported by webhook.
const recordExternalRefund = async ({ transactionId, refundReference, reason = 'Refunded in the payment provider dashboard' }) => {
  const payment = await Payment.findOne({ transactionId });
  if (!payment || payment.status === 'refunded') return null;
  if (!(await claim(`refund:${payment._id}`, payment.user))) return null;

  const downgraded = await markRefunded(payment, { refundReference, reason });
  await systemLogger({
    type: 'warning', action: 'PAYMENT_REFUNDED_EXTERNALLY', user: payment.user,
    details: `${payment.invoiceNumber} ($${payment.amount}, ${payment.paymentMethod}) refunded outside the portal${downgraded ? '; moved to Free' : ''}`,
    module: 'payments',
  });
  return payment;
};

module.exports = { refundPayment, recordExternalRefund };
