const Company = require('../models/company/Company');
const CompanyMember = require('../models/company/CompanyMember');
const { paidEntitlement } = require('../middleware/companyAccess');
const User = require('../models/auth/User');

const defaultName = (user) => `${String(user.name || user.email || 'Customer').trim()} Company`;

// Payment/subscription handlers call this after a paid entitlement is created
// or restored. This intentionally allocates only our local tenant record; the
// provider scope still requires an explicit, verified administrator assignment.
const provisionPaidCompany = async (user) => {
  if (!user?._id || !await paidEntitlement(user._id)) return null;
  const company = await Company.findOneAndUpdate(
    { billingUser: user._id },
    { $setOnInsert: { name: defaultName(user) } },
    { upsert: true, new: true, runValidators: true },
  );
  await CompanyMember.updateOne(
    { user: user._id },
    { $setOnInsert: { company: company._id, role: 'owner' } },
    { upsert: true, runValidators: true },
  );
  return company;
};

// Legacy users retain their existing per-user agent mapping. Migration only
// creates a company/owner boundary; it never guesses or reassigns a shared RMM
// site, which could otherwise leak another tenant's devices.
const migrateLegacyCompanyAssignments = async ({ apply = false } = {}) => {
  const users = await User.find({ role: 'user', 'rmmAgentIds.0': { $exists: true } })
    .select('_id name email rmmAgentIds').lean();
  const eligible = [];
  for (const user of users) {
    if (await paidEntitlement(user._id)) eligible.push(user);
  }
  if (apply) {
    for (const user of eligible) await provisionPaidCompany(user);
  }
  return {
    dryRun: !apply,
    migrated: apply ? eligible.length : 0,
    candidates: eligible.map((user) => ({ userId: user._id, email: user.email, agentCount: user.rmmAgentIds.length })),
  };
};

module.exports = { provisionPaidCompany, migrateLegacyCompanyAssignments };
