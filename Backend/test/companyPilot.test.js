const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Types } = require('mongoose');
const tacticalRmm = require('../src/services/tacticalRmm.service');
const gravityZone = require('../src/utils/gravityZoneClient');
const User = require('../src/models/auth/User');
const UserManagement = require('../src/models/user-management/User');
const Subscription = require('../src/models/subscription/Subscription');
const CompanyProviderAccount = require('../src/models/company/CompanyProviderAccount');
const { assignProviderAccount } = require('../src/services/companyProviderAccount.service');
const { paidEntitlement, requirePlatformAdmin } = require('../src/middleware/companyAccess');

const company = new Types.ObjectId();
const assignedBy = new Types.ObjectId();
const input = (provider, body) => ({ company, assignedBy, provider, body });

test('Tactical RMM assignment rejects sites outside the selected client', async (t) => {
  t.mock.method(tacticalRmm, 'listSites', async () => [{ id: 73 }]);
  const save = t.mock.method(CompanyProviderAccount, 'findOneAndUpdate');
  await assert.rejects(
    assignProviderAccount(input('tactical-rmm', { clientId: 9123, siteIds: [74] })),
    { status: 422 },
  );
  assert.equal(save.mock.callCount(), 0);
});

test('Tactical RMM verifies the site set and refuses a legacy-linked site', async (t) => {
  t.mock.method(tacticalRmm, 'listSites', async () => [{ id: 73 }, { id: 74 }]);
  const legacy = t.mock.method(UserManagement, 'exists', async () => ({ _id: assignedBy }));
  const save = t.mock.method(CompanyProviderAccount, 'findOneAndUpdate', (filter) => ({
    lean: async () => filter,
  }));
  const request = input('tactical-rmm', { clientId: 9123, siteIds: [74, 73, 74] });
  await assert.rejects(assignProviderAccount(request), { status: 409 });
  assert.equal(save.mock.callCount(), 0);
  legacy.mock.mockImplementation(async () => null);
  const result = await assignProviderAccount(request);
  assert.deepEqual(result.siteIds, [73, 74]);
  assert.equal(result.externalId, '9123');
  assert.equal(result.company, company);
});

test('Bitdefender requires the exact managed, active customer company', async (t) => {
  const companyId = '0123456789abcdef01234567';
  const rpc = t.mock.method(gravityZone, 'call', async () => ({
    id: companyId, type: 0, isSuspended: false, canBeManagedByAbove: true,
  }));
  const save = t.mock.method(CompanyProviderAccount, 'findOneAndUpdate', (filter) => ({
    lean: async () => filter,
  }));
  const request = input('bitdefender', { companyId });
  await assert.rejects(assignProviderAccount(request), { status: 422 });
  assert.equal(save.mock.callCount(), 0);
  rpc.mock.mockImplementation(async () => ({
    id: companyId, type: 1, isSuspended: false, canBeManagedByAbove: true,
  }));
  assert.equal((await assignProviderAccount(request)).externalId, companyId);
  assert.deepEqual(rpc.mock.calls[1].arguments, ['companies', 'getCompanyDetails', { companyId }]);
});

test('provider assignment conflicts return 409', async (t) => {
  t.mock.method(tacticalRmm, 'listSites', async () => [{ id: 73 }]);
  t.mock.method(UserManagement, 'exists', async () => null);
  t.mock.method(CompanyProviderAccount, 'findOneAndUpdate', () => ({
    lean: async () => { throw Object.assign(new Error('Duplicate key'), { code: 11000 }); },
  }));
  await assert.rejects(
    assignProviderAccount(input('tactical-rmm', { clientId: 9123, siteIds: [73] })),
    { status: 409 },
  );
});

test('paid entitlement respects end date, grace, and free and paused plans', async (t) => {
  const now = new Date('2026-11-11');
  const subscription = { amount: 20, status: 'cancelled', nextRenewalDate: new Date('2026-11-12') };
  t.mock.method(Subscription, 'findOne', () => ({
    sort: () => ({ select: () => ({ lean: async () => subscription }) }),
  }));
  assert.equal(await paidEntitlement(assignedBy, now), true);
  subscription.nextRenewalDate = now;
  assert.equal(await paidEntitlement(assignedBy, now), false);
  subscription.status = 'expired';
  subscription.graceUntil = new Date('2026-11-13');
  assert.equal(await paidEntitlement(assignedBy, now), true);
  subscription.status = 'paused';
  assert.equal(await paidEntitlement(assignedBy, now), false);
  subscription.status = 'active';
  subscription.amount = 0;
  assert.equal(await paidEntitlement(assignedBy, now), false);
});

test('a stale platform administrator token cannot grant assignment access', async (t) => {
  t.mock.method(User, 'findOne', () => ({
    select: () => ({ lean: async () => ({ role: 'user' }) }),
  }));
  const response = {
    status(code) { assert.equal(code, 403); return this; },
    json() {},
  };
  await requirePlatformAdmin({ user: { id: assignedBy, role: 'superadmin' } }, response, () => {
    assert.fail('Stale role granted access');
  });
});
