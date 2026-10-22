const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');
const SystemConfig = require('../src/models/system-config/SystemConfig');
const { loadRmmSettings, getRmmSettings } = require('../src/utils/rmmSettings');
const { isSiteWritable, getRmmClientId } = require('../src/utils/rmmTenancy');

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });

const currentConfig = async () => (await t.request('GET', '/system-config/me', { token: t.tokens.superadmin })).body.config;
const saveRmm = (rmm, token = t.tokens.superadmin) =>
  currentConfig().then((config) => t.request('PUT', '/system-config', { token, body: { ...config, rmm } }));

test('on first start the .env values are copied into System Configuration once', async () => {
  await loadRmmSettings();
  const stored = (await SystemConfig.findOne().lean()).rmm;
  assert.deepEqual({ clientId: stored.clientId, writableSiteIds: stored.writableSiteIds, initialized: stored.initialized },
    { clientId: 12, writableSiteIds: '73', initialized: true });

  // Later .env changes are ignored: the database is the source.
  process.env.RMM_CLIENT_ID = '99';
  process.env.RMM_WRITE_ALLOWED_SITE_IDS = '*';
  await loadRmmSettings();
  assert.equal(getRmmClientId(), 12);
  assert.equal(isSiteWritable(500), false);
  process.env.RMM_CLIENT_ID = '12';
  process.env.RMM_WRITE_ALLOWED_SITE_IDS = '73';
});

test('the Super Admin changes RMM settings in System Configuration and they apply at once', async () => {
  const res = await saveRmm({ clientId: '14', writableSiteIds: ' 73, 74 ,73' });
  assert.equal(res.status, 200, res.body?.message);
  assert.deepEqual({ clientId: res.body.config.rmm.clientId, writableSiteIds: res.body.config.rmm.writableSiteIds }, { clientId: 14, writableSiteIds: '73,74' });
  assert.equal(getRmmClientId(), 14);
  assert.equal(isSiteWritable(74), true);
  assert.equal(isSiteWritable(75), false);

  assert.equal((await saveRmm({ clientId: 12, writableSiteIds: '*' })).status, 200);
  assert.equal(isSiteWritable(75), true);

  // Saving another tab (no rmm in the body) keeps the RMM settings.
  const { rmm, ...rest } = await currentConfig();
  assert.equal((await t.request('PUT', '/system-config', { token: t.tokens.superadmin, body: { ...rest, general: { ...rest.general, siteName: 'Renamed' } } })).status, 200);
  assert.equal(getRmmSettings().writableSiteIds, '*');
  assert.equal((await SystemConfig.findOne().lean()).rmm.writableSiteIds, '*');

  assert.equal((await saveRmm({ clientId: 12, writableSiteIds: '73' })).status, 200);
});

test('invalid RMM values are refused and only the Super Admin may change them', async () => {
  assert.equal((await saveRmm({ clientId: 'abc', writableSiteIds: '73' })).status, 400);
  assert.equal((await saveRmm({ clientId: 12, writableSiteIds: '73;drop' })).status, 400);
  assert.equal((await saveRmm({ clientId: -1, writableSiteIds: '' })).status, 400);
  assert.equal((await saveRmm({ clientId: 12, writableSiteIds: '*' }, t.tokens.admin)).status, 403);
  assert.equal(getRmmClientId(), 12);
  assert.equal(isSiteWritable(74), false);
});
