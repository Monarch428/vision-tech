const SelfHelpTool = require('../../models/tools/SelfHelpTool');
const DeviceAntivirus = require('../../models/tools/deviceAntivirus');
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

async function matchEndpointForUser(userId) {
  console.log("[matchEndpointForUser] called with userId:", userId);
  const device = await DeviceAntivirus.findOne({ user: userId });
  console.log("[matchEndpointForUser] device found:", JSON.stringify(device));
  if (!device?.hostname) {
    console.log("[matchEndpointForUser] no hostname, returning null");
    return null;
  }

  const { items } = await gz.getEndpointsList({
    parentId: process.env.CYBERSHIELD_SOLO_ID,
    isManaged: true,
    page: 1,
    perPage: 100,
    filters: { details: { name: device.hostname } },
    options: { includeScanLogs: true },
  });
  console.log("[matchEndpointForUser] gz returned items count:", items?.length);
  const match = (items || []).find((e) => e.name?.toLowerCase() === device.hostname.toLowerCase());
  console.log("[matchEndpointForUser] match:", JSON.stringify(match));
  return match || null;
}

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

    const taskStatus = await gz.getTaskStatus(tool.bitdefenderTaskId);
const isFinished = taskStatus?.status === 3;

if (isFinished) {
  const update = {
    status: 'completed',
    progress: 100,
    scanFinishedAt: new Date(),
    // filesScanned/threatsDetected intentionally left alone — this API
    // never provides them, so don't overwrite whatever's already there.
  };
  await SelfHelpTool.findByIdAndUpdate(tool._id, update);
  Object.assign(tool, update);
} else {
  const update = { status: 'running', progress: Math.max(tool.progress, 50) };
  await SelfHelpTool.findByIdAndUpdate(tool._id, update);
  Object.assign(tool, update);
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
    const userId = req.user?._id || req.user?.id;
    const match = await matchEndpointForUser(userId);

    if (!match) {
      return res.status(200).json({
        success: true,
        machine: null,
        recentScan: null,
        scans: [],
        stats: { filesScanned: 0, threatsBlocked: 0, totalScans: 0, completedScans: 0 },
        userLastScan: null,
      });
    }

    let details = null;
    try {
      details = await gz.getManagedEndpointDetails(match.id);
    } catch (e) {
      console.warn("[getScanReport] getManagedEndpointDetails failed:", e.message);
    }

    const machine = details
      ? {
          name: details.name,
          ip: details.ip,
          os: details.operatingSystem,
          agentVersion: details.agent?.productVersion ?? "",
          engineVersion: details.agent?.engineVersion ?? "",
          detection: details.malwareStatus?.detection ?? false,
          infected: details.malwareStatus?.infected ?? false,
          lastSeen: details.lastSeen,
          lastUpdate: details.agent?.lastUpdate,
          securityStatus: details.malwareStatus?.infected ? 0 : 1,
          signatureOutdated: details.agent?.signatureOutdated ?? false,
          productOutdated: details.agent?.productOutdated ?? false,
          updateDisabled:
            details.agent?.productUpdateDisabled || details.agent?.signatureUpdateDisabled || false,
        }
      : null;

    let gzTasks = [];
    try {
      const taskList = await gz.getScanTasksList();
      gzTasks = taskList?.items || [];
    } catch (e) {
      console.warn("[getScanReport] getScanTasksList failed:", e.message);
    }
    const gzTaskById = new Map(gzTasks.map((t) => [t.id, t]));

    const selfHelpRecords = await SelfHelpTool.find({
      category: "security",
      bitdefenderTaskId: { $exists: true, $ne: null },
    })
      .sort({ scanStartedAt: -1 })
      .limit(50)
      .populate("user", "name email")
      .lean();

    const toScanUser = (u) => (u ? { id: u._id.toString(), name: u.name ?? null, email: u.email ?? null } : null);

    const scans = selfHelpRecords
  .filter((r) => gzTaskById.has(r.bitdefenderTaskId)) // drop orphaned records with no matching GravityZone task
  .map((r) => {
    const gzTask = gzTaskById.get(r.bitdefenderTaskId);
    const isFinished = gzTask?.status === 3;
    const filesScannedAvailable = r.filesScanned != null && r.filesScanned > 0;
    return {
      id: r._id.toString(),
      taskId: r.bitdefenderTaskId || null,
      name: gzTask?.name || `Scan ${r._id}`,
      startDate: gzTask?.startDate || r.scanStartedAt,
      filesScanned: filesScannedAvailable ? r.filesScanned : null,
      filesScannedAvailable,
      threatsDetected: r.threatsDetected ?? undefined,
      status: isFinished ? "completed" : r.status === "running" ? "in progress" : "scheduled",
      requestedBy: toScanUser(r.user),
    };
  });

    // ─── Fill in missing scanned-file counts from the Reports API ────────────
    // getTaskStatus never returns file counts — only the Reports API does.
    // Only generates a report when something completed is still missing a
    // count, so this stays a no-op once a scan's count is saved to Mongo.
    try {
      const finishedWithoutCount = scans.filter((s) => s.status === "completed" && !s.filesScannedAvailable);
      if (finishedWithoutCount.length > 0) {
        const csvRows = await gz.getOnDemandScanCsvRows([match.id]);
        const sortedRows = [...csvRows].filter((r) => r.scanTime).sort((a, b) => a.scanTime - b.scanTime);
        const sortedTasks = [...finishedWithoutCount].sort(
          (a, b) => new Date(a.startDate) - new Date(b.startDate)
        );

        const usedIdx = new Set();
        for (const task of sortedTasks) {
          const taskStart = task.startDate ? new Date(task.startDate) : null;
          if (!taskStart) continue;
          const rowIdx = sortedRows.findIndex((r, idx) => !usedIdx.has(idx) && r.scanTime >= taskStart);
          if (rowIdx === -1) continue;
          usedIdx.add(rowIdx);

          task.filesScanned = sortedRows[rowIdx].filesScanned;
          task.filesScannedAvailable = true;
          await SelfHelpTool.findByIdAndUpdate(task.id, { filesScanned: sortedRows[rowIdx].filesScanned }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[getScanReport] file-count report fallback failed:", e.message);
    }

    const mostRecent = scans[0] ?? null;

    const recentScan = match.lastSuccessfulScan
      ? {
          taskId: mostRecent?.taskId ?? null,
          taskName: match.lastSuccessfulScan.name,
          filesScanned: mostRecent?.filesScanned ?? null,
          filesScannedAvailable: mostRecent?.filesScannedAvailable ?? false,
          isClean: (mostRecent?.threatsDetected ?? 0) === 0,
          scanDate: match.lastSuccessfulScan.date,
          threatsDetected: mostRecent?.threatsDetected ?? 0,
          scannedBy: mostRecent?.requestedBy ?? null,
        }
      : mostRecent
      ? {
          taskId: mostRecent.taskId,
          taskName: mostRecent.name,
          filesScanned: mostRecent.filesScanned,
          filesScannedAvailable: mostRecent.filesScannedAvailable,
          isClean: (mostRecent.threatsDetected ?? 0) === 0,
          scanDate: mostRecent.startDate,
          threatsDetected: mostRecent.threatsDetected ?? 0,
          scannedBy: mostRecent.requestedBy,
        }
      : null;

    const userRecord = await SelfHelpTool.findOne({ user: userId, category: "security" }).sort({ scanStartedAt: -1 });
    const userLastScan = userRecord
      ? {
          id: userRecord._id.toString(),
          status: userRecord.status,
          progress: userRecord.progress ?? 0,
          filesScanned: userRecord.filesScanned ?? 0,
          threatsDetected: userRecord.threatsDetected ?? 0,
          scanStartedAt: userRecord.scanStartedAt,
          scanFinishedAt: userRecord.scanFinishedAt ?? null,
          filesScannedAvailable: userRecord.filesScanned != null && userRecord.filesScanned > 0,
        }
      : null;

    const stats = {
      filesScanned: scans.reduce((sum, s) => sum + (s.filesScannedAvailable ? s.filesScanned : 0), 0),
      threatsBlocked: scans.reduce((sum, s) => sum + (s.threatsDetected || 0), 0),
      totalScans: scans.length,
      completedScans: scans.filter((s) => s.status === "completed").length,
    };

    res.status(200).json({ success: true, machine, recentScan, scans, stats, userLastScan });
  } catch (error) {
    console.error("[getScanReport]", error.message);
    res.status(500).json({ success: false, message: "Error retrieving scan report", error: error.message });
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

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  let ip = xff ? xff.split(',')[0].trim() : req.socket.remoteAddress;
  if (ip && ip.startsWith('::ffff:')) ip = ip.slice(7); // normalize IPv6-mapped IPv4
  return ip;
}

async function matchEndpointByIp(req) {
  const clientIp = getClientIp(req);
  console.log('[matchEndpointByIp] clientIp:', clientIp);
  if (!clientIp) return null;

  const { items } = await gz.getEndpointsList({
    parentId: process.env.CYBERSHIELD_SOLO_ID,
    isManaged: true,
    page: 1,
    perPage: 100,
  });

  const endpoints = items || [];
  console.log('[matchEndpointByIp] endpoint ips:', endpoints.map(e => `${e.name}:${e.ip}`));
  return endpoints.find((e) => e.ip === clientIp) || null;
}

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

const getBitdefenderEndpoint = async (req, res) => {
  try {
    const result = await gz.getEndpointsList({
      parentId: process.env.CYBERSHIELD_SOLO_ID,
      isManaged: true,
      page: 1,
      perPage: 100,
    });
    const endpoints = result?.items || [];

    if (!endpoints.length) {
      return res.status(200).json({ success: true, installed: false, endpoint: null });
    }

    let device = await DeviceAntivirus.findOne({ user: req.user.id });

    // Try hostname match first (most precise)
    let endpoint = device?.hostname
      ? endpoints.find((item) => item.name?.toLowerCase() === device.hostname.toLowerCase())
      : null;

    // Fall back to IP match if hostname didn't resolve
    if (!endpoint) {
      const clientIp = getClientIp(req);
      console.log('[getBitdefenderEndpoint] falling back to IP match, clientIp:', clientIp);
      endpoint = endpoints.find((item) => item.ip === clientIp) || null;
    }

    if (!endpoint) {
      return res.status(200).json({ success: true, installed: false, endpoint: null });
    }

    if (!device) device = new DeviceAntivirus({ user: req.user.id });
    device.bitdefenderEndpointId = endpoint.id;
    device.hostname = endpoint.name; // backfill hostname from the matched endpoint
    device.installStatus = 'installed';
    device.installCompletedAt = new Date();
    await device.save();

    return res.status(200).json({
      success: true,
      installed: true,
      endpoint: {
        id: endpoint.id,
        name: endpoint.name,
        ip: endpoint.ip || null,
        macs: endpoint.macs || [],
      },
    });
  } catch (error) {
    console.error('[getBitdefenderEndpoint]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const runBitdefenderScan = async (req, res) => {
  try {
    const device = await DeviceAntivirus.findOne({
      user: req.user.id,
    });

    if (!device?.bitdefenderEndpointId) {
      return res.status(400).json({
        success: false,
        message: "Bitdefender endpoint not found",
      });
    }

    const scanRecord = await SelfHelpTool.create({
      user: req.user.id,
      category: "security",
      scanStartedAt: new Date(),
      progress: 10,
      status: "running",
    });

    const result = await gz.createScanTask({
      endpointId: device.bitdefenderEndpointId,
      type: 1,
      name: `Quick Scan ${scanRecord._id}`,
    });

    const taskId =
      result?.taskId ||
      result?.id ||
      result;

    scanRecord.bitdefenderTaskId = taskId;

    await scanRecord.save();

    return res.status(200).json({
      success: true,

      scan: {
        id: scanRecord._id,
        taskId,
        status: "running",
        progress: 10,
      },
    });

  } catch (error) {
    console.error(
      "[runBitdefenderScan]",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to start Bitdefender scan",
    });
  }
};

// ─── getBitdefenderInstallStatus ────────────────────────────────────────────
// Polls GravityZone for the endpoint matching this device's hostname.
// Now retries the match any time status isn't already 'installed' — not just
// while 'installing' — so re-entering the page (e.g. after a manual install
// done outside this flow, or a stale 'failed'/'pending' state) still picks
// up the target id as soon as GravityZone shows it.
const getBitdefenderInstallStatus = async (req, res) => {
  try {
    const record = await DeviceAntivirus.findOne({ user: req.user.id });
    if (!record) {
      // No install record yet == not installed. Not an error state.
      return res.status(200).json({ success: true, device: null });
    }

    if (record.installStatus !== 'installed' && record.hostname) {
      try {
        const { items } = await gz.getEndpointsList({
          parentId: process.env.CYBERSHIELD_SOLO_ID,
          isManaged: true,
          page: 1,
          perPage: 100,
          filters: {
            details: {
              name: record.hostname,
            },
          },
        });
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

const CYBERSHIELD_SOLO_ID = "66475704f09a97869c028180"; // Cybershield Solo companyId

// ─── listCompanyEndpoints ───────────────────────────────────────────────
// Lists every device under Cybershield Solo directly, bypassing the
// per-user hostname-matching flow. For an admin/manual "pick a device
// and scan it" UI.
const listCompanyEndpoints = async (req, res) => {
  try {
    const result = await gz.getEndpointsList({
      parentId: process.env.CYBERSHIELD_SOLO_ID,
      isManaged: true,
      page: 1,
      perPage: 100,
    });

    const endpoints = (result?.items || []).map((e) => ({
      id: e.id,
      name: e.name,
      ip: e.ip || null,
      os: e.operatingSystemVersion || null,
    }));

    return res.status(200).json({ success: true, endpoints });
  } catch (error) {
    console.error("[listCompanyEndpoints]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── runScanOnEndpoint ───────────────────────────────────────────────────
// Runs a scan on an endpointId given directly in the request body, rather
// than resolving it through DeviceAntivirus.hostname. Still logs to
// SelfHelpTool so it shows up in scan history / getScanReport.
const runScanOnEndpoint = async (req, res) => {
  try {
    const { endpointId } = req.body;
    if (!endpointId) {
      return res.status(400).json({ success: false, message: "endpointId is required" });
    }

    const scanRecord = await SelfHelpTool.create({
      user: req.user.id,
      category: "security",
      scanStartedAt: new Date(),
      progress: 10,
      status: "running",
    });

    const result = await gz.createScanTask({
      endpointId,
      type: 1,
      name: `Quick Scan ${scanRecord._id}`,
    });

      const taskId = result?.taskId || result?.id || result;
      console.log("[runScanOnEndpoint] about to set taskId:", taskId, "on record:", scanRecord._id);
      scanRecord.bitdefenderTaskId = taskId;
      const saved = await scanRecord.save();
      console.log("[runScanOnEndpoint] AFTER SAVE:", JSON.stringify(saved));

      return res.status(200).json({
      success: true,
      scan: { id: scanRecord._id, taskId, status: "running", progress: 10 },
    });
  } catch (error) {
    console.error("[runScanOnEndpoint]", error.message);
    return res.status(500).json({ success: false, message: error.message || "Failed to start scan" });
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
  runBitdefenderScan,
  getBitdefenderDownloadLink,
  getBitdefenderEndpoint,
  listCompanyEndpoints,
  runScanOnEndpoint,
};