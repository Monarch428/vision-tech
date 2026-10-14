const Payment = require('../models/subscription/Payment');
const Plan = require('../models/subscription/Plan');
const Subscription = require('../models/subscription/Subscription');
const { activatePlan } = require('./planActivation');
const { claim, release } = require('./paymentClaims');
const { sendReceipt } = require('./paymentNotifications');
const systemLogger = require('./systemLogger');

// PayPal capture outcomes, shared by the capture request and the webhook.
// A capture can be COMPLETED (activate), PENDING (record, activate later when
// PayPal completes it) or DECLINED/FAILED (record as failed).
const httpError = (status, message) => Object.assign(new Error(message), { status });

// Orders carry custom_id "<userId>:<planName>" (set when the order was created).
const parseCustomId = (customId) => {
  const [userId, planName] = String(customId || '').split(':');
  return { userId, planName };
};

const verifyAmount = async (planName, amount) => {
  const plan = await Plan.findOne({ name: planName });
  const paid = Number(amount?.value);
  if (!plan || plan.price <= 0 || amount?.currency_code !== 'USD' || paid < plan.price) {
    throw httpError(400, `Captured amount ${amount?.value} ${amount?.currency_code} does not match plan ${planName}`);
  }
  return { plan, paid };
};

// COMPLETED capture → activate the plan exactly once.
const fulfilPaypalCapture = async (capture, { expectedUserId } = {}) => {
  const { userId, planName } = parseCustomId(capture.custom_id);
  if (expectedUserId && String(userId) !== String(expectedUserId)) throw httpError(403, 'This order belongs to a different user');
  const { plan, paid } = await verifyAmount(planName, capture.amount);

  const key = `paypal:${capture.id}`;
  if (!(await claim(key, userId))) return { alreadyProcessed: true, userId };

  try {
    const pending = await Payment.findOne({ transactionId: capture.id, status: 'pending' }).select('_id').lean();
    const { subscription, payment } = await activatePlan({
      userId,
      plan,
      payment: { amount: paid, method: 'paypal', transactionId: capture.id, pendingRecordId: pending?._id },
    });
    await systemLogger({
      type: 'success', action: 'PAYPAL_PAYMENT_FULFILLED', user: userId, module: 'payments',
      details: `PayPal capture ${capture.id}${pending ? ' (was pending)' : ''} — ${plan.name} activated, invoice ${payment.invoiceNumber}`,
    });
    sendReceipt(payment);
    return { alreadyProcessed: false, userId, subscription, payment };
  } catch (error) {
    await release(key);
    throw error;
  }
};

// PENDING capture → keep a record so the webhook can complete it later.
const recordPendingCapture = async (capture) => {
  const { userId, planName } = parseCustomId(capture.custom_id);
  if (await Payment.exists({ transactionId: capture.id })) return null;
  const { paid } = await verifyAmount(planName, capture.amount);
  const subscription = await Subscription.findOne({ user: userId }).sort({ createdAt: -1 }).select('_id').lean();
  const payment = await Payment.create({
    user: userId, subscription: subscription?._id, amount: paid, status: 'pending',
    paymentMethod: 'paypal', transactionId: capture.id, planName,
  });
  await systemLogger({
    type: 'warning', action: 'PAYPAL_PAYMENT_PENDING', user: userId, module: 'payments',
    details: `PayPal capture ${capture.id} pending (${capture.status_details?.reason || 'under review'}) — ${planName} activates when PayPal completes it`,
  });
  return payment;
};

// DECLINED / FAILED capture (immediately, or later for a pending one).
const recordFailedCapture = async (captureId, reason) => {
  const payment = await Payment.findOneAndUpdate(
    { transactionId: captureId, status: 'pending' },
    { $set: { status: 'failed' } },
    { returnDocument: 'after' }
  );
  await systemLogger({
    type: 'error', action: 'PAYPAL_PAYMENT_FAILED', user: payment?.user || null, module: 'payments',
    details: `PayPal capture ${captureId} failed: ${reason}`,
  });
  return payment;
};

module.exports = { fulfilPaypalCapture, recordPendingCapture, recordFailedCapture, parseCustomId };
