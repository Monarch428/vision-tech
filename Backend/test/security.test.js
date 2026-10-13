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
  for (const path of ['/system-logs', '/system-logs/stats', '/user-subscriptions/subscriptions']) {
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

test('only the support role may change system configuration, and the SMTP password is never returned', async () => {
  const cfg = await t.request('GET', '/system-config/me', { token: t.tokens.admin });
  assert.equal(cfg.status, 200);
  assert.equal(cfg.body.config.email.smtpPassword, '');
  assert.equal((await t.request('PUT', '/system-config', { token: t.tokens.admin, body: cfg.body.config })).status, 403);

  const withPassword = { ...cfg.body.config, email: { ...cfg.body.config.email, smtpPassword: 'secret' } };
  const saved = await t.request('PUT', '/system-config', { token: t.tokens.support, body: withPassword });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.config.email.smtpPassword, '');
  assert.equal(saved.body.config.email.smtpPasswordSet, true);
});
