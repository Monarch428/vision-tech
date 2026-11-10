// Read-only pre-launch check: `npm run preflight` (uses Backend/.env).
// Reports configuration problems and data that the first production run would
// act on. It never writes to the database, Tactical RMM or GravityZone.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const results = { block: [], warn: [], ok: [] };
const block = (msg) => results.block.push(msg);
const warn = (msg) => results.warn.push(msg);
const ok = (msg) => results.ok.push(msg);

const checkEnv = () => {
  const env = process.env;
  (env.JWT_SECRET || '').length >= 32 ? ok('JWT_SECRET is set (32+ chars)') : block('JWT_SECRET must be a random string of at least 32 characters');
  env.CONFIG_ENCRYPTION_KEY ? ok('CONFIG_ENCRYPTION_KEY is set') : block('CONFIG_ENCRYPTION_KEY is not set (needed to store the SMTP password encrypted)');
  env.FRONTEND_URL ? ok(`FRONTEND_URL = ${env.FRONTEND_URL}`) : block('FRONTEND_URL is not set (CORS and password-reset links use it)');
  env.RATE_LIMIT_DISABLED === 'true' ? block('RATE_LIMIT_DISABLED=true: rate limits are off') : ok('Rate limits are on');
  env.DISABLE_CRON === 'true' ? block('DISABLE_CRON=true: reminders, plan expiry and RMM sync will not run') : ok('Scheduled jobs are on');
  (env.PAYPAL_MODE || '').toLowerCase() === 'live' ? ok('PayPal is in live mode') : warn('PAYPAL_MODE is not "live": payments use the PayPal Sandbox');
  env.PAYPAL_WEBHOOK_ID
    ? ok('PayPal webhook id is set')
    : warn('PAYPAL_WEBHOOK_ID is not set: pending PayPal payments never activate, and refunds made in PayPal are not recorded');
  const stripeKey = env.STRIPE_SECRET_KEY || '';
  if (!stripeKey) block('STRIPE_SECRET_KEY is not set: "Pay with Card (Stripe)" will fail');
  else if (stripeKey.startsWith('sk_live_')) ok('Stripe is in live mode');
  else warn('STRIPE_SECRET_KEY is a test key: card payments are test-mode only');
  env.STRIPE_WEBHOOK_SECRET
    ? ok('Stripe webhook secret is set')
    : warn('STRIPE_WEBHOOK_SECRET is not set: a customer who closes the tab before returning from Stripe won\'t get their plan until they reload Billing');

  for (const key of ['RMM_SCRIPT_RESTART_ID', 'RMM_SCRIPT_CLEANUP_ID', 'RMM_WEB_URL']) {
    env[key] ? ok(`${key} = ${env[key]}`) : warn(`${key} is not set (that feature is hidden)`);
  }
  env.RMM_SCRIPT_FILE_BACKUP_ID && env.BACKEND_PUBLIC_URL && env.CLOUDINARY_API_SECRET
    ? ok(`Customer file backup uploads to ${env.BACKEND_PUBLIC_URL}`)
    : warn('Customer file backup is off: set RMM_SCRIPT_FILE_BACKUP_ID, BACKEND_PUBLIC_URL and the CLOUDINARY_* keys');
};

let rmmClientId = null;

