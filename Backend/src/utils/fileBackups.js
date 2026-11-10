const crypto = require('crypto');
const FileBackup = require('../models/backup/FileBackup');
const FileBackupSchedule = require('../models/backup/FileBackupSchedule');
const UserManagement = require('../models/user-management/User');
const tacticalService = require('../services/tacticalRmm.service');
const storage = require('./backupStorage');
const { assertSiteWritable } = require('./rmmTenancy');
const { getBackupLimit } = require('./planLimits');
const systemLogger = require('./systemLogger');

// Customers back up files from their own computers. The portal runs the
// Tactical RMM script "scripts/rmm/file-backup.ps1" (RMM_SCRIPT_FILE_BACKUP_ID)
// on the device; it zips the chosen folders of the signed-in Windows user and
// PUTs the zip in parts to /api/file-backups/agent/*, authenticated by a
// one-time token that only works for this backup. Parts go to Cloudinary
// (utils/backupStorage.js) and count towards the plan's storage limit.

const MB = 1024 * 1024;
const HOUR = 60 * 60 * 1000;

const FOLDERS = ['Documents', 'Desktop', 'Pictures'];
const KEEP_PER_DEVICE = 2; // older completed backups of a device are removed
const TOKEN_TTL_MS = 6 * HOUR;
const SCRIPT_TIMEOUT_S = 3 * 60 * 60;
const PART_BYTES = (Number(process.env.BACKUP_PART_MB) || 9) * MB; // Cloudinary free plan: 10 MB per raw file
const SCHEDULE_INTERVAL_MS = 7 * 24 * HOUR;

const ACTIVE = ['pending', 'running'];

const httpError = (status, message) => Object.assign(new Error(message), { status });
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const normalizeFolders = (folders) => {
  const list = [...new Set((Array.isArray(folders) ? folders : []).map(String))];
  if (!list.length) throw httpError(400, 'Choose at least one folder to back up.');
  const unknown = list.filter((f) => !FOLDERS.includes(f));
  if (unknown.length) throw httpError(400, `Unknown folder: ${unknown.join(', ')}`);
  return list;
};

// Completed backups of a device that a new backup will replace.
const replaceableBackups = async (userId, agentId) =>
  (await FileBackup.find({ user: userId, agentId, status: 'completed' }).sort({ createdAt: -1 }).lean())
    .slice(KEEP_PER_DEVICE - 1);

const getUsage = async (userId) => {
  const user = await UserManagement.findById(userId).select('plan').lean();
  const [row] = await FileBackup.aggregate([
    { $match: { user: user?._id || null, status: { $in: ['completed', 'running'] } } },
    { $group: { _id: null, used: { $sum: '$size' } } },
  ]);
  return { plan: user?.plan || 'free', used: row?.used || 0, limit: getBackupLimit(user?.plan) };
};

const removeStoredParts = async (backup) => {
  try {
    await storage.deletePrefix(storage.backupPrefix(backup.user, backup._id));
  } catch (error) {
    await systemLogger({
      type: 'warning', action: 'FILE_BACKUP_DELETE_FAILED', user: backup.user,
      details: `Could not delete stored parts of backup ${backup._id}: ${error.message}`, module: 'backup',
    });
  }
};

const failBackup = async (backup, message) => {
  await FileBackup.updateOne(
    { _id: backup._id },
    { $set: { status: 'failed', error: String(message).slice(0, 500), tokenHash: null, tokenExpiresAt: null } }
  );
  if (backup.parts?.length) await removeStoredParts(backup);
};

