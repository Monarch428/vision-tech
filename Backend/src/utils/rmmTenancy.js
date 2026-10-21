const UserManagement = require('../models/user-management/User');
const tacticalService = require('../services/tacticalRmm.service');

// Each customer's devices live in their own Tactical RMM Site under one Client
// (RMM_CLIENT_ID). The link is stored on the user as `rmm.siteId`.

const httpError = (status, message) => Object.assign(new Error(message), { status });

const getRmmClientId = () => {
  const id = Number(process.env.RMM_CLIENT_ID);
  if (!id) throw httpError(500, 'RMM_CLIENT_ID is not configured');
  return id;
};

// Safety lock: actions that change Tactical RMM (installer tokens, uninstalls,
// scripts, moves) only run on Sites listed in RMM_WRITE_ALLOWED_SITE_IDS
// ("*" = all Sites, e.g. in production). Unset or empty = no writes at all.
const isSiteWritable = (siteId) => {
  const raw = (process.env.RMM_WRITE_ALLOWED_SITE_IDS || '').trim();
  if (raw === '*') return true;
  return raw.split(',').map((v) => Number(v.trim())).filter(Boolean).includes(Number(siteId));
};

const assertSiteWritable = (siteId) => {
  if (!isSiteWritable(siteId)) {
    throw httpError(403, `RMM changes are not enabled for site ${siteId} (RMM_WRITE_ALLOWED_SITE_IDS)`);
  }
};

const getUserRmm = async (userId) => {
  const user = await UserManagement.findById(userId).select('name email rmm').lean();
  return user || null;
};

const getUserSiteId = async (userId) => (await getUserRmm(userId))?.rmm?.siteId || null;

// Links a user to an existing Site in our Client (staff action).
const linkUserToSite = async (userId, siteId) => {
  const clientId = getRmmClientId();
  const site = (await tacticalService.listSites(clientId)).find((s) => s.id === Number(siteId));
  if (!site) throw httpError(400, `Site ${siteId} does not exist in client ${clientId}`);

  await UserManagement.updateOne(
    { _id: userId },
    { $set: { rmm: { clientId, siteId: site.id, siteName: site.name, linkedAt: new Date() } } }
  );
  return site;
};

const unlinkUserSite = (userId) =>
  UserManagement.updateOne({ _id: userId }, { $set: { rmm: { clientId: null, siteId: null, siteName: null, linkedAt: null } } });

// Returns the user's Site id, creating and linking a new Site when
// RMM_AUTO_CREATE_SITES=true. Otherwise an unlinked user gets null and staff
// link them manually.
const ensureUserSite = async (userId) => {
  const user = await getUserRmm(userId);
  if (!user) throw httpError(404, 'User not found');
  if (user.rmm?.siteId) return user.rmm.siteId;
  if (process.env.RMM_AUTO_CREATE_SITES !== 'true') return null;

  const name = `${user.name} <${user.email}>`.slice(0, 100);
  const clientId = getRmmClientId();
  const existing = (await tacticalService.listSites(clientId)).find((s) => s.name === name);
  const site = existing || (await tacticalService.createSite(clientId, name));
  if (!site) throw httpError(502, 'Tactical RMM did not return the new site');

  await linkUserToSite(userId, site.id);
  return site.id;
};

module.exports = {
  getRmmClientId,
  isSiteWritable,
  assertSiteWritable,
  getUserSiteId,
  linkUserToSite,
  unlinkUserSite,
  ensureUserSite,
};
