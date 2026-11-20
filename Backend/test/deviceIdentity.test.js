const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');
const DeviceIdentityRequest = require('../src/models/device-identity/DeviceIdentityRequest');

let ctx;
before(async () => { ctx = await startTestServer(); });
after(async () => { await ctx.close(); });

test('device requests isolate read and write tokens and accept one result', async () => {
  const first = await ctx.request('POST', '/device-identity/requests', { body: { platform: 'windows', consent: true } });
  const second = await ctx.request('POST', '/device-identity/requests', { body: { platform: 'linux', consent: true } });
  assert.equal(first.status, 201); assert.equal(second.status, 201);
  assert.ok(first.body.readToken); assert.ok(first.body.helperUrl.includes('/helper?token='));
  assert.equal((await ctx.request('GET', `/device-identity/requests/${first.body.requestId}?token=${second.body.readToken}`)).status, 404);
  const writeToken = new URL(first.body.helperUrl).searchParams.get('token');
  const submitted = await ctx.request('POST', `/device-identity/requests/${first.body.requestId}/result?token=${writeToken}`, { body: { hostname: 'TEST-PC', serialNumber: 'SERIAL-1', platform: 'windows' } });
  assert.equal(submitted.status, 202);
  assert.equal((await ctx.request('POST', `/device-identity/requests/${first.body.requestId}/result?token=${writeToken}`, { body: { hostname: 'OTHER', serialNumber: '', platform: 'windows' } })).status, 409);
  const read = await ctx.request('GET', `/device-identity/requests/${first.body.requestId}?token=${first.body.readToken}`);
  assert.equal(read.status, 200); assert.deepEqual(read.body.result, { hostname: 'TEST-PC', serialNumber: 'SERIAL-1', platform: 'windows' });
});

test('device requests require consent and reject expired requests', async () => {
  assert.equal((await ctx.request('POST', '/device-identity/requests', { body: { platform: 'windows' } })).status, 400);
  const created = await ctx.request('POST', '/device-identity/requests', { body: { platform: 'darwin', consent: true } });
  await DeviceIdentityRequest.updateOne({ _id: created.body.requestId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await ctx.request('GET', `/device-identity/requests/${created.body.requestId}?token=${created.body.readToken}`)).status, 404);
});
