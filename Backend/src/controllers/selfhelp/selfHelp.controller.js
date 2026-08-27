const SelfHelpTool = require('../../models/tools/SelfHelpTool');
const DeviceAntivirus = require('../../models/tools/SelfHelpTool');
const fs = require('fs');
const path = require('path');
const { runBackup, backupDir } = require('../../cron/autoBackup');
const systemLogger = require("../../utils/systemLogger");
const rmm = require('../../utils/tacticalRmmClient');
const gz = require('../../utils/gravityZoneClient');

const categoryMap = {
  'browser-cleanup': 'browser',
  'network-restart': 'network',
  'antivirus-scan': 'security',
  'start-backup': 'backup',
};

// GravityZone installation package to push to devices. Create this once in
// Control Center (Network > Packages) or via gz.createPackage(), then set
// the resulting packageId here.
//
// NOTE: .trim() this — a stray trailing space/newline copied into .env is
// a common, silent cause of GravityZone rejecting the request with
// "Invalid params" (the packageId still reads as truthy, so the "not
// configured" guard below won't catch it).
const DEFAULT_PACKAGE_ID = process.env.BITDEFENDER_PACKAGE_ID?.trim();

// ─── Backup storage location ──────────────────────────────────────────────
const BACKUP_DIR = path.resolve(backupDir);

const resolveSafeBackupPath = (storedPath) => {
  if (!storedPath) return null;
  const resolved = path.resolve(storedPath);
  if (!resolved.startsWith(BACKUP_DIR + path.sep) && resolved !== BACKUP_DIR) {
    return null;
  }
  return resolved;
};

