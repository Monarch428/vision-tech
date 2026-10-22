const AntivirusScanUsage = require('../models/antivirus/AntivirusScanUsage');
const UserManagement = require('../models/user-management/User');
const { getScanLimit } = require('./planLimits');

// Monthly antivirus scan allowance per plan (Free 5, Pro 50, Enterprise
// unlimited). Every portal scan — Self-Help, RMM action, scheduled — reserves
// one before asking GravityZone; a scan that fails to start is released and
// not charged. Months are calendar months in UTC. Staff are never limited.

const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const nextMonthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

const getScanUsage = async (userId, now = new Date()) => {
  const user = await UserManagement.findById(userId).select('plan').lean();
  const limit = getScanLimit(user?.plan);
  const used = await AntivirusScanUsage.countDocuments({ user: userId, createdAt: { $gte: monthStart(now) } });
  return {
    plan: user?.plan || 'free',
    used,
    limit: limit === Infinity ? null : limit,
    remaining: limit === Infinity ? null : Math.max(0, limit - used),
    resetsAt: nextMonthStart(now),
  };
};

// Returns the usage record to pass to releaseScan if the scan doesn't start.
const reserveScan = async (userId, { source, endpointId = null }) => {
  const usage = await getScanUsage(userId);
  if (usage.limit !== null && usage.used >= usage.limit) {
    const resets = usage.resetsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    throw Object.assign(
      new Error(`Your ${usage.plan} plan includes ${usage.limit} antivirus scans a month and you have used them all. More scans are available on ${resets}, or upgrade your plan.`),
      { status: 403, code: 'SCAN_LIMIT_REACHED' }
    );
  }
  return AntivirusScanUsage.create({ user: userId, source, endpointId });
};

const releaseScan = async (record) => {
  if (record?._id) await AntivirusScanUsage.deleteOne({ _id: record._id });
};

module.exports = { getScanUsage, reserveScan, releaseScan };
