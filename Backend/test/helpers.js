// Shared setup for the automated tests (node --test).
//
// Safety: the tests use their own database (must contain "test" in its name),
// point Tactical RMM / GravityZone at an unreachable address, and replace both
// clients with in-memory fakes, so they can never touch real customers' data
// or devices.

// Environment must be set before any app module (and dotenv) loads.
const TEST_DB = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/visiontech_test';
if (!/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error(`Refusing to run tests against "${TEST_DB}": the database name must contain "test".`);
}
Object.assign(process.env, {
  MONGO_URI: TEST_DB,
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret',
  DISABLE_CRON: 'true',
  RATE_LIMIT_DISABLED: 'true',
  TACTICALRMM_BASE_URL: 'http://127.0.0.1:9',
  TACTICALRMM_API_KEY: 'test',
  BITDEFENDER_API_URL: 'http://127.0.0.1:9',
  BITDEFENDER_API_KEY: 'test',
  CYBERSHIELD_SOLO_ID: 'test-parent',
  RMM_CLIENT_ID: '12',
  RMM_WRITE_ALLOWED_SITE_IDS: '73',
  RMM_SCRIPT_RESTART_ID: '81',
  RMM_SCRIPT_CLEANUP_ID: '11',
  RMM_WEB_URL: 'https://rmm.example.test',
  CONFIG_ENCRYPTION_KEY: 'test-encryption-key',
  PAYPAL_CLIENT_ID: 'test',
  PAYPAL_CLIENT_SECRET: 'test',
  STRIPE_SECRET_KEY: 'sk_test_fake_for_tests',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  PAYPAL_WEBHOOK_ID: 'WH-TEST',
  FRONTEND_URL: 'http://localhost:5173',
});

const mongoose = require('mongoose');
const tacticalService = require('../src/services/tacticalRmm.service');
const gz = require('../src/utils/gravityZoneClient');

// ── In-memory Tactical RMM / GravityZone ──────────────────────────────────────
const TEST_SITE = 73;
const OTHER_SITE = 53;

const fake = {
  sites: [
    { id: OTHER_SITE, name: 'Other Customer', agent_count: 2 },
    { id: TEST_SITE, name: 'Test Site', agent_count: 1 },
  ],
  agents: [
    { agent_id: 'A-TEST-WIN', hostname: 'TEST-PC', site: TEST_SITE, site_name: 'Test Site', plat: 'windows', status: 'online', serial_number: 'SN-TEST' },
    { agent_id: 'A-OTHER-WIN', hostname: 'OTHER-PC', site: OTHER_SITE, site_name: 'Other Customer', plat: 'windows', status: 'online', serial_number: 'SN-OTHER' },
    { agent_id: 'A-OTHER-MAC', hostname: 'Other-MacBook.local', site: OTHER_SITE, site_name: 'Other Customer', plat: 'darwin', status: 'online', serial_number: 'SN-MAC' },
  ],
  calls: [], // every write the app tried to make
};

const notFound = () => Object.assign(new Error('Not found'), { response: { status: 404 } });
const agentDetail = (a) => ({
  ...a,
  client: 'CyberShield Solo',
  operating_system: a.plat === 'windows' ? 'Windows 11 Pro' : 'macOS',
  last_seen: new Date().toISOString(),
  disks: [{ device: 'C:', total: '100 GB', used: '40 GB', free: '60 GB', percent: 40 }],
  cpu_model: ['Test CPU'],
  total_ram: 16,
});

