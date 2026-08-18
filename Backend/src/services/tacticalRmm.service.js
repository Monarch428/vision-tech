const rmm = require('../utils/tacticalRmmClient');

exports.listAgents = async () => {
  const response = await rmm.get("/agents/?detail=false");
  return response.data;
};

exports.getAgent = async (agentId) => {
  const response = await rmm.get(`/agents/${agentId}/`);
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
  arch = 'amd64',
  agenttype = 'workstation',
  expires = 24,
  rdp = true,
  ping = true,
  power = false,
}) => {
  const { data } = await rmm.post('/deploy/', {
    client,
    site,
    arch,
    plat,
    agenttype,
    expires,
    rdp,
    ping,
    power,
  });
  return data;
};