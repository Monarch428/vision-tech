const tacticalService = require('../../services/tacticalRmm.service');
const { userOwnsAgent } = require('../../utils/deviceOwnership');
const { getRmmClientId, getUserSiteId, ensureUserSite, assertSiteWritable, linkUserToSite, unlinkUserSite } = require('../../utils/rmmTenancy');
const UserManagement = require('../../models/user-management/User');
const systemLogger = require('../../utils/systemLogger');
const RmmDevice = require('../../models/rmm/RmmDevice');
const RmmAlert = require('../../models/rmm/RmmAlert');
const RmmAction = require('../../models/rmm/RmmAction');
const SystemLog = require('../../models/system-log/SystemLogs');
const { ACTIONS, availableActions, runAction } = require('../../utils/rmmActions');
const { getDeviceLimit } = require('../../utils/planLimits');
const { syncRmmDevices, getSyncStatus, getCachedSites } = require('../../cron/rmmDeviceSync');
const { isStaff } = require('../../middleware/auth.middleware');

// GET /devices — served from the device cache (cron/rmmDeviceSync.js), so page
// polling never fans out into one Tactical RMM call per device.
exports.getDevices = async (req, res) => {
  try {
    const staff = isStaff(req);
    const siteId = staff ? null : await getUserSiteId(req.user.id);
    const linked = staff || Boolean(siteId);

    const cached = linked
      ? await RmmDevice.find(staff ? { removedAt: null } : { siteId, removedAt: null }).sort({ hostname: 1 }).lean()
      : [];

    const openCounts = await RmmAlert.aggregate([
      { $match: { status: 'open', agentId: { $in: cached.map((d) => d.agentId) } } },
      { $group: { _id: '$agentId', count: { $sum: 1 } } },
    ]);
    const alertsByAgent = new Map(openCounts.map((c) => [c._id, c.count]));

    const devices = cached.map((d) => ({
      _id: d.agentId,
      deviceId: d.agentId,
      name: d.hostname,
      hostname: d.hostname,
      platform: d.os || d.platform,
      status: d.status === 'online' ? 'online' : 'offline',
      // null = not reported by this device (e.g. CPU/memory on macOS)
      cpu: d.cpu ?? null,
      memory: d.memory ?? null,
      storage: d.storage ?? null,
      storageDevice: d.storageDevice || null,
      // Another drive at 90%+ (e.g. "D: 99%"), shown alongside the system drive.
      otherDiskWarning: d.fullestDisk?.device && d.fullestDisk.device !== d.storageDevice && d.fullestDisk.percent >= 90
        ? `${d.fullestDisk.device} is ${d.fullestDisk.percent}% full`
        : null,
      lastSeen: d.lastSeen,
      siteId: d.siteId,
      siteName: d.siteName,
      serialNumber: d.serialNumber,
      overLimit: Boolean(d.overLimit),
      openAlerts: alertsByAgent.get(d.agentId) || 0,
      metricsUpdatedAt: d.metricsUpdatedAt,
    }));

    let limit = null;
    if (!staff) {
      const owner = await UserManagement.findById(req.user.id).select('plan').lean();
      const max = getDeviceLimit(owner?.plan);
      limit = { plan: owner?.plan || 'free', max: max === Infinity ? null : max, used: devices.length };
    }

    const { lastSuccessAt, stale } = getSyncStatus();
    res.json({ success: true, linked, limit, devices, sync: { lastSuccessAt, stale } });
  } catch (err) {
    res.status(err.status || err.response?.status || 500).json({ success: false, message: err.message });
  }
};

