const tacticalService = require('../../services/tacticalRmm.service');

exports.getDevices = async (req, res) => {
  try {
    const agentList = await tacticalService.listAgents();

  const devices = await Promise.all(
  agentList.map(async (a) => {
    let cpu = 0, memory = 0, storage = a.disks?.[0]?.percent ?? 0;
    let siteId = null, clientId = null;
    try {
      const full = await tacticalService.getAgent(a.agent_id);
      const wmiCpu = full.wmi_detail?.cpu?.[0]?.[0];
      const wmiOs = full.wmi_detail?.os?.[0]?.[0];
      cpu = wmiCpu?.LoadPercentage ?? 0;
      if (wmiOs?.TotalVisibleMemorySize && wmiOs?.FreePhysicalMemory) {
        memory = Math.round(
          (1 - wmiOs.FreePhysicalMemory / wmiOs.TotalVisibleMemorySize) * 100
        );
      }
      storage = full.disks?.[0]?.percent ?? storage;
      siteId = full.site ?? null;       // confirmed present on full agent detail
      clientId = full.client ?? null;   // ⚠️ not confirmed in captured data — verify below
    } catch (e) {
      console.warn(`Failed to fetch detail for ${a.agent_id}:`, e.message);
    }

    return {
      _id: a.agent_id,
      deviceId: a.agent_id,
      name: a.hostname,
      hostname: a.hostname,
      platform: a.operating_system,
      status: a.status === 'online' ? 'online' : 'offline',
      cpu,
      memory,
      storage,
      lastSeen: a.last_seen,
      siteId,
      clientId,
      clientName: a.client_name ?? null,
      siteName: a.site_name ?? null,
    };
  })
);

    // Every authenticated user (any role) gets the full device list here.
    // Per-user visibility is enforced on the frontend instead, by matching
    // each device's GravityZone-reported IP against the logged-in user's
    // registered ipAddresses (same pattern as the Antivirus/Self-Help
    // pages) — not by a server-side agent-ID allowlist. This intentionally
    // mirrors how /self-help/bitdefender/company-endpoints already behaves
    // (unfiltered server-side, filtered client-side by IP).
    //
    // NOTE: this means the full company device list (names, hostnames,
    // CPU/memory/storage, etc.) is present in this API response for every
    // authenticated user, even though the UI only displays IP-matched
    // devices. If that data exposure isn't acceptable, per-user filtering
    // needs to move back server-side (e.g. re-introduce an allowlist, or
    // do the IP match here instead of trusting the client).
    res.json({ success: true, devices });
  } catch (err) {
    console.error("TACTICAL RMM ERROR:", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
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