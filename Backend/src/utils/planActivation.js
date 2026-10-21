const Subscription = require('../models/subscription/Subscription');
const Payment = require('../models/subscription/Payment');
const UserManagement = require('../models/user-management/User');

const nextSubId = async () => {
  const lastSub = await Subscription.findOne({ sub_id: { $regex: /^SUB-\d+$/ } })
    .sort({ createdAt: -1 });
  const lastNumber = lastSub ? parseInt(lastSub.sub_id.split('-')[1], 10) : 0;
  return `SUB-${String(lastNumber + 1).padStart(3, '0')}`;
};

const nextInvoiceNumber = async () => {
  const paymentCount = await Payment.countDocuments();
  return `INV-${String(paymentCount + 1).padStart(3, '0')}`;
};

// Activates `plan` for `userId` after a verified payment (or a staff change when
// no payment is passed). Keeps the subscription and the user's `plan` field in
// sync, because device limits read the latter.
const activatePlan = async ({ userId, plan, payment }) => {
  const now = new Date();

  let subscription = await Subscription.findOne({ user: userId }).sort({ createdAt: -1 });
  if (!subscription) {
    subscription = new Subscription({ sub_id: await nextSubId(), user: userId, startDate: now });
  }

  // Renewing the same paid plan early extends from its current end date, so
  // the customer doesn't lose the days they already paid for.
  const isEarlyRenewal = String(subscription.plan) === String(plan._id)
    && subscription.status === 'active'
    && subscription.nextRenewalDate > now;
  const nextRenewalDate = new Date(isEarlyRenewal ? subscription.nextRenewalDate : now);
  if (plan.price === 0) {
    nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 100);
  } else {
    nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
  }

  Object.assign(subscription, {
    plan: plan._id,
    amount: plan.price,
    status: 'active',
    nextRenewalDate,
    cancelledAt: null,
    pausedAt: null,
    renewalReminderSent: false,
    graceUntil: null,
  });
  await subscription.save();

  await UserManagement.updateOne({ _id: userId }, { $set: { plan: plan.name } });

  let paymentRecord = null;
  if (payment?.pendingRecordId) {
    // A payment the gateway held as pending has now completed: finish that record.
    paymentRecord = await Payment.findByIdAndUpdate(
      payment.pendingRecordId,
      {
        $set: {
          subscription: subscription._id,
          invoiceNumber: await nextInvoiceNumber(),
          amount: payment.amount,
          status: 'success',
          planName: plan.name,
          paidAt: now,
        },
      },
      { returnDocument: 'after' }
    );
  } else if (payment) {
    paymentRecord = await Payment.create({
      user: userId,
      subscription: subscription._id,
      invoiceNumber: await nextInvoiceNumber(),
      amount: payment.amount,
      status: 'success',
      paymentMethod: payment.method,
      transactionId: payment.transactionId,
      planName: plan.name,
      paidAt: now,
    });
  }

  return { subscription, payment: paymentRecord };
};

module.exports = { activatePlan, nextSubId };
