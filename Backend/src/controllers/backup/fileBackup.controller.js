const FileBackup = require('../../models/backup/FileBackup');
const FileBackupSchedule = require('../../models/backup/FileBackupSchedule');
const tacticalService = require('../../services/tacticalRmm.service');
const { getUserSiteId } = require('../../utils/rmmTenancy');
const fileBackups = require('../../utils/fileBackups');

const sendError = (res, err, fallback) =>
  res.status(err.status || err.response?.status || 500).json({ success: false, message: err.status ? err.message : fallback });

const toDto = (b) => ({
  id: b._id,
  agentId: b.agentId,
  hostname: b.hostname,
  folders: b.folders,
  trigger: b.trigger,
  status: b.status,
  error: b.error,
  size: b.size,
  fileCount: b.fileCount,
  skippedCount: b.skippedCount,
  createdAt: b.createdAt,
  completedAt: b.completedAt,
});

// Only devices in the caller's own linked Site, for staff too: a backup holds
// the device owner's private files, so nobody else may start one.
const loadOwnedAgent = async (req, agentId) => {
  const siteId = await getUserSiteId(req.user.id);
  const agent = siteId && agentId
    ? await tacticalService.getAgent(agentId).catch((err) => {
      if (err.response?.status === 404) return null;
      throw err;
    })
    : null;
  if (!agent || Number(agent.site) !== Number(siteId)) throw Object.assign(new Error('Device not found'), { status: 404 });
  return agent;
};

const loadOwnBackup = async (req) => {
  const backup = await FileBackup.findOne({ _id: req.params.id, user: req.user.id }).catch(() => null);
  if (!backup) throw Object.assign(new Error('Backup not found'), { status: 404 });
  return backup;
};

// GET /file-backups — the caller's backups, storage use and schedules.
exports.listFileBackups = async (req, res) => {
  try {
    const [backups, usage, schedules] = await Promise.all([
      FileBackup.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean(),
      fileBackups.getUsage(req.user.id),
      FileBackupSchedule.find({ user: req.user.id }).lean(),
    ]);
    res.json({
      success: true,
      backups: backups.map(toDto),
      usage,
      folders: fileBackups.FOLDERS,
      keepPerDevice: fileBackups.KEEP_PER_DEVICE,
      schedules: schedules.map((s) => ({ agentId: s.agentId, folders: s.folders, enabled: s.enabled, lastRunAt: s.lastRunAt })),
    });
  } catch (err) {
    sendError(res, err, 'Failed to load backups');
  }
};

// POST /file-backups { agentId, folders }
exports.startFileBackup = async (req, res) => {
  try {
    const agent = await loadOwnedAgent(req, req.body?.agentId);
    const backup = await fileBackups.startFileBackup({ agent, userId: req.user.id, folders: req.body?.folders });
    res.status(201).json({ success: true, backup: toDto(backup) });
  } catch (err) {
    sendError(res, err, 'Failed to start the backup');
  }
};

// PUT /file-backups/schedule { agentId, folders, enabled }
exports.setSchedule = async (req, res) => {
  try {
    const agent = await loadOwnedAgent(req, req.body?.agentId);
    const enabled = Boolean(req.body?.enabled);
    if (enabled && agent.plat !== 'windows') {
      return res.status(400).json({ success: false, message: 'File backup is available for Windows computers only.' });
    }
    const folders = fileBackups.normalizeFolders(req.body?.folders);
    const schedule = await FileBackupSchedule.findOneAndUpdate(
      { user: req.user.id, agentId: agent.agent_id },
      { $set: { folders, enabled } },
      { upsert: true, returnDocument: 'after' }
    ).lean();
    res.json({ success: true, schedule: { agentId: schedule.agentId, folders: schedule.folders, enabled: schedule.enabled, lastRunAt: schedule.lastRunAt } });
  } catch (err) {
    sendError(res, err, 'Failed to save the schedule');
  }
};

// GET /file-backups/:id/download — one zip, rebuilt from the stored parts.
exports.downloadFileBackup = async (req, res) => {
  try {
    const backup = await loadOwnBackup(req);
    if (backup.status !== 'completed') return res.status(409).json({ success: false, message: 'This backup is not finished.' });

    const day = new Date(backup.completedAt || backup.createdAt).toISOString().slice(0, 10);
    const host = String(backup.hostname || 'device').replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', String(backup.size));
    res.setHeader('Content-Disposition', `attachment; filename="backup-${host}-${day}.zip"`);
    await fileBackups.streamBackup(backup, res);
  } catch (err) {
    if (res.headersSent) return res.destroy(err);
    sendError(res, err, 'Failed to download the backup');
  }
};

// DELETE /file-backups/:id
exports.deleteFileBackup = async (req, res) => {
  try {
    const backup = await loadOwnBackup(req);
    if (['pending', 'running'].includes(backup.status)) {
      return res.status(409).json({ success: false, message: 'A backup in progress cannot be deleted.' });
    }
    await fileBackups.deleteBackup(backup);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'Failed to delete the backup');
  }
};

// ── Device endpoints (X-Backup-Token, no login) ──────────────────────────────

const loadByToken = async (req, res) => {
  const backup = await fileBackups.findByToken(req.get('X-Backup-Token'));
  if (!backup) res.status(401).json({ success: false, message: 'Invalid or expired backup token' });
  return backup;
};

// PUT /file-backups/agent/parts/:index (application/octet-stream)
exports.agentUploadPart = async (req, res) => {
  try {
    const backup = await loadByToken(req, res);
    if (!backup) return;
    await fileBackups.receivePart(backup, Number(req.params.index), Buffer.isBuffer(req.body) ? req.body : null);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'Failed to store the part');
  }
};

// POST /file-backups/agent/status { status, error?, parts?, fileCount?, skippedCount? }
exports.agentReportStatus = async (req, res) => {
  try {
    const backup = await loadByToken(req, res);
    if (!backup) return;
    await fileBackups.reportStatus(backup, req.body || {});
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'Failed to update the backup');
  }
};
