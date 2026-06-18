const SupportBooking = require('../models/support/SupportBooking');

/**
 * Returns support usage stats for a user in the current billing cycle.
 * @param {ObjectId|string} userId
 * @param {Object} subscription  - populated Subscription doc (plan must be populated)
 * @returns {{ usedMinutes, allowedMinutes, remainingMinutes, isEnterprise }}
 */
const getSupportUsage = async (userId, subscription) => {
  const planName = subscription.plan?.name?.toLowerCase() || '';
  const isEnterprise = planName === 'enterprise';

  let allowedMinutes;
  switch (planName) {
    case 'free':       allowedMinutes = 60;       break;
    case 'pro':        allowedMinutes = 600;       break;
    case 'enterprise': allowedMinutes = Infinity;  break;
    default:           allowedMinutes = 0;
  }

  const cycleStart =
    subscription.currentPeriodStart ||
    subscription.startDate ||
    new Date(0);

  const bookings = await SupportBooking.find({
    user: userId,
    createdAt: { $gte: cycleStart },
  });

  const usedMinutes = bookings.reduce(
    (total, b) => total + Number(b.duration || 0),
    0
  );

  const remainingMinutes = isEnterprise
    ? 'Unlimited'
    : Math.max(0, allowedMinutes - usedMinutes);

  return {
    usedMinutes,
    allowedMinutes: isEnterprise ? 'Unlimited' : allowedMinutes,
    remainingMinutes,
    isEnterprise,
  };
};

module.exports = { getSupportUsage };