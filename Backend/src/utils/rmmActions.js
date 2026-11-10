const RmmAction = require('../models/rmm/RmmAction');
const tacticalService = require('../services/tacticalRmm.service');
const gz = require('./gravityZoneClient');

// Remote actions customers may run on their own online devices. Restart and
// cleanup run built-in Tactical RMM library scripts (this API key may run
// scripts but not raw commands or reboots); the antivirus scan uses Bitdefender
// GravityZone. There is deliberately no free-form command execution.
const MINUTE = 60 * 1000;
const CUSTOMER_ACTIONS_PER_HOUR = 10;

const ACTIONS = {
  restart: {
    label: 'Restart',
    description: 'Restarts the computer after a 60-second on-screen warning. Unsaved work may be lost.',
    platforms: ['windows'],
    cooldownMs: 30 * MINUTE,
    scriptIdEnv: 'RMM_SCRIPT_RESTART_ID',
    args: ['-Wait 60'],
    timeout: 90,
  },
  'disk-cleanup': {
    label: 'Clean up disk',
    description: 'Deletes Windows temp files, the Windows Update download cache and user temp files older than 7 days, and empties the Recycle Bin.',
    platforms: ['windows'],
    cooldownMs: 6 * 60 * MINUTE,
    scriptIdEnv: 'RMM_SCRIPT_CLEANUP_ID',
    args: [],
    timeout: 1800,
  },
  'antivirus-scan': {
    label: 'Antivirus quick scan',
    description: 'Starts a Bitdefender quick scan. The computer stays usable while it runs.',
    platforms: ['windows', 'darwin'],
    cooldownMs: 60 * MINUTE,
  },
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

const lastRun = (agentId, action) =>
  RmmAction.findOne({ agentId, action, status: 'sent' }).sort({ createdAt: -1 }).lean();

// Actions offered for a device, with how long each must still wait.
const availableActions = async (agentId, platform) => {
  const result = [];
  for (const [key, def] of Object.entries(ACTIONS)) {
    if (!def.platforms.includes(platform)) continue;
    if (def.scriptIdEnv && !Number(process.env[def.scriptIdEnv])) continue;
    const last = await lastRun(agentId, key);
    const waitMs = last ? Math.max(0, new Date(last.createdAt).getTime() + def.cooldownMs - Date.now()) : 0;
    result.push({ key, label: def.label, description: def.description, availableInSeconds: Math.ceil(waitMs / 1000) });
  }
  return result;
};

// GravityZone names a Mac "Name-MacBook" where Tactical says "Name-MacBook.local".
const normalizeHost = (name) => String(name || '').trim().toLowerCase().replace(/\.local$/, '');

const startBitdefenderScan = async (agent) => {
  const endpoints = await gz.getAllEndpoints({ parentId: process.env.CYBERSHIELD_SOLO_ID, isManaged: true });
  const endpoint = endpoints.find((e) => normalizeHost(e.name) === normalizeHost(agent.hostname));
  if (!endpoint) throw httpError(409, 'Bitdefender is not installed or not reporting on this device.');
  const task = await gz.createScanTask({ endpointId: endpoint.id, type: 1, name: `Portal quick scan ${agent.hostname}` });
  return String(task?.taskId || task?.id || task || '');
};

// Validates and runs an action. Callers must already have checked ownership and
// the write safety lock for the agent's Site.
const runAction = async ({ agent, action, requester }) => {
  const def = ACTIONS[action];
  if (!def) throw httpError(400, 'Unknown action');
  if (!def.platforms.includes(agent.plat)) throw httpError(400, `${def.label} is not available for this device`);
  if (agent.status !== 'online') throw httpError(409, 'The device must be online to run this action.');

  const last = await lastRun(agent.agent_id, action);
  if (last && Date.now() - new Date(last.createdAt).getTime() < def.cooldownMs) {
    throw httpError(429, `${def.label} was run recently on this device. Please try again later.`);
  }
  if (!requester.isStaff) {
    const recent = await RmmAction.countDocuments({ requestedBy: requester.id, createdAt: { $gt: new Date(Date.now() - 60 * MINUTE) } });
    if (recent >= CUSTOMER_ACTIONS_PER_HOUR) throw httpError(429, 'Too many actions in the last hour. Please try again later.');
  }

  const record = {
    agentId: agent.agent_id,
    hostname: agent.hostname,
    siteId: agent.site,
    action,
    requestedBy: requester.id,
    requestedByRole: requester.role,
  };

  try {
    let reference = null;
    if (def.scriptIdEnv) {
      const scriptId = Number(process.env[def.scriptIdEnv]);
      if (!scriptId) throw httpError(503, `${def.label} is not configured (${def.scriptIdEnv}).`);
      await tacticalService.runScript(agent.agent_id, scriptId, def.args, def.timeout);
    } else {
      reference = await startBitdefenderScan(agent);
    }
    return await RmmAction.create({ ...record, status: 'sent', reference });
  } catch (error) {
    await RmmAction.create({ ...record, status: 'failed', error: error.message });
    throw error;
  }
};

module.exports = { ACTIONS, availableActions, runAction };
