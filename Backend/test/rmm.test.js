const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startTestServer } = require('./helpers');
const { syncRmmDevices, enforceDeviceLimit } = require('../src/cron/rmmDeviceSync');
const { evaluateDeviceAlerts } = require('../src/utils/rmmAlerts');
const { runSubscriptionLifecycle } = require('../src/cron/subscriptionLifecycle');
const RmmDevice = require('../src/models/rmm/RmmDevice');
const RmmAlert = require('../src/models/rmm/RmmAlert');
const RmmAction = require('../src/models/rmm/RmmAction');
const Subscription = require('../src/models/subscription/Subscription');
const Plan = require('../src/models/subscription/Plan');
const UserManagement = require('../src/models/user-management/User');
const { activatePlan } = require('../src/utils/planActivation');

let t;
const link = (siteId) => t.request('PUT', '/devices/sites/link', { token: t.tokens.admin, body: { userId: t.ids.user, siteId } });
const unlink = () => t.request('DELETE', `/devices/sites/link/${t.ids.user}`, { token: t.tokens.admin });

before(async () => {
  t = await startTestServer();
  await syncRmmDevices({ force: true });
});
after(async () => { await t.close(); });
beforeEach(async () => {
  t.fake.calls.length = 0;
  await RmmAction.deleteMany({});
  await unlink();
  // Linking, unlinking and removals start a background sync; wait for it so it
  // can't change the records a test is working with.
  await syncRmmDevices();
});

test('unlinked customers see no devices and cannot create installers', async () => {
  const list = await t.request('GET', '/devices', { token: t.tokens.user });
  assert.equal(list.body.linked, false);
  assert.equal(list.body.devices.length, 0);
  assert.equal((await t.request('POST', '/devices/generate-installer', { token: t.tokens.user, body: {} })).status, 409);
});

test('linking scopes devices to the customer Site; one Site per account', async () => {
  assert.equal((await t.request('PUT', '/devices/sites/link', { token: t.tokens.user, body: { userId: t.ids.user, siteId: t.TEST_SITE } })).status, 403);
  assert.equal((await link(t.TEST_SITE)).status, 200);
  const list = await t.request('GET', '/devices', { token: t.tokens.user });
  assert.deepEqual(list.body.devices.map((d) => d.hostname), ['TEST-PC']);
  const second = await t.request('PUT', '/devices/sites/link', { token: t.tokens.admin, body: { userId: t.ids.superadmin, siteId: t.TEST_SITE } });
  assert.equal(second.status, 409);
  assert.equal((await t.request('GET', '/devices/A-OTHER-WIN', { token: t.tokens.user })).status, 404);
});

test('installers always use the customer Site, even if the browser sends another', async () => {
  await UserManagement.updateOne({ _id: t.ids.user }, { $set: { plan: 'pro' } });
  await link(t.TEST_SITE);
  const res = await t.request('POST', '/devices/generate-installer', { token: t.tokens.user, body: { siteId: t.OTHER_SITE, clientId: 1 } });
  assert.equal(res.status, 200);
  assert.deepEqual(t.fake.calls, [['generateInstaller', t.TEST_SITE]]);
  await UserManagement.updateOne({ _id: t.ids.user }, { $set: { plan: 'free' } });
});

test('customers at their plan limit cannot create installers', async () => {
  await link(t.TEST_SITE); // Free plan: 1 device, Test Site already has 1
  const res = await t.request('POST', '/devices/generate-installer', { token: t.tokens.user, body: {} });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'DEVICE_LIMIT_REACHED');
});

test('the write safety lock blocks changes on Sites outside the allow-list', async () => {
  assert.equal((await t.request('POST', '/devices/generate-installer', { token: t.tokens.admin, body: { siteId: t.OTHER_SITE } })).status, 403);
  assert.equal((await t.request('DELETE', '/devices/A-OTHER-WIN', { token: t.tokens.admin })).status, 403);
  assert.equal((await t.request('POST', '/devices/A-OTHER-WIN/actions/restart', { token: t.tokens.admin, body: { confirm: true } })).status, 403);
  assert.deepEqual(t.fake.calls, []);
});

test('customers can only act on their own devices', async () => {
  await link(t.TEST_SITE);
  assert.equal((await t.request('DELETE', '/devices/A-OTHER-WIN', { token: t.tokens.user })).status, 404);
  assert.equal((await t.request('POST', '/devices/A-OTHER-WIN/actions/restart', { token: t.tokens.user, body: { confirm: true } })).status, 404);
  assert.deepEqual(t.fake.calls, []);
});

test('remote actions: confirmation, script, cooldown and audit', async () => {
  await link(t.TEST_SITE);
  const path = '/devices/A-TEST-WIN/actions/restart';
  assert.equal((await t.request('POST', path, { token: t.tokens.user, body: {} })).status, 400);
  assert.equal((await t.request('POST', path, { token: t.tokens.user, body: { confirm: true } })).status, 200);
  assert.deepEqual(t.fake.calls, [['runScript', 'A-TEST-WIN', 81, ['-Wait 60']]]);
  assert.equal((await t.request('POST', path, { token: t.tokens.user, body: { confirm: true } })).status, 429);
  assert.equal(await RmmAction.countDocuments({ agentId: 'A-TEST-WIN', status: 'sent' }), 1);
  assert.equal((await t.request('POST', '/devices/A-TEST-WIN/actions/format-disk', { token: t.tokens.user, body: { confirm: true } })).status, 400);
});

