const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { startTestServer } = require('./helpers');

let t;
let users;
before(async () => {
  t = await startTestServer();
  users = mongoose.connection.collection('users');
});
after(async () => { await t.close(); });

const EMAIL = 'user@test.local';
const plantCode = async (code = '123456') =>
  users.updateOne({ email: EMAIL }, { $set: { otpCode: await bcrypt.hash(code, 4), otpExpiry: new Date(Date.now() + 600000), otpAttempts: 0 } });
const verify = (otp) => t.request('POST', '/auth/verify-otp', { body: { email: EMAIL, otp } });

test('unknown emails get the same reply as real ones', async () => {
  const res = await t.request('POST', '/auth/resend-otp', { body: { email: 'nobody@test.local' } });
  assert.equal(res.status, 200);
});

test('a code is voided after 5 wrong guesses', async () => {
  await plantCode();
  for (let i = 0; i < 4; i += 1) assert.equal((await verify('000000')).status, 400);
  assert.equal((await verify('000000')).status, 429);
  assert.equal((await verify('123456')).status, 400);
});

test('a correct code logs in', async () => {
  await plantCode();
  const res = await verify('123456');
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test('code login respects maintenance mode', async () => {
  const configs = mongoose.connection.collection('systemconfigs');
  await configs.updateOne({}, { $set: { 'general.maintenanceMode': true } });
  await plantCode();
  assert.equal((await verify('123456')).status, 503);
  await configs.updateOne({}, { $set: { 'general.maintenanceMode': false } });
});

test('deactivated accounts cannot log in; pending sign-ups are activated by their code', async () => {
  await users.updateOne({ email: EMAIL }, { $set: { isActive: false, deletedAt: new Date() } });
  await plantCode();
  assert.equal((await verify('123456')).status, 403);
  assert.equal((await t.request('POST', '/auth/login', { body: { email: EMAIL, password: 'User@12345' } })).status, 403);

  await users.updateOne({ email: EMAIL }, { $set: { isActive: false, deletedAt: null } });
  await plantCode();
  assert.equal((await verify('123456')).status, 200);
  assert.equal((await users.findOne({ email: EMAIL })).isActive, true);
});

test('password reset links work once and respect the minimum length', async () => {
  const plantReset = async () => {
    const token = crypto.randomBytes(32).toString('hex');
    await users.updateOne({ email: EMAIL }, {
      $set: { resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'), resetPasswordExpiry: new Date(Date.now() + 3600000) },
    });
    return token;
  };
  const token = await plantReset();
  assert.equal((await t.request('POST', '/auth/reset-password', { body: { token, password: 'short' } })).status, 400);
  assert.equal((await t.request('POST', '/auth/reset-password', { body: { token, password: 'Changed@12345' } })).status, 200);
  assert.equal((await t.request('POST', '/auth/reset-password', { body: { token, password: 'Changed@12345' } })).status, 400);
  assert.equal((await t.request('POST', '/auth/login', { body: { email: EMAIL, password: 'Changed@12345' } })).status, 200);

  const restore = await plantReset();
  await t.request('POST', '/auth/reset-password', { body: { token: restore, password: 'User@12345' } });
});

test('refresh issues a new token and requires a valid one', async () => {
  assert.equal((await t.request('POST', '/auth/refresh-token')).status, 401);
  await new Promise((r) => setTimeout(r, 1100));
  const res = await t.request('POST', '/auth/refresh-token', { token: t.tokens.user });
  assert.equal(res.status, 200);
  assert.notEqual(res.body.token, t.tokens.user);
});