// ─── getBitdefenderInstallStatus ────────────────────────────────────────────
// Polls GravityZone for the endpoint matching this device's hostname. Once
// found, caches the endpointId so startTool's antivirus branch can use it.
// No deviceId param — resolved from the logged-in user, same as install.
const getBitdefenderInstallStatus = async (req, res) => {
  try {
    const record = await DeviceAntivirus.findOne({ user: req.user.id });
    if (!record) {
      // No install record yet == not installed. Not an error state.
      return res.status(200).json({ success: true, device: null });
    }

    if (record.installStatus === 'installing') {
      try {
        const { items } = await gz.getEndpointsList({ filters: { name: record.hostname } });
        const match = (items || []).find(
          (e) => e.name?.toLowerCase() === record.hostname.toLowerCase()
        );

        if (match) {
          record.installStatus = 'installed';
          record.installCompletedAt = new Date();
          record.bitdefenderEndpointId = match.id;
          await record.save();
        }
      } catch (err) {
        console.warn('[getBitdefenderInstallStatus] GravityZone lookup failed:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      device: {
        hostname: record.hostname,
        installStatus: record.installStatus,
        bitdefenderEndpointId: record.bitdefenderEndpointId,
        installError: record.installError,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── startTool ────────────────────────────────────────────────────────────────
const startTool = async (req, res) => {
  try {
    const { toolId } = req.body;
    const category = categoryMap[toolId];
    if (!category) {
      return res.status(400).json({ success: false, message: 'Invalid tool' });
    }

    const record = await SelfHelpTool.create({
      user: req.user.id,
      category,
      scanStartedAt: new Date(),
      progress: 0,
      status: 'pending',
    });

    if (toolId === 'browser-cleanup' || toolId === 'network-restart') {
      await SelfHelpTool.findByIdAndUpdate(record._id, {
        progress: 100,
        status: 'completed',
        scanFinishedAt: new Date(),
      });

      return res.status(200).json({
        success: true,
        tool: { ...record.toObject(), progress: 100, status: 'completed' },
      });
    }

    if (toolId === 'antivirus-scan') {
  // ─── Antivirus scan via GravityZone (Bitdefender) ───────────────────
  // Looked up by the logged-in user, not any RMM agent id — GravityZone
  // and Tactical RMM are unrelated here.
  try {
    const antivirusRecord = await DeviceAntivirus.findOne({ user: req.user.id });
    const endpointId = antivirusRecord?.bitdefenderEndpointId;
    if (!endpointId) {
      throw new Error('Bitdefender is not installed on your device yet.');
    }

    const task = await gz.createScanTask({ endpointId });
    const taskId = task?.taskId || task?.id || task;

    const updated = await SelfHelpTool.findByIdAndUpdate(
      record._id,
      { status: 'running', progress: 10, bitdefenderTaskId: taskId },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      tool: updated,
    });
  } catch (err) {
    console.error('[antivirus-scan] failed:', err.message);
    if (err.response) {
      console.error('[antivirus-scan] response status:', err.response.status);
      console.error('[antivirus-scan] response data:', JSON.stringify(err.response.data));
    }
    await SelfHelpTool.findByIdAndUpdate(record._id, { status: "failed" });
    return res.status(500).json({
      success: false,
      message: err.message || "Antivirus scan failed to start",
      debug: err.response?.data || err.message, // TEMPORARY — remove once fixed
    });
  }
}
    return res.status(200).json({ success: true, tool: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── getToolStatus ────────────────────────────────────────────────────────────
const getToolStatus = async (req, res) => {
  try {
    const tool = await SelfHelpTool.findById(req.params.id);
    if (!tool) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    if (tool.category === 'security') {
      // ─── Poll GravityZone for scan task completion ─────────────────────
      if (tool.status !== 'completed' && tool.status !== 'failed' && tool.bitdefenderTaskId) {
        try {
          const taskStatus = await gz.getTaskStatus(tool.bitdefenderTaskId);
          // Adjust these field reads once you've confirmed the actual
          // getTasksList response shape against your GravityZone instance.
          const isFinished = taskStatus?.status === 'finished' || taskStatus?.status === 3;
          const threatsDetected = taskStatus?.infectedItems ?? taskStatus?.threatsDetected ?? 0;
          const filesScanned = taskStatus?.scannedItems ?? null;

          if (isFinished) {
            const update = {
              status: 'completed',
              progress: 100,
              scanFinishedAt: new Date(),
              threatsDetected,
              filesScanned,
            };
            await SelfHelpTool.findByIdAndUpdate(tool._id, update);
            Object.assign(tool, update);
          } else {
            const update = { status: 'running', progress: Math.max(tool.progress, 50) };
            await SelfHelpTool.findByIdAndUpdate(tool._id, update);
            Object.assign(tool, update);
          }
        } catch (err) {
          console.warn('[getToolStatus] GravityZone task status check failed:', err.message);
        }
      }
      return res.status(200).json({
        success: true,
        data: {
          id: tool._id,
          category: tool.category,
          progress: tool.progress,
          status: tool.status,
          scanStartedAt: tool.scanStartedAt,
          scanFinishedAt: tool.scanFinishedAt,
        },
      });
    }

    if (tool.progress < 100) {
      tool.progress = Math.min(tool.progress + 20, 100);
      if (tool.progress === 100) {
        tool.scanFinishedAt = new Date();
        tool.status = 'completed';
      }
      await tool.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        id: tool._id,
        category: tool.category,
        progress: tool.progress,
        status: tool.progress === 100 ? 'completed' : 'running',
        scanStartedAt: tool.scanStartedAt,
        scanFinishedAt: tool.scanFinishedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── getEndpoints ─────────────────────────────────────────────────────────────
// Kept for admin-facing screens (e.g. an admin RMM device list). No longer
// used by the user-facing Self-Help antivirus card.
const getEndpoints = async (req, res) => {
  try {
    const response = await rmm.get('/agents/');
    return res.json({ success: true, agents: response.data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── getScanResults ───────────────────────────────────────────────────────────
const getScanResults = async (req, res) => {
  try {
    const records = await SelfHelpTool.find({ category: 'security' })
      .sort({ scanStartedAt: -1 })
      .limit(10)
      .populate('user', 'name email')
      .lean();

    return res.json({ success: true, result: { items: records, total: records.length } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── getScanReport ────────────────────────────────────────────────────────────
const getScanReport = async (req, res) => {
  try {
    let agentId = typeof req.query.agentId === 'string' && req.query.agentId.trim()
      ? req.query.agentId.trim()
      : null;

    if (!agentId) {
      const mostRecent = await SelfHelpTool.findOne({
        category: 'security',
        rmmAgentId: { $exists: true, $ne: null },
      })
        .sort({ scanStartedAt: -1 })
        .select('rmmAgentId')
        .lean();
      agentId = mostRecent?.rmmAgentId || null;
    }

    let agent = null;
    if (agentId) {
      try {
        const agentRes = await rmm.get(`/agents/${agentId}/`);
        agent = agentRes.data;
      } catch (err) {
        console.warn('[getScanReport] failed to fetch agent details from RMM:', err.message);
      }
    }

    const requestedUserId = typeof req.query.userId === 'string' && req.query.userId.trim()
      ? req.query.userId.trim()
      : null;

    const query = { category: 'security' };
    if (agentId) query.rmmAgentId = agentId;
    if (requestedUserId) query.user = requestedUserId;

    const scanRecords = await SelfHelpTool.find(query)
      .sort({ scanStartedAt: -1 })
      .populate('user', 'name email')
      .lean();

    const scans = scanRecords.map((r) => ({
      id: r._id,
      name: `SelfHelp_Scan_${r._id}`,
      startDate: r.scanStartedAt,
      requestedBy: r.user
        ? { id: r.user._id, name: r.user.name ?? null, email: r.user.email ?? null }
        : null,
      status:
        r.status === 'completed' ? '✅ Completed' :
          r.status === 'running' ? '🔄 Running' :
            r.status === 'pending' ? '⏳ Pending' : '❌ Failed',
      filesScanned: r.filesScanned ?? null,
      filesScannedAvailable: r.filesScanned != null && r.filesScanned > 0,
      threatsDetected: r.threatsDetected ?? 0,
    }));

    const completedRecords = scanRecords.filter((r) => r.status === 'completed');
    const mostRecentCompleted = completedRecords[0] || null;

    const allRecordsForAgent = agentId
      ? await SelfHelpTool.find({ category: 'security', rmmAgentId: agentId })
        .populate('user', 'name email')
        .lean()
      : scanRecords;

    const availableRequesters = Array.from(
      new Map(
        allRecordsForAgent
          .map((r) => (r.user ? { id: r.user._id, name: r.user.name ?? null, email: r.user.email ?? null } : null))
          .filter(Boolean)
          .map((u) => [u.id?.toString(), u])
      ).values()
    );

    const userLastScan = await SelfHelpTool.findOne({ user: req.user.id, category: 'security' }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      machine: agent ? {
        name: agent.hostname,
        ip: agent.local_ips ?? agent.public_ip ?? null,
        os: agent.operating_system ?? agent.plat ?? null,
        lastSeen: agent.last_seen,
        securityStatus: agent.status,
        infected: mostRecentCompleted ? (mostRecentCompleted.threatsDetected ?? 0) > 0 : false,
        detection: mostRecentCompleted ? (mostRecentCompleted.threatsDetected ?? 0) > 0 : false,
        agentVersion: agent.version ?? null,
        engineVersion: null,
        lastUpdate: agent.last_seen,
      } : null,
      stats: {
        totalScans: scanRecords.length,
        completedScans: completedRecords.length,
      },
      recentScan: mostRecentCompleted ? {
        taskId: mostRecentCompleted._id,
        taskName: `SelfHelp_Scan_${mostRecentCompleted._id}`,
        scanDate: mostRecentCompleted.scanStartedAt ?? null,
        scannedBy: mostRecentCompleted.user
          ? { id: mostRecentCompleted.user._id, name: mostRecentCompleted.user.name ?? null, email: mostRecentCompleted.user.email ?? null }
          : null,
        filesScanned: mostRecentCompleted.filesScanned ?? null,
        filesScannedAvailable: mostRecentCompleted.filesScanned != null && mostRecentCompleted.filesScanned > 0,
        threatsDetected: mostRecentCompleted.threatsDetected ?? 0,
      } : null,
      scans,
      availableRequesters,
      appliedUserFilter: requestedUserId,
      userLastScan: userLastScan ? {
        id: userLastScan._id,
        status: userLastScan.status,
        progress: userLastScan.progress,
        scanStartedAt: userLastScan.scanStartedAt,
        scanFinishedAt: userLastScan.scanFinishedAt,
        filesScanned: userLastScan.filesScanned ?? null,
        filesScannedAvailable: userLastScan.filesScanned != null && userLastScan.filesScanned > 0,
        threatsDetected: userLastScan.threatsDetected ?? 0,
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── startBackup ──────────────────────────────────────────────────────────────
const startBackup = async (req, res) => {
  try {
    const record = await SelfHelpTool.create({
      user: req.user.id,
      category: 'backup',
      scanStartedAt: new Date(),
      progress: 0,
      status: 'pending',
    });

    const backupResult = await runBackup();

    const backupPath =
      typeof backupResult === 'string' ? backupResult : backupResult?.backupPath ?? null;
    const collections = Array.isArray(backupResult?.collections) ? backupResult.collections : undefined;

    let fileSize = null;
    if (backupPath) {
      try {
        fileSize = fs.statSync(backupPath).size;
      } catch (statErr) {
        console.warn('[startBackup] Could not stat backup file:', statErr.message);
      }
    } else {
      console.warn('[startBackup] runBackup() did not return a usable backupPath:', backupResult);
    }

    await SelfHelpTool.findByIdAndUpdate(record._id, {
      progress: 100,
      status: 'completed',
      scanFinishedAt: new Date(),
      backupPath,
      backupFileName: backupPath ? path.basename(backupPath) : null,
      backupFileSize: fileSize,
    });

    return res.status(200).json({
      success: true,
      message: 'Backup completed',
      backupPath,
      collections,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── listBackups ──────────────────────────────────────────────────────────────
const listBackups = async (req, res) => {
  try {
    const backups = await SelfHelpTool.find({
      user: req.user.id,
      category: 'backup',
      status: 'completed',
      backupPath: { $exists: true, $ne: null },
    })
      .sort({ scanFinishedAt: -1 })
      .select('_id backupFileName backupFileSize scanFinishedAt')
      .lean();

    return res.status(200).json({
      success: true,
      backups: backups.map((b) => ({
        id: b._id,
        fileName: b.backupFileName,
        size: b.backupFileSize,
        createdAt: b.scanFinishedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── downloadBackup ───────────────────────────────────────────────────────────
const downloadBackup = async (req, res) => {
  try {
    const record = await SelfHelpTool.findById(req.params.id);
    if (!record || record.category !== 'backup') {
      return res.status(404).json({ success: false, message: 'Backup not found' });
    }

    if (record.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const safePath = resolveSafeBackupPath(record.backupPath);
    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, message: 'Backup file not found on disk' });
    }

    return res.download(safePath, record.backupFileName || path.basename(safePath));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── getReportData (debug endpoint) ──────────────────────────────────────────
const getReportData = async (req, res) => {
  try {
    const agentId = typeof req.query.agentId === 'string' && req.query.agentId.trim()
      ? req.query.agentId.trim()
      : null;
    if (!agentId) {
      return res.status(400).json({ message: 'agentId query param is required' });
    }
    const agentRes = await rmm.get(`/agents/${agentId}/`);
    return res.json(agentRes.data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── getBitdefenderDownloadLink ─────────────────────────────────────────────
// Returns direct GravityZone installer download links for the configured
// package. No RMM device linking required — just asks GravityZone's
// Packages API for the install URLs so the frontend can offer a simple
// "Download Bitdefender" button.
const getBitdefenderDownloadLink = async (req, res) => {
  try {
    if (!DEFAULT_PACKAGE_ID) {
      return res.status(500).json({
        success: false,
        message: 'BITDEFENDER_PACKAGE_ID is not configured',
      });
    }

    // TEMPORARY DEBUG LOG — remove once confirmed stable.
    console.log('[getBitdefenderDownloadLink] packageId:', JSON.stringify(DEFAULT_PACKAGE_ID));

    // NOTE: GravityZone's getInstallationLinks method takes a packageName,
    // not a packageId (see gravityZoneClient.js for details) — so we use
    // theByPackageId wrapper, which resolves the name via getPackageDetails
    // first, then calls getInstallationLinks with it.
    const result = await gz.getInstallationLinksByPackageId(DEFAULT_PACKAGE_ID);

    if (!result) {
      return res.status(502).json({
        success: false,
        message: 'GravityZone did not return installation links.',
      });
    }

    // getInstallationLinks returns an Array per the GravityZone API docs —
    // guard against both array and object shapes just in case.
    const linkData = Array.isArray(result) ? result[0] : result;

    if (!linkData) {
      return res.status(502).json({
        success: false,
        message: 'GravityZone returned an empty installation links list — check the package exists and is published in Control Center > Configuration > Update > Components.',
      });
    }

    return res.status(200).json({
      success: true,
      links: {
        windows: linkData.installLinkWindows || null,
        linux: linkData.installLinkLinux || null,
        mac: linkData.installLinkMac || null,
      },
    });
  } catch (error) {
    console.error('[getBitdefenderDownloadLink] failed:', error.message);
    if (error.rpcError) {
      console.error('[getBitdefenderDownloadLink] rpcError:', JSON.stringify(error.rpcError));
    }
    return res.status(500).json({
      success: false,
      message: error.rpcError?.message || error.message,
      debug: error.rpcError || null, // TEMPORARY — remove once fixed
    });
  }
};

// User confirms their machine's hostname after downloading + installing manually.
// Creates/updates a DeviceAntivirus record keyed by hostname instead of rmmAgentId,
// then the existing install-status polling (by hostname) takes it from here.
const registerDeviceHostname = async (req, res) => {
  try {
    const { hostname } = req.body;
    if (!hostname || typeof hostname !== 'string' || !hostname.trim()) {
      return res.status(400).json({ success: false, message: 'hostname is required' });
    }

    const record = await DeviceAntivirus.findOneAndUpdate(
      { user: req.user.id },
      {
        user: req.user.id,
        hostname: hostname.trim(),
        installStatus: 'installing',
        installStartedAt: new Date(),
        installError: null,
        bitdefenderEndpointId: null,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, device: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  startTool,
  getToolStatus,
  getEndpoints,
  getScanResults,
  getScanReport,
  startBackup,
  listBackups,
  downloadBackup,
  getReportData,
  getBitdefenderInstallStatus,
  registerDeviceHostname,
  getBitdefenderDownloadLink,
};