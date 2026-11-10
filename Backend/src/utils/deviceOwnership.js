const tacticalService = require('../services/tacticalRmm.service');
const { isStaff } = require('../middleware/auth.middleware');
const { getRmmClientId, getUserSiteId } = require('./rmmTenancy');

// Ownership comes from the Tactical RMM Site linked to the user's account.
// Typed serial numbers or device names are never trusted: anyone could type
// another customer's serial. Staff see every device in our Client.

const normalize = (value) => String(value || '').trim().toLowerCase();

// Staff ownership checks only need to know which Sites are in our Client; that
// changes rarely, so it's cached briefly to save a Tactical call per request.
const SITE_CACHE_MS = 60 * 1000;
let siteCache = { ids: null, at: 0 };
const clientSiteIds = async () => {
  if (!siteCache.ids || Date.now() - siteCache.at > SITE_CACHE_MS) {
    const sites = await tacticalService.listSites(getRmmClientId());
    siteCache = { ids: new Set(sites.map((s) => s.id)), at: Date.now() };
  }
  return siteCache.ids;
};

// RMM agents the requester may see.
const agentsForUser = async (req) => {
  if (isStaff(req)) return tacticalService.listAgentsByClient(getRmmClientId());
  const siteId = await getUserSiteId(req.user.id);
  return siteId ? tacticalService.listAgentsBySite(siteId) : [];
};

// `agent` must be a full agent detail: `site` is the numeric Site id
// (`client` there is the Client's name, so staff access is checked via Sites).
const userOwnsAgent = async (req, agent) => {
  if (!agent) return false;
  if (isStaff(req)) return (await clientSiteIds()).has(Number(agent.site));
  const siteId = await getUserSiteId(req.user.id);
  return Boolean(siteId) && Number(agent.site) === Number(siteId);
};

// Bitdefender endpoints are matched to the hostnames of the user's RMM agents.
const filterEndpointsForUser = async (req, endpoints) => {
  if (isStaff(req)) return endpoints;
  const hostnames = (await agentsForUser(req)).map((a) => normalize(a.hostname));
  return endpoints.filter((e) => e.name && hostnames.includes(normalize(e.name)));
};

module.exports = { agentsForUser, userOwnsAgent, filterEndpointsForUser };
