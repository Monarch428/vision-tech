const { isObjectIdOrHexString } = require('mongoose');
const User = require('../models/auth/User');
const Company = require('../models/company/Company');
const CompanyMember = require('../models/company/CompanyMember');
const Subscription = require('../models/subscription/Subscription');
const PLATFORM_ADMIN = 'admin';

const activeUser = (id) => {
  if (!isObjectIdOrHexString(id)) return null;
  return User.findOne({ _id: id, isActive: { $ne: false }, isVerified: { $ne: false } })
    .select('role').lean();
};

const paidEntitlement = async (billingUser, now = new Date()) => {
  const subscription = await Subscription.findOne({ user: billingUser }).sort({ createdAt: -1, _id: -1 })
    .select('amount status nextRenewalDate graceUntil').lean();
  if (!subscription || !(subscription.amount > 0)) return false;
  if (['active', 'cancelled'].includes(subscription.status) && subscription.nextRenewalDate > now) {
    return true;
  }
  return ['active', 'cancelled', 'expired'].includes(subscription.status) && subscription.graceUntil > now;
};

const requirePlatformAdmin = async (req, res, next) => {
  const user = await activeUser(req.user.id);
  if (user?.role !== PLATFORM_ADMIN) return res.status(403).json({ message: 'Platform administrator required' });
  next();
};

const requireCompanyMember = async (req, res, next) => {
  const user = await activeUser(req.user.id);
  if (user?.role !== 'user') return res.status(403).json({ message: 'Active customer account required' });

  const membership = await CompanyMember.findOne({ user: user._id }).lean();
  const company = membership && await Company.findById(membership.company).lean();
  if (!company) return res.status(404).json({ message: 'Company membership is not configured' });

  req.company = company;
  req.companyRole = membership.role === 'owner' ? 'admin' : membership.role;
  req.companyPaid = await paidEntitlement(company.billingUser);
  next();
};

const requirePaidCompanyMember = async (req, res, next) => {
  await requireCompanyMember(req, res, async () => {
    if (!req.companyPaid) return res.status(403).json({ message: 'A paid company entitlement is required' });
    next();
  });
};

module.exports = { activeUser, paidEntitlement, requirePlatformAdmin, requireCompanyMember, requirePaidCompanyMember };