// GET /devices/alerts?status=open|resolved|all — customers see their own; staff see all.
exports.listAlerts = async (req, res) => {
  try {
    const status = ['open', 'resolved', 'all'].includes(req.query.status) ? req.query.status : 'open';
    const filter = status === 'all' ? {} : { status };
    if (!isStaff(req)) filter.user = req.user.id;

    const alerts = await RmmAlert.find(filter)
      .sort({ status: -1, openedAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 500))
      .populate('user', 'name email')
      .lean();

    res.json({
      success: true,
      alerts: alerts.map((a) => ({
        id: a._id,
        agentId: a.agentId,
        hostname: a.hostname,
        type: a.type,
        title: a.title,
        severity: a.severity,
        status: a.status,
        openedAt: a.openedAt,
        resolvedAt: a.resolvedAt,
        acknowledgedAt: a.acknowledgedAt,
        customer: isStaff(req) && a.user ? { name: a.user.name, email: a.user.email } : undefined,
      })),
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// POST /devices/alerts/:alertId/acknowledge (staff) — marks an alert as seen; it
// still resolves on its own when the problem clears.
exports.acknowledgeAlert = async (req, res) => {
  try {
    const alert = await RmmAlert.findByIdAndUpdate(
      req.params.alertId,
      { $set: { acknowledgedBy: req.user.id, acknowledgedAt: new Date() } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.getDevice = async (req, res) => {
  try {
    const agent = await tacticalService.getAgent(req.params.id);
    if (!(await userOwnsAgent(req, agent))) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    res.json({ success: true, device: agent });
  } catch (err) {
    res.status(err.status || err.response?.status || 500).json({
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
    res.status(err.status || err.response?.status || 500).json({
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
    res.status(err.status || err.response?.status || 500).json({
      success: false,
      message: err.response?.data || 'Failed to run command',
    });
  }
};

exports.generateInstaller = async (req, res) => {
  try {
    const { plat = 'windows', agentType, arch = 'amd64', rdp, ping } = req.body;

    const ALLOWED_ARCH = { windows: ['amd64', '386'], linux: ['amd64', '386', 'arm64'], darwin: ['amd64', 'arm64'] };
    if (!ALLOWED_ARCH[plat]?.includes(arch)) {
      return res.status(400).json({ success: false, message: `Unsupported platform/architecture: ${plat}/${arch}` });
    }

    // The Site always comes from the server: the customer's linked Site, or a
    // Site a staff member picks for a customer. Client/Site ids sent by a
    // customer's browser are ignored.
    const siteId = isStaff(req) && req.body.siteId
      ? Number(req.body.siteId)
      : await ensureUserSite(req.user.id);

    if (!siteId) {
      return res.status(409).json({
        success: false,
        message: 'Your account is not linked to a device group yet. Please contact support.',
      });
    }

    if (isStaff(req) && req.body.siteId) {
      const sites = await tacticalService.listSites(getRmmClientId());
      if (!sites.some((s) => s.id === siteId)) {
        return res.status(400).json({ success: false, message: `Site ${siteId} is not in our RMM client` });
      }
    }

    // Policy A1: customers at their plan's device limit can't create installers.
    if (!isStaff(req)) {
      const owner = await UserManagement.findById(req.user.id).select('plan').lean();
      const max = getDeviceLimit(owner?.plan);
      const used = (await tacticalService.listAgentsBySite(siteId)).length;
      if (used >= max) {
        return res.status(409).json({
          success: false,
          code: 'DEVICE_LIMIT_REACHED',
          message: `Your ${owner?.plan || 'free'} plan allows ${max} device${max === 1 ? '' : 's'} and you have ${used}. Remove a device or upgrade your plan to add another.`,
        });
      }
    }

    assertSiteWritable(siteId);

    const result = await tacticalService.generateInstaller({
      client: getRmmClientId(),
      site: siteId,
      plat: plat || 'windows',
      goarch: arch || 'amd64',
      agenttype: agentType || 'workstation',
      rdp: rdp ?? 0,
      ping: ping ?? 0,
    });

    // Tactical's "manual" command expects the agent file to be downloaded into the
    // current folder first, and for macOS/Linux it even returns a Windows command.
    // Build a single command that downloads the agent and installs it.
    const agentFile = String(result.cmd || '').split(' ')[0];
    const installArgs = (String(result.cmd || '').match(/-m install .*/) || [])[0];
    if (result.url && /^tacticalagent-[\w.-]+$/.test(agentFile) && installArgs) {
      result.cmd = plat === 'windows'
        ? `cd /d "%TEMP%" && curl.exe -fsSL -o ${agentFile} "${result.url}" && ${result.cmd}`
        : `cd /tmp && curl -fsSL -o ${agentFile} "${result.url}" && chmod +x ${agentFile} && sudo ./${agentFile} ${installArgs}`;
    }

    await systemLogger({
      type: 'info', action: 'RMM_INSTALLER_CREATED', user: req.user?._id, userEmail: req.user?.email,
      details: `Installer link for site #${siteId} (${plat || 'windows'}/${arch || 'amd64'}), valid 1 hour`,
      module: 'rmm', ipAddress: req.ip,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("TACTICAL RMM INSTALLER ERROR:", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url,
    });

    res.status(err.status || err.response?.status || 500).json({
      success: false,
      message: err.message,
      tacticalStatus: err.response?.status,
      tacticalResponse: err.response?.data,
    });
  }
};
// ── Site linking (staff) ──────────────────────────────────────────────────────
// Links only change our database; nothing is written to Tactical RMM.

// GET /devices/sites — Sites in our Client with device counts and linked account.
exports.listSites = async (req, res) => {
  try {
    const sites = await tacticalService.listSites(getRmmClientId());
    const linkedUsers = await UserManagement.find({ 'rmm.siteId': { $in: sites.map((s) => s.id) } })
      .select('name email rmm.siteId')
      .lean();

    res.json({
      success: true,
      sites: sites.map((s) => {
        const user = linkedUsers.find((u) => u.rmm?.siteId === s.id);
        return {
          id: s.id,
          name: s.name,
          agentCount: s.agent_count ?? 0,
          linkedUser: user ? { id: user._id, name: user.name, email: user.email } : null,
        };
      }),
    });
  } catch (err) {
    res.status(err.status || err.response?.status || 500).json({ success: false, message: err.message });
  }
};

// PUT /devices/sites/link { userId, siteId }
exports.linkSite = async (req, res) => {
  try {
    const { userId, siteId } = req.body;
    if (!userId || !siteId) {
      return res.status(400).json({ success: false, message: 'userId and siteId are required' });
    }

    const user = await UserManagement.findById(userId).select('email');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const taken = await UserManagement.findOne({ 'rmm.siteId': Number(siteId), _id: { $ne: userId } }).select('email');
    if (taken) {
      return res.status(409).json({ success: false, message: `Site ${siteId} is already linked to ${taken.email}` });
    }

    const site = await linkUserToSite(userId, siteId);

    await systemLogger({
      type: 'success', action: 'RMM_SITE_LINKED', user: req.user?._id, userEmail: req.user?.email,
      details: `Linked ${user.email} to RMM site #${site.id} "${site.name}"`, module: 'rmm', ipAddress: req.ip,
    });

    syncRmmDevices(); // attach the Site's devices to the account in the background
    res.json({ success: true, site: { id: site.id, name: site.name } });
  } catch (err) {
    res.status(err.status || err.response?.status || 500).json({ success: false, message: err.message });
  }
};

// DELETE /devices/sites/link/:userId
exports.unlinkSite = async (req, res) => {
  try {
    const user = await UserManagement.findById(req.params.userId).select('email rmm');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await unlinkUserSite(user._id);
    syncRmmDevices();

    await systemLogger({
      type: 'warning', action: 'RMM_SITE_UNLINKED', user: req.user?._id, userEmail: req.user?.email,
      details: `Unlinked ${user.email} from RMM site #${user.rmm?.siteId}`, module: 'rmm', ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(err.status || err.response?.status || 500).json({ success: false, message: err.message });
  }
};

// DELETE /devices/:id — uninstalls the agent from the computer (Tactical RMM
// removes it and its record). Owner or staff only, and only on Sites the
// write safety lock allows.
exports.removeDevice = async (req, res) => {
  try {
    let agent;
    try {
      agent = await tacticalService.getAgent(req.params.id);
    } catch (err) {
      if (err.response?.status === 404) return res.status(404).json({ success: false, message: 'Device not found' });
      throw err;
    }
    if (!(await userOwnsAgent(req, agent))) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    assertSiteWritable(agent.site);
    await tacticalService.uninstallAgent(req.params.id);

    await RmmDevice.updateOne({ agentId: req.params.id }, { $set: { removedAt: new Date(), overLimit: false } });

    // Keep the profile's paired device name / serial lists consistent.
    const owner = await UserManagement.findOne({ 'rmm.siteId': Number(agent.site) });
    const serial = String(agent.serial_number || '').toLowerCase();
    if (owner && serial) {
      const index = (owner.serialNumbers || []).findIndex((s) => String(s).toLowerCase() === serial);
      if (index !== -1) {
        owner.serialNumbers.splice(index, 1);
        if (owner.deviceNames?.length > index) owner.deviceNames.splice(index, 1);
        await owner.save();
      }
    }

    await systemLogger({
      type: 'warning', action: 'RMM_DEVICE_REMOVED', user: req.user?._id, userEmail: req.user?.email,
      details: `Uninstalled agent ${req.params.id} (${agent.hostname}) from site #${agent.site}`,
      module: 'rmm', ipAddress: req.ip,
    });

    syncRmmDevices(); // re-evaluate limits in the background
    res.json({ success: true, message: `${agent.hostname} is being uninstalled.` });
  } catch (err) {
    // Tactical refusing (403) means the API key lacks the "Uninstall agents"
    // permission: tell the user plainly, and keep the technical detail in the log.
    const tacticalRefused = err.response?.status === 403 && !err.status;
    if (err.status !== 404) {
      await systemLogger({
        type: 'error', action: 'RMM_DEVICE_REMOVE_FAILED', user: req.user?._id, userEmail: req.user?.email,
        details: `Remove ${req.params.id}: ${tacticalRefused ? 'Tactical RMM refused (API key lacks "Uninstall agents" permission)' : err.message}`,
        module: 'rmm', ipAddress: req.ip,
      });
    }
    if (tacticalRefused) {
      return res.status(503).json({
        success: false,
        message: 'Removing devices from the portal is not available yet. Please contact support to remove this device.',
      });
    }
    res.status(err.status || err.response?.status || 500).json({ success: false, message: err.message });
  }
};

// ── Device details and remote actions ────────────────────────────────────────

const loadOwnedAgent = async (req) => {
  let agent;
  try {
    agent = await tacticalService.getAgent(req.params.id);
  } catch (err) {
    if (err.response?.status === 404) throw Object.assign(new Error('Device not found'), { status: 404 });
    throw err;
  }
  if (!(await userOwnsAgent(req, agent))) throw Object.assign(new Error('Device not found'), { status: 404 });
  return agent;
};

// GET /devices/:id/details
exports.getDeviceDetails = async (req, res) => {
  try {
    const agent = await loadOwnedAgent(req);
    const [cached, software, updates, alerts, actions, available] = await Promise.all([
      RmmDevice.findOne({ agentId: agent.agent_id }).lean(),
      tacticalService.getAgentSoftware(agent.agent_id).catch(() => []),
      agent.plat === 'windows' ? tacticalService.getAgentWinUpdates(agent.agent_id).catch(() => []) : [],
      RmmAlert.find({ agentId: agent.agent_id }).sort({ openedAt: -1 }).limit(20).lean(),
      RmmAction.find({ agentId: agent.agent_id }).sort({ createdAt: -1 }).limit(20)
        .populate('requestedBy', 'name email').lean(),
      availableActions(agent.agent_id, agent.plat),
    ]);

    const staff = isStaff(req);
    const pendingUpdates = updates.filter((u) => !u.installed);
    const webUrl = (process.env.RMM_WEB_URL || '').replace(/\/$/, '');

    res.json({
      success: true,
      device: {
        id: agent.agent_id,
        hostname: agent.hostname,
        status: agent.status,
        platform: agent.plat,
        os: agent.operating_system,
        makeModel: agent.make_model || null,
        cpuModel: Array.isArray(agent.cpu_model) ? agent.cpu_model.join(', ') : agent.cpu_model || null,
        totalRamGb: agent.total_ram ?? null,
        lastSeen: agent.last_seen,
        bootTime: agent.boot_time ? new Date(agent.boot_time * 1000) : null,
        needsReboot: Boolean(agent.needs_reboot),
        loggedInUser: agent.logged_in_username || null,
        publicIp: agent.public_ip || null,
        localIps: agent.local_ips || null,
        // The detail call doesn't always carry the serial; the agent list (cached) does.
        serialNumber: agent.serial_number || cached?.serialNumber || null,
        siteName: agent.site_name,
        disks: (agent.disks || []).map((d) => ({ device: d.device, total: d.total, used: d.used, free: d.free, percent: d.percent })),
        cpu: cached?.cpu ?? null,
        memory: cached?.memory ?? null,
        metricsUpdatedAt: cached?.metricsUpdatedAt || null,
        overLimit: Boolean(cached?.overLimit),
      },
      checks: cached?.checks || [],
      software: software
        .map((s) => ({ name: s.name, version: s.version, publisher: s.publisher, installDate: s.install_date, size: s.size }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
      pendingUpdates: pendingUpdates.map((u) => ({ kb: u.kb, title: u.title, severity: u.severity })),
      alerts: alerts.map((a) => ({ id: a._id, title: a.title, severity: a.severity, status: a.status, openedAt: a.openedAt, resolvedAt: a.resolvedAt })),
      actions: actions.map((a) => ({
        action: a.action, status: a.status, error: a.error, createdAt: a.createdAt,
        requestedBy: staff ? a.requestedBy?.email : (String(a.requestedBy?._id) === String(req.user.id) ? 'You' : 'Support'),
      })),
      availableActions: available,
      // Staff only: opens take-control in the Tactical RMM website (requires a Tactical login).
      remoteDesktopUrl: staff && webUrl ? `${webUrl}/takecontrol/${agent.agent_id}` : null,
    });
  } catch (err) {
    res.status(err.status || err.response?.status || 500).json({ success: false, message: err.message });
  }
};

// POST /devices/:id/actions/:action { confirm: true }
exports.runDeviceAction = async (req, res) => {
  try {
    if (req.body?.confirm !== true) {
      return res.status(400).json({ success: false, message: 'Please confirm this action.' });
    }
    const agent = await loadOwnedAgent(req);
    assertSiteWritable(agent.site);

    const record = await runAction({
      agent,
      action: req.params.action,
      requester: { id: req.user.id, role: req.user.role, isStaff: isStaff(req) },
    });

    await systemLogger({
      type: 'info', action: 'RMM_DEVICE_ACTION', user: req.user?._id, userEmail: req.user?.email,
      details: `${req.params.action} sent to ${agent.hostname} (site #${agent.site})`, module: 'rmm', ipAddress: req.ip,
    });

    res.json({ success: true, message: `${ACTIONS[req.params.action].label} sent to ${agent.hostname}.`, actionId: record._id });
  } catch (err) {
    if (err.status !== 404) {
      await systemLogger({
        type: 'warning', action: 'RMM_DEVICE_ACTION_REFUSED', user: req.user?._id, userEmail: req.user?.email,
        details: `${req.params.action} on ${req.params.id}: ${err.message}`, module: 'rmm', ipAddress: req.ip,
      });
    }
    res.status(err.status || err.response?.status || 500).json({ success: false, message: err.message });
  }
};

// ── Staff console ─────────────────────────────────────────────────────────────

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /devices/console?search=&status=online|offline&siteId=&alerts=open&overLimit=true
exports.getConsole = async (req, res) => {
  try {
    // Uses the Site list from the last sync, so the console stays fast and keeps
    // working while Tactical RMM is slow or down.
    const sites = getCachedSites() || await tacticalService.listSites(getRmmClientId());
    const users = await UserManagement.find({ 'rmm.siteId': { $in: sites.map((s) => s.id) } })
      .select('name email plan rmm.siteId').lean();
    const userBySite = new Map(users.map((u) => [u.rmm.siteId, u]));

    const all = await RmmDevice.find({ removedAt: null }).sort({ hostname: 1 }).lean();
    const openAlerts = await RmmAlert.aggregate([
      { $match: { status: 'open' } },
      { $group: { _id: '$agentId', count: { $sum: 1 } } },
    ]);
    const alertsByAgent = new Map(openAlerts.map((a) => [a._id, a.count]));

    const rows = all.map((d) => {
      const owner = userBySite.get(d.siteId);
      return {
        id: d.agentId,
        hostname: d.hostname,
        platform: d.platform,
        os: d.os,
        status: d.status === 'online' ? 'online' : 'offline',
        lastSeen: d.lastSeen,
        siteId: d.siteId,
        siteName: d.siteName,
        customer: owner ? { id: owner._id, name: owner.name, email: owner.email, plan: owner.plan || 'free' } : null,
        openAlerts: alertsByAgent.get(d.agentId) || 0,
        overLimit: Boolean(d.overLimit),
        storage: d.storage ?? null,
      };
    });

    const { search, status, siteId, alerts, overLimit } = req.query;
    const term = search ? new RegExp(escapeRegex(search), 'i') : null;
    const filtered = rows.filter((r) =>
      (!term || term.test(r.hostname || '') || term.test(r.siteName || '') || term.test(r.customer?.email || '') || term.test(r.customer?.name || ''))
      && (!status || r.status === status)
      && (!siteId || r.siteId === Number(siteId))
      && (alerts !== 'open' || r.openAlerts > 0)
      && (overLimit !== 'true' || r.overLimit));

    res.json({
      success: true,
      summary: {
        total: rows.length,
        online: rows.filter((r) => r.status === 'online').length,
        offline: rows.filter((r) => r.status === 'offline').length,
        withAlerts: rows.filter((r) => r.openAlerts > 0).length,
        overLimit: rows.filter((r) => r.overLimit).length,
        unlinkedSites: sites.filter((s) => !userBySite.has(s.id)).length,
        lastSyncAt: all.reduce((latest, d) => (d.updatedAt > latest ? d.updatedAt : latest), null),
      },
      sync: getSyncStatus(),
      sites: sites.map((s) => ({ id: s.id, name: s.name, linkedUser: userBySite.get(s.id)?.email || null })),
      devices: filtered,
      // Moving devices between Sites is done in Tactical RMM (this API key can't edit agents);
      // ownership here follows automatically on the next sync.
      tacticalUrl: (process.env.RMM_WEB_URL || '').replace(/\/$/, '') || null,
    });
  } catch (err) {
    res.status(err.status || err.response?.status || 500).json({ success: false, message: err.message });
  }
};

// GET /devices/audit?limit=50&before=<ISO date> — RMM activity: installer links,
// Site links, remote actions (sent and refused), removals, limit alerts.
exports.getAuditLog = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const filter = { module: 'rmm', action: { $nin: ['RMM_DEVICE_SYNC_ERROR', 'RMM_DEVICE_DETAIL_ERROR'] } };
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };

    const entries = await SystemLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({
      success: true,
      entries: entries.map((e) => ({
        id: e._id,
        at: e.createdAt || e.loggedAt,
        action: e.action,
        type: e.type,
        by: e.userEmail || null,
        details: e.details,
      })),
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};