Object.assign(tacticalService, {
  listSites: async () => fake.sites,
  listAgents: async () => fake.agents,
  listAgentsByClient: async () => fake.agents.map((a) => ({ ...a, last_seen: new Date().toISOString() })),
  listAgentsBySite: async (siteId) => fake.agents.filter((a) => a.site === Number(siteId)),
  getAgent: async (id) => {
    const agent = fake.agents.find((a) => a.agent_id === id);
    if (!agent) throw notFound();
    return agentDetail(agent);
  },
  getAgentChecks: async () => [],
  getAgentSoftware: async () => [{ name: 'Test App', version: '1.0', publisher: 'Test', install_date: '2026-01-01', size: '1 MB', uninstall: 'C:\\secret.exe' }],
  getAgentWinUpdates: async () => [],
  generateInstaller: async ({ client, site }) => {
    fake.calls.push(['generateInstaller', site]);
    return { cmd: `tacticalrmm.exe -m install --client-id ${client} --site-id ${site} --auth TOKEN`, url: 'https://example.test/agent' };
  },
  createSite: async (clientId, name) => {
    fake.calls.push(['createSite', name]);
    const site = { id: 900 + fake.sites.length, name, agent_count: 0 };
    fake.sites.push(site);
    return site;
  },
  runScript: async (agentId, scriptId, args) => { fake.calls.push(['runScript', agentId, scriptId, args]); return 'ok'; },
  runCommand: async () => { throw new Error('runCommand must never be called'); },
  uninstallAgent: async (agentId) => { fake.calls.push(['uninstallAgent', agentId]); },
});
Object.assign(gz, {
  getAllEndpoints: async () => fake.agents.map((a) => ({ id: `gz-${a.agent_id}`, name: a.hostname.replace(/\.local$/, '') })),
  getEndpointsList: async () => ({ items: fake.agents.map((a) => ({ id: `gz-${a.agent_id}`, name: a.hostname })) }),
  createScanTask: async ({ endpointId }) => { fake.calls.push(['createScanTask', endpointId]); return { taskId: 'task-1' }; },
});

// ── App and data ──────────────────────────────────────────────────────────────
const app = require('../src/app');
const AuthUser = require('../src/models/auth/User');
const UserManagement = require('../src/models/user-management/User');
const Plan = require('../src/models/subscription/Plan');
const SystemConfig = require('../src/models/system-config/SystemConfig');
const { activatePlan } = require('../src/utils/planActivation');

const PASSWORDS = { user: 'User@12345', admin: 'Admin@12345', superadmin: 'Super@12345' };

const seed = async () => {
  await mongoose.connection.dropDatabase();
  // Dropping the database also drops indexes (unique keys the app relies on); rebuild them.
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  for (const [name, price] of [['free', 0], ['pro', 49.99], ['enterprise', 149.99]]) {
    await Plan.create({ name, price, billingCycle: 'monthly', features: [] });
  }
  await SystemConfig.create({
    general: { siteName: 'Test', maintenanceMode: false },
    email: { smtpHost: '', smtpPassword: '' },
    security: { maxLoginAttempts: 5, minimumPasswordLength: 8, requireTwoFactorAuth: false, allowedIpAddresses: ['*'], sessionTimeoutMinutes: 60 },
    notifications: { deviceAlerts: false },
  });

  const ids = {};
  for (const role of ['user', 'admin', 'superadmin']) {
    const user = await AuthUser.create({ name: `Test ${role}`, email: `${role}@test.local`, password: PASSWORDS[role], role, isActive: true });
    const planName = role === 'user' ? 'free' : 'enterprise';
    await UserManagement.updateOne({ _id: user._id }, { $set: { status: 'active', plan: planName, deviceNames: [], serialNumbers: [] } });
    await activatePlan({ userId: user._id, plan: await Plan.findOne({ name: planName }) });
    ids[role] = String(user._id);
  }
  return ids;
};

// Starts the API on a random port with fresh data. Returns helpers for requests.
const startTestServer = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const ids = await seed();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const request = async (method, path, { token, body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, body: json };
  };

  const login = async (role) => {
    const res = await request('POST', '/auth/login', { body: { email: `${role}@test.local`, password: PASSWORDS[role] } });
    if (!res.body?.token) throw new Error(`Login failed for ${role}: ${res.status} ${res.body?.message}`);
    return res.body.token;
  };
  const tokens = { user: await login('user'), admin: await login('admin'), superadmin: await login('superadmin') };

  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  };

  return { request, baseUrl: base, tokens, ids, close, fake, TEST_SITE, OTHER_SITE };
};

module.exports = { startTestServer };
