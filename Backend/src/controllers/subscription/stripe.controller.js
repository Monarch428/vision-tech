const Plan = require('../../models/subscription/Plan');
const Subscription = require('../../models/subscription/Subscription');
const { claim, release } = require('../../utils/paymentClaims');
const { sendReceipt } = require('../../utils/paymentNotifications');
const UserManagement = require('../../models/user-management/User');
const { activatePlan } = require('../../utils/planActivation');
const { getStripe, toCents } = require('../../utils/stripe');
const systemLogger = require('../../utils/systemLogger');
const notifyStaff = require('../../utils/notifyStaff');
const { recordExternalRefund } = require('../../utils/refunds');

// Stripe Checkout (one payment per plan period, like PayPal). The price comes
// from the Plan collection; a plan is activated only for a Checkout Session that
// Stripe itself reports as paid, either when the customer returns (confirm) or
// via the signed webhook. Whichever arrives first fulfils it; the other is a no-op.

const httpError = (status, message) => Object.assign(new Error(message), { status });

const subscriptionShape = (sub) => ({
  _id: sub._id,
  sub_id: sub.sub_id,
  user: sub.user,
  planName: sub.plan?.name,
  status: sub.status,
  startDate: sub.startDate,
  endDate: sub.cancelledAt || null,
  nextRenewalDate: sub.nextRenewalDate,
  amount: sub.amount,
  graceUntil: sub.graceUntil || null,
});

const currentSubscription = async (userId) => {
  const sub = await Subscription.findOne({ user: userId }).sort({ createdAt: -1 }).populate('plan', 'name price');
  return sub ? subscriptionShape(sub) : null;
};

// Verifies a Checkout Session and activates its plan exactly once.
const fulfilCheckoutSession = async (session, { expectedUserId } = {}) => {
  const userId = session.metadata?.userId || session.client_reference_id;
  const planName = session.metadata?.planName;

  if (expectedUserId && String(userId) !== String(expectedUserId)) {
    throw httpError(403, 'This payment belongs to a different user.');
  }
  if (session.status !== 'complete' || session.payment_status !== 'paid') {
    throw httpError(402, `Payment not completed (status: ${session.payment_status}).`);
  }

  const plan = await Plan.findOne({ name: planName });
  if (!plan || plan.price <= 0) throw httpError(400, `Unknown plan "${planName}".`);
  if (session.currency !== 'usd' || session.amount_total < toCents(plan.price)) {
    throw httpError(400, `Paid amount ${session.amount_total} ${session.currency} does not match plan ${planName}.`);
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  const key = `stripe:${paymentIntentId || session.id}`;

  if (!(await claim(key, userId))) {
    return { alreadyProcessed: true, subscription: await currentSubscription(userId) };
  }

  try {
    const { payment } = await activatePlan({
      userId,
      plan,
      payment: { amount: session.amount_total / 100, method: 'stripe', transactionId: paymentIntentId || session.id },
    });
    await systemLogger({
      type: 'success', action: 'STRIPE_PAYMENT_FULFILLED', user: userId,
      details: `Stripe checkout ${session.id} paid — ${plan.name} activated, invoice ${payment.invoiceNumber}`,
      module: 'payments',
    });
    sendReceipt(payment); // best effort, not awaited
    return { alreadyProcessed: false, subscription: await currentSubscription(userId), payment };
  } catch (error) {
    await release(key); // let a retry (webhook or confirm) try again
    throw error;
  }
};

// POST /api/payments/stripe/checkout { planName } → { url }
const createCheckoutSession = async (req, res) => {
  try {
    const planName = String(req.body.planName || '').toLowerCase();
    const plan = await Plan.findOne({ name: planName });
    if (!plan || plan.price <= 0) return res.status(400).json({ message: 'Choose a valid paid plan' });

    // FRONTEND_URL in production; otherwise the (CORS-allowlisted) origin of this request.
    const appUrl = (process.env.FRONTEND_URL || req.get('origin') || '').replace(/\/$/, '');
    if (!appUrl) return res.status(500).json({ message: 'FRONTEND_URL is not configured' });

    const user = await UserManagement.findById(req.user.id).select('email').lean();
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: String(req.user.id),
      customer_email: user?.email,
      metadata: { userId: String(req.user.id), planName: plan.name },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: toCents(plan.price),
          product_data: { name: `Vision Tech ${plan.name} plan`, description: `One ${plan.billingCycle} period` },
        },
      }],
      success_url: `${appUrl}/user/billingsubscriptions?stripe_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/user/billingsubscriptions?stripe_cancelled=1`,
    });

    await systemLogger({
      type: 'info', action: 'STRIPE_CHECKOUT_CREATED', user: req.user?._id, userEmail: req.user?.email,
      details: `Stripe checkout ${session.id} — ${plan.name} $${plan.price}`, module: 'payments', ipAddress: req.ip,
    });
    res.json({ url: session.url });
  } catch (error) {
    await systemLogger({
      type: 'error', action: 'STRIPE_CHECKOUT_ERROR', user: req.user?._id, userEmail: req.user?.email,
      details: error.message, module: 'payments', ipAddress: req.ip,
    });
    res.status(error.status || 500).json({ message: 'Could not start card payment', error: error.message });
  }
};