// Starts a backup on `agent` (a full Tactical agent detail). Callers must have
// checked that `userId` owns the agent.
const startFileBackup = async ({ agent, userId, folders, trigger = 'manual' }) => {
  const chosen = normalizeFolders(folders);
  if (agent.plat !== 'windows') throw httpError(400, 'File backup is available for Windows computers only.');
  if (agent.status !== 'online') throw httpError(409, 'The device must be online to back it up.');

  const scriptId = Number(process.env.RMM_SCRIPT_FILE_BACKUP_ID);
  const apiUrl = String(process.env.BACKEND_PUBLIC_URL || '').replace(/\/$/, '');
  if (!scriptId || !apiUrl) throw httpError(503, 'File backup is not configured yet. Please contact support.');

  if (await FileBackup.exists({ user: userId, agentId: agent.agent_id, status: { $in: ACTIVE } })) {
    throw httpError(409, 'A backup of this device is already in progress.');
  }

  const { used, limit } = await getUsage(userId);
  const freed = (await replaceableBackups(userId, agent.agent_id)).reduce((sum, b) => sum + (b.size || 0), 0);
  const maxBytes = limit - (used - freed);
  if (maxBytes <= 0) {
    throw httpError(409, 'Your backup storage is full. Delete an old backup or upgrade your plan.');
  }

  assertSiteWritable(agent.site);

  const token = crypto.randomBytes(32).toString('hex');
  const backup = await FileBackup.create({
    user: userId,
    agentId: agent.agent_id,
    hostname: agent.hostname,
    siteId: agent.site,
    folders: chosen,
    trigger,
    tokenHash: hashToken(token),
    tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    maxBytes,
  });

  try {
    await tacticalService.runScript(agent.agent_id, scriptId, [
      `-ApiUrl ${apiUrl}`,
      `-Token ${token}`,
      `-Folders ${chosen.join(',')}`,
      `-MaxBytes ${maxBytes}`,
      `-PartBytes ${PART_BYTES}`,
    ], SCRIPT_TIMEOUT_S);
  } catch (error) {
    await failBackup(backup, 'Could not reach the device.');
    throw error;
  }

  await systemLogger({
    type: 'info', action: 'FILE_BACKUP_STARTED', user: userId,
    details: `${trigger} backup ${backup._id} of ${agent.hostname} (${chosen.join(', ')}), up to ${Math.floor(maxBytes / MB)} MB`,
    module: 'backup',
  });
  return FileBackup.findById(backup._id).lean();
};

// ── Device side (token-authenticated) ─────────────────────────────────────────

const findByToken = async (token) => {
  if (!token) return null;
  return FileBackup.findOne({
    tokenHash: hashToken(token),
    tokenExpiresAt: { $gt: new Date() },
    status: { $in: ACTIVE },
  });
};

// Parts arrive in order; resending the last part (a retry) replaces it.
const receivePart = async (backup, index, buffer) => {
  if (!Number.isInteger(index) || index < 0) throw httpError(400, 'Invalid part number');
  if (!buffer?.length) throw httpError(400, 'Empty part');
  if (buffer.length > PART_BYTES) throw httpError(413, 'Part too large');

  const parts = [...backup.parts];
  if (index < parts.length - 1 || index > parts.length) throw httpError(409, `Expected part ${parts.length}`);
  const replaced = index === parts.length - 1 ? parts.pop() : null;

  const size = backup.size - (replaced?.size || 0) + buffer.length;
  if (size > backup.maxBytes) {
    await failBackup(backup, 'The files are larger than your remaining backup storage.');
    throw httpError(413, 'Backup storage limit exceeded');
  }

  const publicId = `${storage.backupPrefix(backup.user, backup._id)}part-${String(index).padStart(4, '0')}`;
  await storage.putPart(publicId, buffer);

  parts.push({ index, publicId, size: buffer.length });
  backup.parts = parts;
  backup.size = size;
  backup.status = 'running';
  await backup.save();
};

