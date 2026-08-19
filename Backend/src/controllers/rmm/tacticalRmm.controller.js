const tacticalService = require('../../services/tacticalRmm.service');

// GET /devices — list all agents, normalized to your old Device shape
exports.getDevices = async (req, res) => {
  try {
    const agents = await tacticalService.listAgents();

    const devices = agents.map((a) => ({
      _id: a.agent_id,
      deviceId: a.agent_id,
      name: a.hostname,
      hostname: a.hostname,
      platform: a.operating_system,
      status: a.status === 'online' ? 'online' : 'offline',
      cpu: a.cpu_load ?? 0,
      memory: a.mem_percent ?? 0,
      storage: a.disks?.[0]?.percent ?? 0,
      lastSeen: a.last_seen,
    }));

    res.json({ success: true, devices });
 } catch (err) {
  console.error("TACTICAL RMM ERROR:", {
    message: err.message,
    code: err.code,
    status: err.response?.status,
    data: err.response?.data,
    url: err.config?.url,
    baseURL: err.config?.baseURL,
  });

  res.status(err.response?.status || 500).json({
    success: false,
    message: err.message,
    tacticalStatus: err.response?.status,
    tacticalResponse: err.response?.data,
  });
}
};

// GET /devices/:id — raw agent detail from Tactical
exports.getDevice = async (req, res) => {
  try {
    const agent = await tacticalService.getAgent(req.params.id);
    res.json({ success: true, device: agent });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data || 'Failed to fetch agent',
    });
  }
};

// POST /devices/:id/run-script
exports.runScript = async (req, res) => {
  try {
    const { scriptId, args, timeout } = req.body;
    if (!scriptId) {
      return res.status(400).json({ success: false, message: 'scriptId is required' });
    }

    const result = await tacticalService.runScript(req.params.id, scriptId, args, timeout);
    res.json({ success: true, result });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data || 'Failed to run script',
    });
  }
};

// POST /devices/:id/run-command
exports.runCommand = async (req, res) => {
  try {
    const { cmd, shell, timeout } = req.body;
    if (!cmd) {
      return res.status(400).json({ success: false, message: 'cmd is required' });
    }

    const result = await tacticalService.runCommand(req.params.id, cmd, shell, timeout);
    res.json({ success: true, result });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data || 'Failed to run command',
    });
  }
};

exports.generateInstaller = async (req, res) => {
  try {
    const { clientId, siteId, plat, agentType, arch, rdp, ping } = req.body;

    if (!clientId || !siteId) {
      return res.status(400).json({
        success: false,
        message: 'clientId and siteId are required',
      });
    }

    const result = await tacticalService.generateInstaller({
      client: clientId,
      site: siteId,
      plat: plat || 'windows',
      goarch: arch || 'amd64',
      agenttype: agentType || 'workstation',
      rdp: rdp ?? 0,
      ping: ping ?? 0,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("TACTICAL RMM INSTALLER ERROR:", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url,
    });

    res.status(err.response?.status || 500).json({
      success: false,
      message: err.message,
      tacticalStatus: err.response?.status,
      tacticalResponse: err.response?.data,
    });
  }
};