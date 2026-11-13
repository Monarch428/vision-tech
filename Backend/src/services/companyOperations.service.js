const CompanyProviderAccount = require('../models/company/CompanyProviderAccount');
const tacticalRmm = require('./tacticalRmm.service');
const gravityZone = require('../utils/gravityZoneClient');

const forbidden = (message) => Object.assign(new Error(message), { status: 403 });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });

const providerAccount = async (companyId, provider) => {
  const account = await CompanyProviderAccount.findOne({ company: companyId, provider }).lean();
  if (!account) throw notFound(`${provider} has not been allocated to this company`);
  return account;
};

const tacticalAccount = (companyId) => providerAccount(companyId, 'tactical-rmm');

const isCompanySite = (account, agent) => account.siteIds.includes(Number(agent?.site));

const listCompanyDevices = async (companyId) => {
  const account = await tacticalAccount(companyId);
  const agents = await tacticalRmm.listAgents();
  return agents.filter((agent) => isCompanySite(account, agent));
};

const getCompanyDevice = async (companyId, agentId) => {
  const account = await tacticalAccount(companyId);
  const agent = await tacticalRmm.getAgent(agentId);
  if (!isCompanySite(account, agent)) throw forbidden('Device is outside this company allocation');
  return agent;
};

const generateCompanyInstaller = async (companyId, body) => {
  const account = await tacticalAccount(companyId);
  const siteId = Number(body.siteId);
  if (!account.siteIds.includes(siteId)) throw forbidden('Site is outside this company allocation');
  if (Number(body.clientId) !== Number(account.externalId)) throw forbidden('Client is outside this company allocation');
  return tacticalRmm.generateInstaller({
    client: account.externalId, site: siteId, plat: body.plat || 'windows',
    goarch: body.arch || 'amd64', agenttype: body.agentType || 'workstation',
    rdp: body.rdp ?? 0, ping: body.ping ?? 0,
  });
};

const listCompanyAntivirusEndpoints = async (companyId) => {
  const account = await providerAccount(companyId, 'bitdefender');
  const result = await gravityZone.getEndpointsList({ companyId: account.externalId });
  return { account, items: result?.items || [] };
};

const createCompanyAntivirusScan = async (companyId, endpointId) => {
  if (!endpointId || typeof endpointId !== 'string') throw Object.assign(new Error('endpointId is required'), { status: 400 });
  const { account, items } = await listCompanyAntivirusEndpoints(companyId);
  if (!items.some((item) => String(item.id) === endpointId)) {
    throw forbidden('Endpoint is outside this company allocation');
  }
  return gravityZone.createScanTask({ endpointId, companyId: account.externalId });
};

module.exports = {
  listCompanyDevices, getCompanyDevice, generateCompanyInstaller,
  listCompanyAntivirusEndpoints, createCompanyAntivirusScan,
};
