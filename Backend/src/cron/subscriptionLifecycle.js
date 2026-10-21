const cron = require('node-cron');
const Subscription = require('../models/subscription/Subscription');
const Plan = require('../models/subscription/Plan');
const UserManagement = require('../models/user-management/User');
const { activatePlan } = require('../utils/planActivation');
const { describeLimit } = require('../utils/planLimits');
const { enforceDeviceLimit } = require('./rmmDeviceSync');
const sendEmail = require('../utils/sendEmail');
const systemLogger = require('../utils/systemLogger');

// Policy B1: when a paid plan's period ends without renewal (expired, or
// cancelled and the paid period is over), service continues for a 7-day grace
// period with a warning email; after that the account drops to the Free plan.
// Devices above the Free limit are flagged for staff, never uninstalled.
const GRACE_DAYS = 7;

const emailCustomer = async (userId, subject, html) => {
  const user = await UserManagement.findById(userId).select('email').lean();
  if (!user?.email) return;
  try {
    await sendEmail({ to: user.email, subject, html });
  } catch (error) {
    await systemLogger({
      type: 'warning', action: 'SUBSCRIPTION_EMAIL_FAILED', user: userId, userEmail: user.email,
      details: `${subject}: ${error.message}`, module: 'subscriptions',
    });
  }
};

const runSubscriptionLifecycle = async (now = new Date()) => {
  const paidPlanIds = (await Plan.find({ price: { $gt: 0 } }).select('_id').lean()).map((p) => p._id);
  const freePlan = await Plan.findOne({ name: 'free' });
  const result = { startedGrace: 0, downgraded: 0 };

  // 1. Paid period over → start the grace period.
  const ended = await Subscription.find({
    plan: { $in: paidPlanIds },
    status: { $in: ['active', 'cancelled'] },
    nextRenewalDate: { $lt: now },
    graceUntil: null,
  }).populate('plan', 'name');

  for (const sub of ended) {
    const graceUntil = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
    sub.status = 'expired';
    sub.graceUntil = graceUntil;
    await sub.save();
    result.startedGrace += 1;

    await systemLogger({
      type: 'warning', action: 'SUBSCRIPTION_GRACE_STARTED', user: sub.user,
      details: `${sub.sub_id} (${sub.plan?.name}) ended; grace period until ${graceUntil.toISOString()}`,
      module: 'subscriptions',
    });
    await emailCustomer(sub.user, 'Your Vision Tech plan has ended',
      `<p>Your <strong>${sub.plan?.name}</strong> plan has ended. Your devices stay monitored until
       <strong>${graceUntil.toDateString()}</strong>.</p>
       <p>Renew before then to keep your current plan. Otherwise your account moves to the Free plan
       (${describeLimit('free')}).</p>`);
  }

  // 2. Grace period over → move to the Free plan and re-check device limits.
  const graceOver = await Subscription.find({
    plan: { $in: paidPlanIds },
    status: 'expired',
    graceUntil: { $ne: null, $lt: now },
  }).populate('plan', 'name');

  for (const sub of graceOver) {
    if (!freePlan) break;
    const previousPlan = sub.plan?.name;
    await activatePlan({ userId: sub.user, plan: freePlan });
    result.downgraded += 1;

    await systemLogger({
      type: 'warning', action: 'SUBSCRIPTION_DOWNGRADED_TO_FREE', user: sub.user,
      details: `${sub.sub_id} moved from ${previousPlan} to free after the grace period`,
      module: 'subscriptions',
    });
    await emailCustomer(sub.user, 'Your Vision Tech account is now on the Free plan',
      `<p>Your grace period has ended and your account is now on the Free plan (${describeLimit('free')}).</p>
       <p>Devices above that limit are no longer covered. Upgrade any time from Billing.</p>`);

    const user = await UserManagement.findById(sub.user).select('name email plan rmm').lean();
    if (user?.rmm?.siteId) await enforceDeviceLimit(user);
  }

  return result;
};

const startSubscriptionLifecycle = () => {
  cron.schedule('30 0 * * *', () => {
    runSubscriptionLifecycle().catch((error) =>
      systemLogger({ type: 'error', action: 'SUBSCRIPTION_LIFECYCLE_ERROR', details: error.message, module: 'subscriptions' })
    );
  });
};

module.exports = { startSubscriptionLifecycle, runSubscriptionLifecycle, GRACE_DAYS };
