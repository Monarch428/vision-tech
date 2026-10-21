const cron = require('node-cron');
const RmmDevice = require('../models/rmm/RmmDevice');
const UserManagement = require('../models/user-management/User');
const tacticalService = require('../services/tacticalRmm.service');
const { getRmmClientId } = require('../utils/rmmTenancy');
const { getDeviceLimit, describeLimit } = require('../utils/planLimits');
const notifyStaff = require('../utils/notifyStaff');
const systemLogger = require('../utils/systemLogger');
const { evaluateDeviceAlerts, resolveAlertsForRemovedDevices, notifyNewAlerts } = require('../utils/rmmAlerts');

// Read-only towards Tactical RMM. Every run (2 min): mirrors our Client's
// agents into RmmDevice, refreshes metrics + check results for devices older
// than METRICS_MAX_AGE_MS, opens/resolves alerts, and flags devices beyond each
// customer's plan limit (policy A1: flag and notify staff, never uninstall).
const METRICS_MAX_AGE_MS = 10 * 60 * 1000;
const DETAIL_CONCURRENCY = 5;

const toPercent = (value) => (Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null);

// Metrics from a full agent detail. CPU/memory come from Windows WMI only.
// Storage is the system drive (what disk cleanup frees); the fullest drive is
// kept separately so a nearly full data drive is still reported.
const metricsFromDetail = (detail) => {
  const wmiCpu = detail.wmi_detail?.cpu?.[0]?.[0];
  const wmiOs = detail.wmi_detail?.os?.[0]?.[0];
  const memory = wmiOs?.TotalVisibleMemorySize && wmiOs?.FreePhysicalMemory
    ? (1 - wmiOs.FreePhysicalMemory / wmiOs.TotalVisibleMemorySize) * 100
    : null;
  const disks = (detail.disks || []).filter((d) => Number.isFinite(Number(d.percent)));
  const isSystem = (d) => /^c:?\\?$/i.test(String(d.device).trim()) || String(d.device).trim() === '/';
  const system = disks.find(isSystem) || disks[0];
  const fullest = disks.reduce((max, d) => (!max || Number(d.percent) > Number(max.percent) ? d : max), null);
  return {
    os: detail.operating_system || null,
    cpuModel: Array.isArray(detail.cpu_model) ? detail.cpu_model.join(', ') : detail.cpu_model || null,
    totalRamGb: Number.isFinite(detail.total_ram) ? detail.total_ram : null,
    cpu: toPercent(wmiCpu?.LoadPercentage),
    memory: toPercent(memory),
    storage: system ? toPercent(Number(system.percent)) : null,
    storageDevice: system ? String(system.device) : null,
    fullestDisk: fullest ? { device: String(fullest.device), percent: toPercent(Number(fullest.percent)) } : { device: null, percent: null },
  };
};

const checksFromTactical = (checks) => checks.map((c) => ({
  checkId: c.id,
  checkType: c.check_type,
  title: c.readable_desc || c.name || c.check_type,
  status: c.check_result?.status || 'pending',
  severity: c.alert_severity || 'warning',
}));

const refreshDeviceDetails = async (device) => {
  try {
    const [detail, checks] = await Promise.all([
      tacticalService.getAgent(device.agentId),
      tacticalService.getAgentChecks(device.agentId),
    ]);
    Object.assign(device, metricsFromDetail(detail), { checks: checksFromTactical(checks), metricsUpdatedAt: new Date() });
    await device.save();
  } catch (error) {
    await systemLogger({
      type: 'warning', action: 'RMM_DEVICE_DETAIL_ERROR',
      details: `${device.hostname || device.agentId}: ${error.message}`, module: 'rmm',
    });
  }
};

// Runs `task` over `items` with at most `limit` in flight (keeps Tactical RMM load bounded).
const runLimited = async (items, limit, task) => {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await task(queue.shift());
  });
  await Promise.all(workers);
};

// Flags the newest devices beyond the user's plan limit; earlier ones stay in.
const enforceDeviceLimit = async (user) => {
  const limit = getDeviceLimit(user.plan);
  const devices = await RmmDevice.find({ user: user._id, removedAt: null }).sort({ firstSeenAt: 1, hostname: 1 });
  const newlyOver = [];

  for (const [index, device] of devices.entries()) {
    const over = index >= limit;
    if (device.overLimit !== over) {
      device.overLimit = over;
      if (!over) device.overLimitNotifiedAt = null;
      await device.save();
    }
    if (over && !device.overLimitNotifiedAt) newlyOver.push(device);
  }

  if (newlyOver.length) {
    const names = newlyOver.map((d) => d.hostname || d.agentId).join(', ');
    await systemLogger({
      type: 'warning', action: 'RMM_DEVICE_OVER_LIMIT', user: user._id, userEmail: user.email,
      details: `${user.email} has ${devices.length} devices on the ${user.plan || 'free'} plan (${describeLimit(user.plan)}). Over limit: ${names}`,
      module: 'rmm',
    });
    await notifyStaff({
      subject: `Device limit exceeded: ${user.email}`,
      html: `<p><strong>${user.name || user.email}</strong> has ${devices.length} monitored devices on the
        <strong>${user.plan || 'free'}</strong> plan (${describeLimit(user.plan)}).</p>
        <p>Over the limit: ${names}</p><p>No device was uninstalled automatically.</p>`,
    });
    await RmmDevice.updateMany({ _id: { $in: newlyOver.map((d) => d._id) } }, { $set: { overLimitNotifiedAt: new Date() } });
  }
};