const reportStatus = async (backup, { status, error, parts, fileCount, skippedCount }) => {
  if (status === 'running') {
    backup.status = 'running';
    await backup.save();
    return;
  }
  if (status === 'failed') {
    await failBackup(backup, error || 'The backup failed on the device.');
    await systemLogger({ type: 'warning', action: 'FILE_BACKUP_FAILED', user: backup.user, details: `Backup ${backup._id} of ${backup.hostname}: ${error}`, module: 'backup' });
    return;
  }
  if (status !== 'completed') throw httpError(400, 'Unknown status');

  if (!backup.parts.length || Number(parts) !== backup.parts.length) {
    await failBackup(backup, 'The upload was incomplete.');
    throw httpError(409, 'Part count does not match');
  }

  const replaced = await replaceableBackups(backup.user, backup.agentId);
  backup.status = 'completed';
  backup.completedAt = new Date();
  backup.fileCount = Number.isFinite(Number(fileCount)) ? Number(fileCount) : null;
  backup.skippedCount = Number.isFinite(Number(skippedCount)) ? Number(skippedCount) : null;
  backup.tokenHash = null;
  backup.tokenExpiresAt = null;
  await backup.save();

  for (const old of replaced) await deleteBackup(old);

  await systemLogger({
    type: 'info', action: 'FILE_BACKUP_COMPLETED', user: backup.user,
    details: `Backup ${backup._id} of ${backup.hostname}: ${Math.ceil(backup.size / MB)} MB, ${backup.fileCount ?? '?'} files`,
    module: 'backup',
  });
};

// ── Customer side ─────────────────────────────────────────────────────────────

const deleteBackup = async (backup) => {
  await removeStoredParts(backup);
  await FileBackup.deleteOne({ _id: backup._id });
};

// Sends the parts back to back, which recreates the original zip.
const streamBackup = async (backup, res) => {
  const parts = [...backup.parts].sort((a, b) => a.index - b.index);
  for (const part of parts) {
    const stream = await storage.getPartStream(part.publicId);
    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(res, { end: false });
    });
  }
  res.end();
};

// ── Scheduled work ────────────────────────────────────────────────────────────

// Backups the device never finished (switched off, script killed) are failed
// once their token expires, and their uploaded parts removed.
const expireStaleBackups = async (now = new Date()) => {
  const stale = await FileBackup.find({ status: { $in: ACTIVE }, tokenExpiresAt: { $lte: now } }).lean();
  for (const backup of stale) await failBackup(backup, 'The device did not finish the backup in time.');
  return stale.length;
};

// Weekly automatic backups. A device that is offline is tried again on the
// next run; a device that no longer belongs to the customer is skipped.
const runScheduledBackups = async (now = new Date()) => {
  const due = await FileBackupSchedule.find({
    enabled: true,
    $or: [{ lastRunAt: null }, { lastRunAt: { $lte: new Date(now.getTime() - SCHEDULE_INTERVAL_MS) } }],
  }).lean();

  let started = 0;
  for (const schedule of due) {
    try {
      const user = await UserManagement.findById(schedule.user).select('rmm').lean();
      const agent = await tacticalService.getAgent(schedule.agentId).catch(() => null);
      if (!agent || !user?.rmm?.siteId || Number(agent.site) !== Number(user.rmm.siteId)) continue;
      if (agent.status !== 'online') continue;

      await startFileBackup({ agent, userId: schedule.user, folders: schedule.folders, trigger: 'schedule' });
      await FileBackupSchedule.updateOne({ _id: schedule._id }, { $set: { lastRunAt: now } });
      started += 1;
    } catch (error) {
      // Full storage or a backup already running: wait a week rather than retry every run.
      if (error.status === 409) await FileBackupSchedule.updateOne({ _id: schedule._id }, { $set: { lastRunAt: now } });
      await systemLogger({
        type: 'warning', action: 'FILE_BACKUP_SCHEDULE_FAILED', user: schedule.user,
        details: `Scheduled backup of ${schedule.agentId}: ${error.message}`, module: 'backup',
      });
    }
  }
  return started;
};

module.exports = {
  FOLDERS,
  KEEP_PER_DEVICE,
  PART_BYTES,
  normalizeFolders,
  getUsage,
  startFileBackup,
  findByToken,
  receivePart,
  reportStatus,
  deleteBackup,
  streamBackup,
  expireStaleBackups,
  runScheduledBackups,
};
