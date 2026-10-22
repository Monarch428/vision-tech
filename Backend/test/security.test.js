const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });

test('staff-only endpoints refuse customers', async () => {
  const staffOnly = [
    ['GET', '/v1/users'], ['GET', '/system-logs'], ['GET', '/payments'], ['GET', '/user-subscriptions'],
    ['GET', '/user-subscriptions/subscriptions'], ['GET', '/support-requests/all'], ['GET', '/antivirus-schedules/all'],
    ['GET', '/data-management/files'], ['GET', '/self-help/backups'], ['GET', '/system-config/me'],
    ['GET', '/devices/console'], ['GET', '/devices/audit'], ['GET', '/devices/sites'],
  ];
  for (const [method, path] of staffOnly) {
    const res = await t.request(method, path, { token: t.tokens.user });
    assert.equal(res.status, 403, `${method} ${path}`);
  }
  assert.equal((await t.request('GET', '/v1/users', { token: t.tokens.admin })).status, 200);
});

test('previously public endpoints now need a login', async () => {
  for (const path of ['/system-logs', '/system-logs/stats', '/user-subscriptions/subscriptions', '/file-backups']) {
    assert.equal((await t.request('GET', path)).status, 401, path);
  }
});

test('customers cannot promote themselves or edit others', async () => {
  await t.request('PUT', `/v1/users/${t.ids.user}`, { token: t.tokens.user, body: { role: 'admin', plan: 'enterprise' } });
  const me = await t.request('GET', `/v1/users/${t.ids.user}`, { token: t.tokens.user });
  assert.equal(me.body.data.role, 'user');
  assert.equal(me.body.data.plan, 'free');
  assert.equal((await t.request('PUT', `/v1/users/${t.ids.admin}`, { token: t.tokens.user, body: { name: 'x' } })).status, 403);
  assert.equal((await t.request('GET', `/v1/users/${t.ids.admin}`, { token: t.tokens.user })).status, 403);
});

test('device limit applies to profile edits', async () => {
  const res = await t.request('PUT', `/v1/users/${t.ids.user}`, {
    token: t.tokens.user, body: { deviceNames: ['A', 'B'], serialNumbers: ['1', '2'] },
  });
  assert.equal(res.status, 400);
});

test('changing your password requires the current one', async () => {
  const noCurrent = await t.request('PUT', `/v1/users/${t.ids.user}`, { token: t.tokens.user, body: { password: 'NewPass@123' } });
  assert.equal(noCurrent.status, 400);
  const wrong = await t.request('PUT', `/v1/users/${t.ids.user}`, { token: t.tokens.user, body: { password: 'NewPass@123', currentPassword: 'wrong' } });
  assert.equal(wrong.status, 400);
});

test('plans can only change through a verified payment', async () => {
  const sub = (await t.request('GET', '/user-subscriptions/my', { token: t.tokens.user })).body.data;
  assert.equal((await t.request('PUT', `/user-subscriptions/${sub._id}`, { token: t.tokens.user, body: { planName: 'enterprise' } })).status, 403);
  assert.equal((await t.request('POST', '/user-subscriptions', { token: t.tokens.user, body: { user: t.ids.user, planName: 'pro' } })).status, 403);
  assert.equal((await t.request('POST', '/payments', { token: t.tokens.user, body: { subscription: sub._id, amount: 1 } })).status, 403);
  assert.equal((await t.request('POST', '/payments/paypal/create-order', { token: t.tokens.user, body: { planName: 'free' } })).status, 400);
});

test('only the Super Admin may change system configuration, and the SMTP password is never returned', async () => {
  const cfg = await t.request('GET', '/system-config/me', { token: t.tokens.admin });
  assert.equal(cfg.status, 200);
  assert.equal(cfg.body.config.email.smtpPassword, '');
  assert.equal((await t.request('PUT', '/system-config', { token: t.tokens.admin, body: cfg.body.config })).status, 403);

  const withPassword = { ...cfg.body.config, email: { ...cfg.body.config.email, smtpPassword: 'secret' } };
  const saved = await t.request('PUT', '/system-config', { token: t.tokens.superadmin, body: withPassword });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.config.email.smtpPassword, '');
  assert.equal(saved.body.config.email.smtpPasswordSet, true);
});

test('role rename: old "support" accounts and tokens become Super Admin; still only one allowed', async () => {
  const mongoose = require('mongoose');
  const jwt = require('jsonwebtoken');
  const migrateLegacyRoles = require('../src/utils/migrateLegacyRoles');
  const users = mongoose.connection.collection('users');

  // An account stored with the old role name is migrated.
  await users.updateOne({ _id: new mongoose.Types.ObjectId(t.ids.superadmin) }, { $set: { role: 'support' } });
  assert.equal(await migrateLegacyRoles(), 1);
  assert.equal((await users.findOne({ _id: new mongoose.Types.ObjectId(t.ids.superadmin) })).role, 'superadmin');
  assert.equal(await migrateLegacyRoles(), 0); // safe to run again

  // A token issued before the rename keeps Super Admin access.
  const oldToken = jwt.sign({ id: t.ids.superadmin, email: 'superadmin@test.local', role: 'support' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const cfg = await t.request('GET', '/system-config/me', { token: oldToken });
  assert.equal(cfg.status, 200);
  assert.equal((await t.request('PUT', '/system-config', { token: oldToken, body: cfg.body.config })).status, 200);

  // Still only one Super Admin.
  await assert.rejects(users.updateOne({ _id: new mongoose.Types.ObjectId(t.ids.admin) }, { $set: { role: 'superadmin' } }), /duplicate key/);
  const res = await t.request('PUT', `/v1/users/${t.ids.admin}`, { token: t.tokens.superadmin, body: { role: 'superadmin' } });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Only one Super Admin/);
});