// POST /api/payments/stripe/confirm { sessionId } — called when the customer
// returns from Stripe; the server asks Stripe for the session's real status.
const confirmCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId || !/^cs_/.test(sessionId)) return res.status(400).json({ message: 'sessionId is required' });

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const result = await fulfilCheckoutSession(session, { expectedUserId: req.user.id });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || error.statusCode || 500).json({ message: error.message });
  }
};

// POST /api/payments/stripe/webhook — raw body; authenticated by Stripe's signature.
const handleWebhook = async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).send('Stripe webhook secret not configured');

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
  } catch (error) {
    return res.status(400).send(`Webhook signature verification failed: ${error.message}`);
  }

  try {
    const object = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (object.payment_status === 'paid') await fulfilCheckoutSession(object);
        break;
      case 'charge.refunded':
        // Full refunds made in the Stripe Dashboard (portal refunds are already recorded).
        if (object.refunded && object.payment_intent) {
          // Newer API versions don't embed refunds in the charge; look the latest one up.
          const refundReference = object.refunds?.data?.[0]?.id
            || (await getStripe().refunds.list({ payment_intent: object.payment_intent, limit: 1 })).data[0]?.id
            || null;
          await recordExternalRefund({ transactionId: object.payment_intent, refundReference });
        }
        break;
      case 'charge.dispute.created':
        await systemLogger({
          type: 'error', action: 'STRIPE_DISPUTE_CREATED', module: 'payments',
          details: `Dispute ${object.id} on ${object.payment_intent}: $${(object.amount / 100).toFixed(2)} (${object.reason})`,
        });
        await notifyStaff({
          subject: 'Stripe dispute opened',
          html: `<p>A customer opened a dispute (${object.reason}) for $${(object.amount / 100).toFixed(2)}.</p>
            <p>Payment: ${object.payment_intent}. Respond in the Stripe Dashboard before the deadline.</p>`,
        });
        break;
      case 'charge.dispute.closed':
        // Lost: the bank returned the money to the customer, so treat it like a refund.
        if (object.status === 'lost') {
          await recordExternalRefund({
            transactionId: object.payment_intent, refundReference: object.id, reason: `Dispute lost (${object.reason})`,
          });
        }
        await systemLogger({
          type: object.status === 'lost' ? 'error' : 'success', action: 'STRIPE_DISPUTE_CLOSED', module: 'payments',
          details: `Dispute ${object.id} on ${object.payment_intent} closed: ${object.status}`,
        });
        await notifyStaff({
          subject: `Stripe dispute ${object.status}`,
          html: `<p>The dispute on payment ${object.payment_intent} ($${(object.amount / 100).toFixed(2)}) was closed: <strong>${object.status}</strong>.</p>
            ${object.status === 'lost' ? '<p>The payment is marked refunded and the customer moved to the Free plan.</p>' : ''}`,
        });
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await systemLogger({
          type: 'info', action: event.type === 'checkout.session.expired' ? 'STRIPE_CHECKOUT_EXPIRED' : 'STRIPE_PAYMENT_FAILED',
          user: object.metadata?.userId || null, module: 'payments',
          details: `Stripe checkout ${object.id} (${object.metadata?.planName || 'plan'}) ${event.type.split('.').pop().replace(/_/g, ' ')}`,
        });
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (error) {
    await systemLogger({
      type: 'error', action: 'STRIPE_WEBHOOK_ERROR', details: `${event.type} ${event.id}: ${error.message}`, module: 'payments',
    });
    // 4xx = permanent problem with this event (don't retry); 5xx = let Stripe retry.
    res.status(error.status && error.status < 500 ? 200 : 500).json({ received: true, error: error.message });
  }
};

module.exports = { createCheckoutSession, confirmCheckoutSession, handleWebhook, fulfilCheckoutSession };
