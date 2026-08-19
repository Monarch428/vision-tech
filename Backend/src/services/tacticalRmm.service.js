const rmm = require('../utils/tacticalRmmClient');

exports.listAgents = async () => {
  const response = await rmm.get("/agents/?detail=true");
  console.log("LIST AGENT SAMPLE:", JSON.stringify(response.data[0], null, 2)); // TEMP
  return response.data;
};

exports.getAgent = async (agentId) => {
  const response = await rmm.get(`/agents/${agentId}/`);
  console.log("SINGLE AGENT DETAIL:", JSON.stringify(response.data, null, 2)); // TEMP
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
  expires = 24,
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