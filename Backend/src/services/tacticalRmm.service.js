const rmm = require('../utils/tacticalRmmClient');

exports.listAgents = async () => {
  const response = await rmm.get("/agents/?detail=true");
  return response.data;
};

exports.listAgentsByClient = async (clientId, { detail = true } = {}) => {
  const response = await rmm.get(`/agents/?client=${Number(clientId)}${detail ? '&detail=true' : ''}`);
  return response.data;
};

// Tactical RMM uninstalls the agent from the computer and deletes its record.
// Callers must check ownership and the write safety lock first.
exports.uninstallAgent = async (agentId) => {
  const { data } = await rmm.delete(`/agents/${agentId}/`);
  return data;
};

exports.listAgentsBySite = async (siteId) => {
  const response = await rmm.get(`/agents/?site=${Number(siteId)}&detail=true`);
  return response.data;
};

exports.listSites = async (clientId) => {
  const { data } = await rmm.get('/clients/');
  const client = data.find((c) => c.id === Number(clientId));
  return client ? client.sites : [];
};

exports.createSite = async (clientId, name) => {
  await rmm.post('/clients/sites/', { site: { client: Number(clientId), name }, custom_fields: [] });
  const sites = await exports.listSites(clientId);
  return sites.find((s) => s.name === name) || null;
};

exports.getAgent = async (agentId) => {
  const response = await rmm.get(`/agents/${agentId}/`);
  return response.data;
};

exports.getAgentSoftware = async (agentId) => {
  const { data } = await rmm.get(`/software/${agentId}/`);
  return Array.isArray(data) ? data : data?.software || [];
};

exports.getAgentWinUpdates = async (agentId) => {
  const { data } = await rmm.get(`/winupdate/${agentId}/`);
  return Array.isArray(data) ? data : data?.winupdates || [];
};

exports.getAgentChecks = async (agentId) => {
  const response = await rmm.get(`/agents/${agentId}/checks/`);
  return response.data;
};

exports.runScript = async (agentId, scriptId, args = [], timeout = 90) => {
  const { data } = await rmm.post(`/agents/${agentId}/runscript/`, {
    output: 'forget',
    emails: [],
    emailMode: 'default',
    custom_field: null,
    save_all_output: false,
    script: scriptId,
    args,
    env_vars: [],
    run_as_user: false,
    timeout,
  });
  return data;
};

exports.runCommand = async (agentId, cmd, shell = 'powershell', timeout = 30) => {
  const { data } = await rmm.post(`/agents/${agentId}/cmd/`, { shell, cmd, timeout });
  return data;
};

exports.generateInstaller = async ({
  client,
  site,
  plat = 'windows',
  goarch = 'amd64',
  agenttype = 'workstation',
  expires = 1, // hours; a leaked install link stops working quickly
  rdp = 0,
  ping = 0,
  power = 0,
}) => {
  const { data } = await rmm.post('/agents/installer/', {
    installMethod: 'manual',
    client: Number(client),
    site: Number(site),
    expires,
    agenttype,
    api: process.env.TACTICALRMM_BASE_URL,
    fileName: `trmm-client${client}-site${site}-${agenttype}-${goarch}`,
    goarch,
    ping: ping ? 1 : 0,
    plat,
    power: power ? 1 : 0,
    rdp: rdp ? 1 : 0,
  });
  return data;
};