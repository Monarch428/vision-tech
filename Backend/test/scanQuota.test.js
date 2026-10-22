const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');
const gz = require('../src/utils/gravityZoneClient');
const AntivirusScanUsage = require('../src/models/antivirus/AntivirusScanUsage');
const RmmAction = require('../src/models/rmm/RmmAction');
const Plan = require('../src/models/subscription/Plan');
const { activatePlan } = require('../src/utils/planActivation');
const { syncRmmDevices } = require('../src/cron/rmmDeviceSync');

let t;
const scan = (token = t.tokens.user) =>
  t.request('POST', '/self-help/bitdefender/scan-endpoint', { token, body: { endpointId: 'gz-A-TEST-WIN' } });
const usage = async () => (await t.request('GET', '/self-help/scan-usage', { token: t.tokens.user })).body.usage;
const fillMonth = (count) =>
  AntivirusScanUsage.insertMany(Array.from({ length: count }, () => ({ user: t.ids.user, source: 'self-help' })));

before(async () => {
  t = await startTestServer();
  await syncRmmDevices({ force: true });
  await t.request('PUT', '/devices/sites/link', { token: t.tokens.admin, body: { userId: t.ids.user, siteId: t.TEST_SITE } });
});
after(async () => { await t.close(); });
beforeEach(async () => {
  await AntivirusScanUsage.deleteMany({});
  await RmmAction.deleteMany({});
  t.fake.calls.length = 0;
});

test('a Free customer gets 5 portal scans a month, then is told why scans stop', async () => {
  for (let i = 0; i < 5; i += 1) assert.equal((await scan()).status, 200);
  const refused = await scan();
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'SCAN_LIMIT_REACHED');
  assert.match(refused.body.message, /free plan includes 5 antivirus scans a month/);
  assert.equal(t.fake.calls.filter((c) => c[0] === 'createScanTask').length, 5, 'the 6th scan never reached Bitdefender');

  const u = await usage();
  assert.deepEqual({ plan: u.plan, used: u.used, limit: u.limit, remaining: u.remaining }, { plan: 'free', used: 5, limit: 5, remaining: 0 });
});

test('the RMM antivirus action counts against the same allowance', async () => {
  await fillMonth(4);
  const action = () => t.request('POST', '/devices/A-TEST-WIN/actions/antivirus-scan', { token: t.tokens.user, body: { confirm: true } });
  assert.equal((await action()).status, 200);
  assert.equal((await usage()).used, 5);
  await RmmAction.deleteMany({}); // skip the per-device cooldown
  const refused = await action();
  assert.equal(refused.status, 403);
  assert.match(refused.body.message, /used them all/);
});

test('a scan that fails to start is not counted', async () => {
  const original = gz.createScanTask;
  gz.createScanTask = async () => { throw new Error('GravityZone unavailable'); };
  try {
    assert.equal((await scan()).status, 500);
  } finally {
    gz.createScanTask = original;
  }
  assert.equal((await usage()).used, 0);
});

test('last month\'s scans do not count, and the allowance follows the plan', async () => {
  const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15));
  await AntivirusScanUsage.collection.insertMany(Array.from({ length: 5 }, () => ({ user: AntivirusScanUsage.castObject({ user: t.ids.user }).user, source: 'self-help', createdAt: lastMonth })));
  assert.equal((await usage()).used, 0);
  assert.equal((await scan()).status, 200);

  await activatePlan({ userId: t.ids.user, plan: await Plan.findOne({ name: 'pro' }) });
  assert.equal((await usage()).limit, 50);
  await activatePlan({ userId: t.ids.user, plan: await Plan.findOne({ name: 'enterprise' }) });
  const unlimited = await usage();
  assert.equal(unlimited.limit, null);
  await fillMonth(60);
  assert.equal((await scan()).status, 200);
  await activatePlan({ userId: t.ids.user, plan: await Plan.findOne({ name: 'free' }) });
});

test('staff scans are never limited or counted', async () => {
  await fillMonth(5);
  assert.equal((await scan(t.tokens.admin)).status, 200);
  assert.equal(await AntivirusScanUsage.countDocuments({ user: t.ids.admin }), 0);
});