let currentRun = null; // in-flight sync, so callers can await it instead of starting another

// Health of the sync, so pages can say when cached data is old and a Tactical
// outage doesn't produce an error every 2 minutes (exponential back-off).
const STALE_AFTER_MS = 10 * 60 * 1000;
const MAX_BACKOFF_MS = 30 * 60 * 1000;
const syncState = { lastSuccessAt: null, lastError: null, consecutiveFailures: 0, nextAttemptAt: 0, sites: null };

// Site list from the last successful sync (staff console reads this instead of calling Tactical).
const getCachedSites = () => syncState.sites;

const getSyncStatus = () => ({
  lastSuccessAt: syncState.lastSuccessAt,
  stale: !syncState.lastSuccessAt || Date.now() - syncState.lastSuccessAt.getTime() > STALE_AFTER_MS,
  lastError: syncState.lastError,
});

const syncRmmDevices = ({ force = false } = {}) => {
  if (currentRun) return currentRun;
  if (!force && Date.now() < syncState.nextAttemptAt) return Promise.resolve();
  currentRun = runSync().finally(() => { currentRun = null; });
  return currentRun;
};

const runSync = async () => {
  try {
    const clientId = getRmmClientId();
    const [sites, agents] = await Promise.all([
      tacticalService.listSites(clientId),
      tacticalService.listAgentsByClient(clientId, { detail: false }),
    ]);
    // Site names are unique within a Tactical RMM client; the agent list only carries the name.
    const siteIdByName = new Map(sites.map((s) => [s.name, s.id]));
    const users = await UserManagement.find({ 'rmm.siteId': { $in: sites.map((s) => s.id) } })
      .select('name email plan rmm')
      .lean();
    const userBySite = new Map(users.map((u) => [u.rmm.siteId, u]));

    const seen = [];
    for (const agent of agents) {
      const siteId = siteIdByName.get(agent.site_name);
      if (!siteId) continue;
      seen.push(agent.agent_id);
      await RmmDevice.updateOne(
        { agentId: agent.agent_id },
        {
          $set: {
            siteId,
            siteName: agent.site_name,
            user: userBySite.get(siteId)?._id || null,
            hostname: agent.hostname || null,
            serialNumber: agent.serial_number || null,
            platform: agent.plat || null,
            status: agent.status || null,
            lastSeen: agent.last_seen ? new Date(agent.last_seen) : null,
            removedAt: null,
          },
          $setOnInsert: { firstSeenAt: new Date() },
        },
        { upsert: true }
      );
    }

    const gone = await RmmDevice.find({ agentId: { $nin: seen }, removedAt: null }).select('agentId').lean();
    if (gone.length) {
      await RmmDevice.updateMany({ _id: { $in: gone.map((d) => d._id) } }, { $set: { removedAt: new Date(), overLimit: false } });
      await resolveAlertsForRemovedDevices(gone.map((d) => d.agentId));
    }

    // Metrics and checks: only devices whose cached data is stale.
    const staleBefore = new Date(Date.now() - METRICS_MAX_AGE_MS);
    const stale = await RmmDevice.find({
      removedAt: null,
      $or: [{ metricsUpdatedAt: null }, { metricsUpdatedAt: { $lt: staleBefore } }],
    });
    await runLimited(stale, DETAIL_CONCURRENCY, refreshDeviceDetails);

    // Alerts. A device's first evaluation (with checks known) is a silent baseline.
    const newAlerts = [];
    for (const device of await RmmDevice.find({ removedAt: null })) {
      const checksKnown = Boolean(device.metricsUpdatedAt);
      newAlerts.push(...(await evaluateDeviceAlerts(device, { checksKnown })));
      if (checksKnown && !device.alertsInitializedAt) {
        device.alertsInitializedAt = new Date();
        await device.save();
      }
    }
    await notifyNewAlerts(newAlerts);

    syncState.sites = sites;
    syncState.lastSuccessAt = new Date();
    syncState.lastError = null;
    syncState.consecutiveFailures = 0;
    syncState.nextAttemptAt = 0;

    for (const user of users) {
      await enforceDeviceLimit(user);
    }
  } catch (error) {
    syncState.consecutiveFailures += 1;
    syncState.lastError = error.message;
    const backoff = Math.min(2 * 60 * 1000 * 2 ** syncState.consecutiveFailures, MAX_BACKOFF_MS);
    syncState.nextAttemptAt = Date.now() + backoff;
    await systemLogger({
      type: 'error', action: 'RMM_DEVICE_SYNC_ERROR', module: 'rmm',
      details: `${error.message} (failure ${syncState.consecutiveFailures}; next attempt in ${Math.round(backoff / 60000)} min)`,
    });
  }
};

const startRmmDeviceSync = () => {
  if (!process.env.RMM_CLIENT_ID) {
    console.warn('[RMM Sync] RMM_CLIENT_ID not set; device sync disabled');
    return;
  }
  syncRmmDevices();
  cron.schedule('*/2 * * * *', syncRmmDevices);
};

module.exports = { startRmmDeviceSync, syncRmmDevices, enforceDeviceLimit, getSyncStatus, getCachedSites };
