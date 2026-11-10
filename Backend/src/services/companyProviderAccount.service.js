const tacticalRmm = require('./tacticalRmm.service');
const gravityZone = require('../utils/gravityZoneClient');
const { isLegacyRmmClient } = require('../utils/rmmSettings');
const CompanyProviderAccount = require('../models/company/CompanyProviderAccount');
const UserManagement = require('../models/user-management/User');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const positiveId = (id) => Number.isSafeInteger(id) && id > 0;

const verifyProviderScope = async (provider, body) => {
  if (provider === 'tactical-rmm') {
    const { clientId, siteIds } = body;
    if (!positiveId(clientId) || !Array.isArray(siteIds) || !siteIds.length
      || siteIds.length > 100 || !siteIds.every(positiveId)) {
      throw httpError(400, 'Provide a numeric clientId and between 1 and 100 numeric siteIds');
    }
    if (isLegacyRmmClient(clientId)) {
      throw httpError(409, 'Use a dedicated Tactical RMM client for the company pilot');
    }
    const sites = await tacticalRmm.listSites(clientId);
    const allowed = new Set(sites.map((site) => Number(site.id)));
    if (!siteIds.every((id) => allowed.has(id))) {
      throw httpError(422, 'One or more sites do not belong to that Tactical RMM client');
    }
    if (await UserManagement.exists({ 'rmm.siteId': { $in: siteIds } })) {
      throw httpError(409, 'One or more sites are linked through legacy RMM. Use a separate pilot client and sites.');
    }
    return { externalId: String(clientId), siteIds: [...new Set(siteIds)] };
  }

  if (provider === 'bitdefender') {
    const { companyId } = body;
    if (typeof companyId !== 'string' || !/^[a-f\d]{24}$/i.test(companyId)) {
      throw httpError(400, 'Provide a valid GravityZone companyId');
    }
    const externalId = companyId.toLowerCase();
    const company = await gravityZone.call('companies', 'getCompanyDetails', { companyId: externalId });
    if (company?.id !== externalId || company.type !== 1
      || company.isSuspended !== false || company.canBeManagedByAbove !== true) {
      throw httpError(422, 'GravityZone company must be an active, managed customer');
    }
    return { externalId, siteIds: [] };
  }

  throw httpError(404, 'Provider not supported');
};

const assignProviderAccount = async ({ company, provider, body, assignedBy }) => {
  const scope = await verifyProviderScope(provider, body);
  // Only create or reverify the same scope in the pilot. Reassignment needs a
  // workflow that first checks devices and revokes the previous allocation.
  const siteIds = scope.siteIds.sort((a, b) => a - b);
  try {
    return await CompanyProviderAccount.findOneAndUpdate(
      { company, provider, externalId: scope.externalId, siteIds },
      { $set: { verifiedAt: new Date(), assignedBy }, $setOnInsert: { siteIds } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    ).lean();
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'This provider or scope already has a conflicting assignment');
    throw error;
  }
};

module.exports = { assignProviderAccount };
