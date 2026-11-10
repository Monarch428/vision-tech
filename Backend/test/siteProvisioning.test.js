const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');
const tacticalService = require('../src/services/tacticalRmm.service');
const UserManagement = require('../src/models/user-management/User');
const { applyRmmSettings } = require('../src/utils/rmmSettings');
const SystemConfig = require('../src/models/system-config/SystemConfig');

let t;
let n = 0;
const register = (overrides = {}) => {
  n += 1;
  return t.request('POST', '/auth/register', {
    body: { name: `New Customer ${n}`, email: `new${n}@test.local`, password: 'Customer@123', deviceName: 'PC-1', serialNumber: `SN-${n}`, ...overrides },
  });
};
const siteOf = async (email) => (await UserManagement.findOne({ email }).lean())?.rmm?.siteId || null;

before(async () => {
  t = await startTestServer();
  // The "new user" admin email is on and SMTP isn't set up: sign-up must still work.
  await SystemConfig.updateOne({}, { $set: { 'notifications.newUserRegistration': true } });
});
after(async () => { await t.close(); });
beforeEach(() => {
  t.fake.calls.length = 0;
  applyRmmSettings({ clientId: 12, writableSiteIds: '*' }); // production setting
});

test('a customer who signs up gets their own RMM Site straight away', async () => {
  const res = await register();
  assert.equal(res.status, 201, res.body?.message);
  const siteId = await siteOf(`new${n}@test.local`);
  assert.ok(siteId, 'account is linked');
  assert.deepEqual(t.fake.calls.filter((c) => c[0] === 'createSite'), [['createSite', `New Customer ${n} <new${n}@test.local>`]]);

  // ...so Add New Device works with no staff step; only the plan limit is checked.
  const token = (await t.request('POST', '/auth/login', { body: { email: `new${n}@test.local`, password: 'Customer@123' } })).body.token;
  const installer = await t.request('POST', '/devices/generate-installer', { token, body: { plat: 'windows' } });
  assert.equal(installer.status, 200, installer.body?.message);
  assert.deepEqual(t.fake.calls.filter((c) => c[0] === 'generateInstaller'), [['generateInstaller', siteId]]);
});

test('accounts created by staff get a Site; staff accounts do not', async () => {
  const customer = await t.request('POST', '/v1/users', { token: t.tokens.admin, body: { name: 'Staff Made', email: 'staffmade@test.local', password: 'Customer@123', role: 'user' } });
  assert.equal(customer.status, 201, customer.body?.message);
  assert.ok(await siteOf('staffmade@test.local'));

  const admin = await t.request('POST', '/v1/users', { token: t.tokens.superadmin, body: { name: 'Another Admin', email: 'admin2@test.local', password: 'Admin@12345', role: 'admin' } });
  assert.equal(admin.status, 201, admin.body?.message);
  assert.equal(await siteOf('admin2@test.local'), null);
});

test('sign-up still works when Tactical RMM is down; the Site is created on Add New Device', async () => {
  const original = tacticalService.createSite;
  tacticalService.createSite = async () => { throw new Error('Tactical unreachable'); };
  try {
    assert.equal((await register()).status, 201);
  } finally {
    tacticalService.createSite = original;
  }
  const email = `new${n}@test.local`;
  assert.equal(await siteOf(email), null);

  const token = (await t.request('POST', '/auth/login', { body: { email, password: 'Customer@123' } })).body.token;
  assert.equal((await t.request('POST', '/devices/generate-installer', { token, body: {} })).status, 200);
  assert.ok(await siteOf(email));
});

test('without "*" (development) no Sites are created in Tactical RMM', async () => {
  applyRmmSettings({ clientId: 12, writableSiteIds: '73' });
  assert.equal((await register()).status, 201);
  assert.equal(await siteOf(`new${n}@test.local`), null);
  assert.equal(t.fake.calls.filter((c) => c[0] === 'createSite').length, 0);
});