const checkDatabase = async () => {
  const db = mongoose.connection;
  const config = await db.collection('systemconfigs').findOne();
  if (!config) return block('No system configuration in the database: run the seed script');

  const email = config.email || {};
  email.smtpHost && email.smtpUsername && email.smtpPassword && email.fromEmail
    ? ok(`SMTP configured (${email.smtpHost})`)
    : block('SMTP is not fully configured: login codes, resets and alerts cannot be emailed');
  if (email.smtpPassword && !String(email.smtpPassword).startsWith('enc:v1:')) {
    warn('The stored SMTP password is not encrypted: re-save it in System Configuration after setting CONFIG_ENCRYPTION_KEY');
  }
  // RMM settings live in System Configuration → RMM (copied once from .env on first start).
  const rmm = config.rmm?.initialized
    ? config.rmm
    : { clientId: Number(process.env.RMM_CLIENT_ID) || null, writableSiteIds: (process.env.RMM_WRITE_ALLOWED_SITE_IDS || '').trim() };
  rmmClientId = rmm.clientId || null;
  rmmClientId ? ok(`RMM Client ID = ${rmmClientId}`) : block('RMM Client ID is not set in System Configuration → RMM (RMM features are disabled)');
  const writable = String(rmm.writableSiteIds || '').trim();
  if (writable === '*') ok('RMM safety lock allows all Sites (production setting)');
  else if (!writable) block('RMM Site IDs are empty (System Configuration → RMM): customers cannot add, remove or act on devices');
  else warn(`RMM Site IDs = ${writable}: only these Sites can be changed (development setting)`);
  if (config.general?.maintenanceMode) warn('Maintenance mode is ON: nobody can log in');
  if (config.security?.requireTwoFactorAuth === false) warn('Login codes (2FA) are turned off');
  const ips = config.security?.allowedIpAddresses || [];
  if (ips.length && !ips.includes('*')) warn(`Logins are limited to these IPs: ${ips.join(', ')}`);

  const staff = await db.collection('users').find({ role: { $in: ['admin', 'superadmin'] } }).project({ email: 1, role: 1, isActive: 1 }).toArray();
  const legacy = await db.collection('users').countDocuments({ role: 'support' });
  if (legacy) warn(`${legacy} account(s) still have the old "support" role; they are renamed to "superadmin" when the server starts`);
  staff.length ? ok(`Staff accounts (alert recipients): ${staff.map((s) => `${s.email} [${s.role}${s.isActive === false ? ', inactive' : ''}]`).join(', ')}`) : block('No admin or support accounts');
  for (const s of staff) if (/\.local$|example\./i.test(s.email)) warn(`Staff email ${s.email} looks like a placeholder: alerts sent there will be lost`);

  const paidPlans = await db.collection('plans').find({ price: { $gt: 0 } }).project({ _id: 1 }).toArray();
  const overdue = await db.collection('subscriptions').aggregate([
    { $match: { plan: { $in: paidPlans.map((p) => p._id) }, status: { $in: ['active', 'cancelled'] }, nextRenewalDate: { $lt: new Date() }, graceUntil: null } },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
    { $project: { email: { $first: '$u.email' }, nextRenewalDate: 1 } },
  ]).toArray();
  overdue.length
    ? warn(`${overdue.length} paid subscription(s) are past their renewal date and will start a 7-day grace period (with an email) on the first nightly run: ${overdue.map((o) => o.email).join(', ')}`)
    : ok('No paid subscriptions are past their renewal date');

  return db.collection('users').find({ 'rmm.siteId': { $ne: null } }).project({ email: 1, 'rmm.siteId': 1 }).toArray();
};

const checkTactical = async (linkedUsers) => {
  if (!rmmClientId) return;
  const tacticalService = require('../src/services/tacticalRmm.service');
  try {
    const sites = await tacticalService.listSites(rmmClientId);
    ok(`Tactical RMM reachable: ${sites.length} Site(s) in client ${rmmClientId}`);
    const linked = new Set(linkedUsers.map((u) => u.rmm.siteId));
    const unlinked = sites.filter((s) => !linked.has(s.id) && s.agent_count > 0);
    if (unlinked.length) {
      warn(`${unlinked.length} Site(s) with devices are not linked to any account (those customers see no devices): ${unlinked.map((s) => `${s.name} (#${s.id}, ${s.agent_count})`).join(', ')}`);
    }
  } catch (error) {
    block(`Tactical RMM is not reachable: ${error.message}`);
  }
};

(async () => {
  checkEnv();
  try {
    await mongoose.connect(process.env.MONGO_URI);
    ok(`Connected to ${process.env.MONGO_URI.replace(/\/\/[^@/]*@/, '//***@')}`);
    const linkedUsers = await checkDatabase();
    await checkTactical(linkedUsers || []);
  } catch (error) {
    block(`Database check failed: ${error.message}`);
  } finally {
    await mongoose.disconnect();
  }

  const print = (title, list, mark) => list.length && console.log(`\n${title}\n${list.map((m) => `  ${mark} ${m}`).join('\n')}`);
  print('BLOCKING — fix before going live:', results.block, '✖');
  print('CHECK:', results.warn, '!');
  print('OK:', results.ok, '✓');
  console.log(`\n${results.block.length} blocking, ${results.warn.length} to check, ${results.ok.length} ok`);
  process.exit(results.block.length ? 1 : 0);
})();