test('device details never expose software uninstall commands', async () => {
  await link(t.TEST_SITE);
  const res = await t.request('GET', '/devices/A-TEST-WIN/details', { token: t.tokens.user });
  assert.equal(res.status, 200);
  assert.equal(JSON.stringify(res.body.software).includes('uninstall'), false);
  assert.equal(res.body.remoteDesktopUrl, null); // staff only
  const staff = await t.request('GET', '/devices/A-TEST-WIN/details', { token: t.tokens.admin });
  assert.match(staff.body.remoteDesktopUrl, /\/takecontrol\/A-TEST-WIN$/);
});

test('removing a device uninstalls it (allowed Site, owner)', async () => {
  await link(t.TEST_SITE);
  assert.equal((await t.request('DELETE', '/devices/A-TEST-WIN', { token: t.tokens.user })).status, 200);
  assert.deepEqual(t.fake.calls, [['uninstallAgent', 'A-TEST-WIN']]);
});

test('devices beyond the plan limit are flagged, newest first', async () => {
  const day = 86400000;
  await RmmDevice.insertMany([0, 1, 2].map((i) => ({
    agentId: `FAKE-${i}`, siteId: t.TEST_SITE, user: t.ids.user, hostname: `fake-${i}`, firstSeenAt: new Date(Date.now() - (3 - i) * day),
  })));
  const user = await UserManagement.findById(t.ids.user).lean();
  await enforceDeviceLimit({ ...user, plan: 'free' });
  const flags = await RmmDevice.find({ agentId: /^FAKE-/ }).sort({ firstSeenAt: 1 }).lean();
  assert.deepEqual(flags.map((d) => d.overLimit), [false, true, true]);
  await RmmDevice.deleteMany({ agentId: /^FAKE-/ });
});

test('alerts: silent baseline, then new problems, then auto-resolve', async () => {
  const device = await RmmDevice.create({
    agentId: 'ALERT-1', siteId: t.TEST_SITE, user: t.ids.user, hostname: 'alert-pc', status: 'online', lastSeen: new Date(),
    metricsUpdatedAt: new Date(), checks: [{ checkId: 1, checkType: 'diskspace', title: 'Disk', status: 'failing', severity: 'warning' }],
  });
  assert.equal((await evaluateDeviceAlerts(device, { checksKnown: true })).length, 0);
  device.alertsInitializedAt = new Date();
  device.checks.push({ checkId: 2, checkType: 'memory', title: 'Memory', status: 'failing', severity: 'error' });
  assert.equal((await evaluateDeviceAlerts(device, { checksKnown: true })).length, 1);
  device.checks = [];
  await evaluateDeviceAlerts(device, { checksKnown: false });
  assert.equal(await RmmAlert.countDocuments({ agentId: 'ALERT-1', status: 'open' }), 2);
  await evaluateDeviceAlerts(device, { checksKnown: true });
  assert.equal(await RmmAlert.countDocuments({ agentId: 'ALERT-1', status: 'open' }), 0);
  await RmmDevice.deleteOne({ agentId: 'ALERT-1' });
});

test('an ended paid plan gets a 7-day grace period, then moves to Free', async () => {
  const day = 86400000;
  await activatePlan({ userId: t.ids.user, plan: await Plan.findOne({ name: 'pro' }) });
  await Subscription.updateOne({ user: t.ids.user }, { $set: { nextRenewalDate: new Date(Date.now() - day) } });
  await runSubscriptionLifecycle();
  let sub = await Subscription.findOne({ user: t.ids.user }).lean();
  assert.equal(sub.status, 'expired');
  assert.equal(Math.round((sub.graceUntil - Date.now()) / day), 7);
  assert.equal((await UserManagement.findById(t.ids.user).lean()).plan, 'pro');

  await Subscription.updateOne({ user: t.ids.user }, { $set: { graceUntil: new Date(Date.now() - 1000) } });
  await runSubscriptionLifecycle();
  sub = await Subscription.findOne({ user: t.ids.user }).populate('plan').lean();
  assert.equal(sub.plan.name, 'free');
  assert.equal((await UserManagement.findById(t.ids.user).lean()).plan, 'free');
  assert.ok(mongoose.connection.readyState === 1);
});

test('a removal refused by Tactical (missing permission) shows a friendly message and changes nothing', async () => {
  await link(t.TEST_SITE);
  const tacticalService = require('../src/services/tacticalRmm.service');
  const original = tacticalService.uninstallAgent;
  tacticalService.uninstallAgent = async () => {
    throw Object.assign(new Error('[tacticalRmm] DELETE failed: HTTP 403'), { response: { status: 403 } });
  };
  const res = await t.request('DELETE', '/devices/A-TEST-WIN', { token: t.tokens.user });
  tacticalService.uninstallAgent = original;
  assert.equal(res.status, 503);
  assert.match(res.body.message, /contact support/i);
  assert.equal((await RmmDevice.findOne({ agentId: 'A-TEST-WIN' }).lean()).removedAt, null);
});
