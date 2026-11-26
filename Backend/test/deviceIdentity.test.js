const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

test('six-character Windows callback code submits a result once', async () => {
  const created = await ctx.request('POST', '/device-identity/requests', { body: { platform: 'windows', consent: true } });
  const request = await DeviceIdentityRequest.findById(created.body.requestId).lean();
  assert.match(request.callbackCode, /^[A-Z0-9]{6}$/);
  const resultPath = `/device-identity/requests/callback/${request.callbackCode}/result`;
  assert.equal((await ctx.request('POST', resultPath, { body: { hostname: 'SHORT-CODE-PC', serialNumber: 'SERIAL-2', platform: 'windows' } })).status, 202);
  assert.equal((await ctx.request('POST', resultPath, { body: { hostname: 'OTHER-PC', serialNumber: '', platform: 'windows' } })).status, 409);
  const read = await ctx.request('GET', `/device-identity/requests/${created.body.requestId}?token=${created.body.readToken}`);
  assert.deepEqual(read.body.result, { hostname: 'SHORT-CODE-PC', serialNumber: 'SERIAL-2', platform: 'windows' });
});

test('Windows helper is a directly runnable EXE with a six-character one-time callback filename', async () => {
  const previousHelper = process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH;
  const helperPath = path.resolve(__dirname, '../../DesktopApps/windows/NVTDeviceInfo/bin/Release/net8.0-windows/win-x64/NVTDeviceInfo.exe');
  assert.ok(fs.existsSync(helperPath), 'Windows helper fixture must be built before this test runs');
  process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH = helperPath;
  try {
    const created = await ctx.request('POST', '/device-identity/requests', { body: { platform: 'windows', consent: true } });
    const helperUrl = new URL(created.body.helperUrl);
    const helper = await fetch(`${new URL(ctx.baseUrl).origin}${helperUrl.pathname}${helperUrl.search}`);
    assert.equal(helper.status, 200);
    assert.match(helper.headers.get('content-type') || '', /application\/(vnd\.microsoft\.portable-executable|x-msdos-program)/);
    assert.match(helper.headers.get('content-disposition') || '', /NVT-Device-Info--[A-Z0-9]{6}\.exe/);
    const executable = Buffer.from(await helper.arrayBuffer());
    assert.equal(executable.subarray(0, 2).toString('ascii'), 'MZ');
    assert.deepEqual(executable, fs.readFileSync(helperPath));
  } finally {
    if (previousHelper === undefined) delete process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH;
    else process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH = previousHelper;
  }
});
