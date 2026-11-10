process.env.RMM_SCRIPT_FILE_BACKUP_ID = '95';
process.env.BACKEND_PUBLIC_URL = 'https://api.example.test';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');
const storage = require('../src/utils/backupStorage');
const { Readable } = require('stream');
const FileBackup = require('../src/models/backup/FileBackup');
const FileBackupSchedule = require('../src/models/backup/FileBackupSchedule');
const { expireStaleBackups, runScheduledBackups } = require('../src/utils/fileBackups');
const { syncRmmDevices } = require('../src/cron/rmmDeviceSync');

// In-memory Cloudinary.
const stored = new Map();
Object.assign(storage, {
  putPart: async (publicId, buffer) => { stored.set(publicId, Buffer.from(buffer)); },
  getPartStream: async (publicId) => Readable.from([stored.get(publicId)]),
  deletePrefix: async (prefix) => { for (const key of [...stored.keys()]) if (key.startsWith(prefix)) stored.delete(key); },
});

let t;
const start = (body, token = t.tokens.user) => t.request('POST', '/file-backups', { token, body });
const lastToken = () => {
  const call = t.fake.calls.filter((c) => c[0] === 'runScript').pop();
  return call[3].find((a) => a.startsWith('-Token ')).slice(7);
};
const putPart = (token, index, bytes) => fetch(`${t.baseUrl}/file-backups/agent/parts/${index}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/octet-stream', ...(token ? { 'X-Backup-Token': token } : {}) },
  body: Buffer.from(bytes),
});
const report = (token, body) => fetch(`${t.baseUrl}/file-backups/agent/status`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Backup-Token': token }, body: JSON.stringify(body),
});
const completeBackup = async (parts = ['hello ', 'world']) => {
  const res = await start({ agentId: 'A-TEST-WIN', folders: ['Documents'] });
  assert.equal(res.status, 201, res.body?.message);
  const token = lastToken();
  for (const [i, p] of parts.entries()) assert.equal((await putPart(token, i, p)).status, 200);
  assert.equal((await report(token, { status: 'completed', parts: parts.length, fileCount: 3, skippedCount: 0 })).status, 200);
  return res.body.backup.id;
};

before(async () => {
  t = await startTestServer();
  await syncRmmDevices({ force: true });
  await t.request('PUT', '/devices/sites/link', { token: t.tokens.admin, body: { userId: t.ids.user, siteId: t.TEST_SITE } });
});
after(async () => { await t.close(); });
beforeEach(async () => {
  t.fake.calls.length = 0;
  stored.clear();
  await FileBackup.deleteMany({});
  await FileBackupSchedule.deleteMany({});
});

test('customers can only back up their own Windows devices, with known folders', async () => {
  assert.equal((await start({ agentId: 'A-OTHER-WIN', folders: ['Documents'] })).status, 404);
  assert.equal((await start({ agentId: 'A-TEST-WIN', folders: ['Windows'] })).status, 400);
  assert.equal((await start({ agentId: 'A-TEST-WIN', folders: [] })).status, 400);
  assert.equal(t.fake.calls.length, 0);
});

test('a backup runs the RMM script with a one-time token and the free quota', async () => {
  const res = await start({ agentId: 'A-TEST-WIN', folders: ['Documents', 'Desktop'] });
  assert.equal(res.status, 201);
  assert.equal(res.body.backup.status, 'pending');
  const [, agentId, scriptId, args] = t.fake.calls[0];
  assert.equal(agentId, 'A-TEST-WIN');
  assert.equal(scriptId, 95);
  assert.ok(args.includes('-ApiUrl https://api.example.test'));
  assert.ok(args.includes('-Folders Documents,Desktop'));
  assert.ok(args.includes(`-MaxBytes ${500 * 1024 * 1024}`));
  // The token is stored hashed only.
  const doc = await FileBackup.findById(res.body.backup.id).select('+tokenHash').lean();
  assert.notEqual(doc.tokenHash, lastToken());

  assert.equal((await start({ agentId: 'A-TEST-WIN', folders: ['Documents'] })).status, 409, 'one backup per device at a time');
});

test('the device uploads parts in order and the download rebuilds the zip', async () => {
  const res = await start({ agentId: 'A-TEST-WIN', folders: ['Documents'] });
  const token = lastToken();
  assert.equal((await putPart(null, 0, 'x')).status, 401);
  assert.equal((await putPart('wrong', 0, 'x')).status, 401);
  assert.equal((await putPart(token, 1, 'x')).status, 409);
  assert.equal((await putPart(token, 0, 'first-')).status, 200);
  assert.equal((await putPart(token, 0, 'part1-')).status, 200, 'a retried part replaces the last one');
  assert.equal((await putPart(token, 1, 'part2')).status, 200);
  assert.equal((await report(token, { status: 'completed', parts: 3 })).status, 409, 'part count must match');

  const id = res.body.backup.id;
  assert.equal((await FileBackup.findById(id)).status, 'failed');
  assert.equal(stored.size, 0, 'an incomplete upload is removed');

  const okId = await completeBackup(['part1-', 'part2']);
  assert.equal((await putPart(lastToken(), 2, 'late')).status, 401, 'the token stops working once finished');

  const list = await t.request('GET', '/file-backups', { token: t.tokens.user });
  const done = list.body.backups.find((b) => b.id === okId);
  assert.equal(done.status, 'completed');
  assert.equal(done.size, 11);
  assert.equal(done.fileCount, 3);
  assert.equal(list.body.usage.used, 11);
  assert.equal(list.body.usage.limit, 500 * 1024 * 1024);

  const dl = await fetch(`${t.baseUrl}/file-backups/${okId}/download`, { headers: { Authorization: `Bearer ${t.tokens.user}` } });
  assert.equal(dl.status, 200);
  assert.equal(await dl.text(), 'part1-part2');
  assert.match(dl.headers.get('content-disposition'), /backup-TEST-PC-\d{4}-\d{2}-\d{2}\.zip/);
});

test('other accounts cannot see, download or delete a backup', async () => {
  const id = await completeBackup();
  assert.equal((await t.request('GET', `/file-backups/${id}/download`, { token: t.tokens.admin })).status, 404);
  assert.equal((await t.request('DELETE', `/file-backups/${id}`, { token: t.tokens.admin })).status, 404);
  assert.equal((await t.request('GET', '/file-backups', { token: t.tokens.admin })).body.backups.length, 0);
  assert.equal((await t.request('GET', '/file-backups')).status, 401);
  // Staff may not pull a customer's files into their own storage.
  assert.equal((await start({ agentId: 'A-TEST-WIN', folders: ['Documents'] }, t.tokens.admin)).status, 404);
});

test('uploads beyond the remaining storage fail and are removed', async () => {
  const res = await start({ agentId: 'A-TEST-WIN', folders: ['Documents'] });
  await FileBackup.updateOne({ _id: res.body.backup.id }, { $set: { maxBytes: 8 } });
  const token = lastToken();
  assert.equal((await putPart(token, 0, '12345')).status, 200);
  assert.equal((await putPart(token, 1, '67890')).status, 413);
  const doc = await FileBackup.findById(res.body.backup.id).lean();
  assert.equal(doc.status, 'failed');
  assert.equal(stored.size, 0);
});

test('a failure reported by the device is shown to the customer', async () => {
  const res = await start({ agentId: 'A-TEST-WIN', folders: ['Pictures'] });
  assert.equal((await report(lastToken(), { status: 'failed', error: 'No files were found in the chosen folders.' })).status, 200);
  const list = await t.request('GET', '/file-backups', { token: t.tokens.user });
  const b = list.body.backups.find((x) => x.id === res.body.backup.id);
  assert.equal(b.status, 'failed');
  assert.equal(b.error, 'No files were found in the chosen folders.');
});

test('only the newest backups of a device are kept, and customers can delete one', async () => {
  const first = await completeBackup();
  const second = await completeBackup();
  const third = await completeBackup();
  const ids = (await FileBackup.find({}).lean()).map((b) => String(b._id));
  assert.deepEqual(ids.sort(), [second, third].sort());
  assert.ok(![...stored.keys()].some((k) => k.includes(first)));

  assert.equal((await t.request('DELETE', `/file-backups/${second}`, { token: t.tokens.user })).status, 200);
  assert.ok(![...stored.keys()].some((k) => k.includes(second)));
  assert.equal(await FileBackup.countDocuments(), 1);
});

test('unfinished backups expire and weekly schedules start backups', async () => {
  const res = await start({ agentId: 'A-TEST-WIN', folders: ['Documents'] });
  await putPart(lastToken(), 0, 'abc');
  assert.equal(await expireStaleBackups(new Date(Date.now() + 7 * 60 * 60 * 1000)), 1);
  assert.equal((await FileBackup.findById(res.body.backup.id)).status, 'failed');
  assert.equal(stored.size, 0);

  assert.equal((await t.request('PUT', '/file-backups/schedule', { token: t.tokens.user, body: { agentId: 'A-OTHER-WIN', folders: ['Documents'], enabled: true } })).status, 404);
  const set = await t.request('PUT', '/file-backups/schedule', { token: t.tokens.user, body: { agentId: 'A-TEST-WIN', folders: ['Desktop'], enabled: true } });
  assert.equal(set.status, 200);
  t.fake.calls.length = 0;
  assert.equal(await runScheduledBackups(), 1);
  assert.ok(t.fake.calls[0][3].includes('-Folders Desktop'));
  assert.equal(await runScheduledBackups(), 0, 'not again within a week');
});
