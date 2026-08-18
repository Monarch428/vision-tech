const SelfHelpTool = require('../../models/tools/SelfHelpTool');
const fs = require('fs');
const path = require('path');
const { runBackup, backupDir } = require('../../cron/autoBackup');
const systemLogger = require("../../utils/systemLogger");
const rmm = require('../../utils/tacticalRmmClient');

const categoryMap = {
  'browser-cleanup': 'browser',
  'network-restart': 'network',
  'antivirus-scan': 'security',
  'start-backup': 'backup',
};

// ─── Backup storage location ──────────────────────────────────────────────
// Same directory autoBackup.js writes to — imported directly so there's no
// chance of the two drifting apart via a stale env var.
const BACKUP_DIR = path.resolve(backupDir);

// Resolves a stored backupPath and guarantees it's inside BACKUP_DIR,
// so a manipulated/legacy path can never be used to read arbitrary
// files off disk (path traversal guard).
const resolveSafeBackupPath = (storedPath) => {
  if (!storedPath) return null;
  const resolved = path.resolve(storedPath);
  if (!resolved.startsWith(BACKUP_DIR + path.sep) && resolved !== BACKUP_DIR) {
    return null;
  }
  return resolved;
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
      // ─── Antivirus scan via Tactical RMM ───────────────────────────────
      // Tactical RMM has no dedicated "antivirus scan" API of its own — it
      // just runs arbitrary commands/scripts on the agent. So the actual AV
      // engine here is Windows Defender (already present on the managed
      // device), triggered via RMM's /agents/<id>/cmd/ endpoint.
      //
      // Fire-and-forget: a full scan can take minutes, so we don't block
      // this request waiting on it. getToolStatus polls Defender's own
      // status (Get-MpComputerStatus) to detect completion instead.
      try {
        const { deviceId } = req.body; // Tactical RMM agent_id, required
        if (!deviceId) {
          throw new Error('No device selected for scan (missing deviceId)');
        }

        await rmm.post(`/agents/${deviceId}/cmd/`, {
          shell: 'powershell',
          cmd: 'Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command Start-MpScan -ScanType QuickScan"',
          timeout: 20,
        });

        const updated = await SelfHelpTool.findByIdAndUpdate(
          record._id,
          { status: 'running', progress: 10, rmmAgentId: deviceId },
          { returnDocument: 'after' }
        );

        return res.status(200).json({
          success: true,
          tool: updated,
        });
      } catch (err) {
        // TEMPORARY — surfaces the real cause instead of a generic message.
        // Remove the `debug` field (and this console.error block) once the
        // RMM-based scan is confirmed stable.
        console.error('[antivirus-scan] failed:', err.message);
        if (err.response) {
          console.error('[antivirus-scan] response status:', err.response.status);
          console.error('[antivirus-scan] response data:', JSON.stringify(err.response.data));
        }
        await SelfHelpTool.findByIdAndUpdate(record._id, { status: "failed" });
        return res.status(500).json({
          success: false,
          message: "Antivirus scan failed to start",
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
      // ─── Poll Windows Defender (via RMM) for scan completion ──────────
      // Ask the device directly whether its last quick scan finished after
      // this SelfHelpTool record was started.
      if (tool.status !== 'completed' && tool.status !== 'failed' && tool.rmmAgentId) {
        try {
          const statusRes = await rmm.post(`/agents/${tool.rmmAgentId}/cmd/`, {
            shell: 'powershell',
            cmd: 'Get-MpComputerStatus | Select-Object QuickScanEndTime | ConvertTo-Json',
            timeout: 20,
          });

          let scanEndTime = null;
          try {
            const parsed = JSON.parse(statusRes.data);
            if (parsed?.QuickScanEndTime) scanEndTime = new Date(parsed.QuickScanEndTime);
          } catch (parseErr) {
            console.warn('[getToolStatus] could not parse Defender status output:', statusRes.data);
          }

          if (scanEndTime && tool.scanStartedAt && scanEndTime >= tool.scanStartedAt) {
            let threatsDetected = 0;
            try {
              const threatRes = await rmm.post(`/agents/${tool.rmmAgentId}/cmd/`, {
                shell: 'powershell',
                cmd: '(Get-MpThreatDetection | Measure-Object).Count',
                timeout: 20,
              });
              threatsDetected = parseInt(threatRes.data, 10) || 0;
            } catch (threatErr) {
              console.warn('[getToolStatus] threat count lookup failed:', threatErr.message);
            }

            const update = {
              status: 'completed',
              progress: 100,
              scanFinishedAt: new Date(),
              threatsDetected,
            };
            await SelfHelpTool.findByIdAndUpdate(tool._id, update);
            Object.assign(tool, update);
          } else {
            const update = { status: 'running', progress: Math.max(tool.progress, 50) };
            await SelfHelpTool.findByIdAndUpdate(tool._id, update);
            Object.assign(tool, update);
          }
        } catch (err) {
          console.warn('[getToolStatus] RMM scan status check failed:', err.message);
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
// Replaces GravityZone's getEndpointsList with Tactical RMM's agent list.
// NOTE: Tactical RMM doesn't publish a stable formal API schema (their own
// docs recommend checking the browser Network tab against your instance),
// so double check the field names on the returned agent objects
// (agent_id / hostname / client_name / site_name / etc.) match your version.
const getEndpoints = async (req, res) => {
  try {
    const response = await rmm.get('/agents/');
    return res.json({ success: true, agents: response.data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── getScanResults ───────────────────────────────────────────────────────────
// Replaces GravityZone's getScanTasksList. Tactical RMM has no concept of a
// "scan task" list — our own SelfHelpTool records (written in startTool /
// getToolStatus) are the source of truth for scan history now.
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
// Previously this pulled a GravityZone "On demand scanning" CSV report to
// backfill files-scanned counts. That's no longer needed: filesScanned /
// threatsDetected are already written directly onto each SelfHelpTool
// record by getToolStatus's Defender polling, so this just reads them
// back out of Mongo and pairs them with live agent info from RMM.
const getScanReport = async (req, res) => {
  try {
    // ─── Determine which RMM agent this report is for ───────────────────
    // GravityZone had one hardcoded "network" to ask about; RMM has no
    // equivalent single-network concept — every agent is independent — so
    // the caller must say which agent's scan history to show. Accept it
    // via ?agentId=, falling back to the most recent security-scan
    // record's stored rmmAgentId so there's still something sensible to
    // show if the frontend hasn't been updated to pass it yet.
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

    // ─── User filter ────────────────────────────────────────────────────
    // Shows every user's scans on the agent by default, with an optional
    // ?userId=<id> to narrow it down (the frontend's "Requested by"
    // dropdown can pass this).
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
    const mostRecentCompleted = completedRecords[0] || null; // already sorted desc

    // Every user who has ever requested a scan on this agent, for the
    // "Requested by" filter dropdown — built unfiltered so switching the
    // filter doesn't shrink the available options.
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
        // Field names here are the commonly-seen ones on a Tactical RMM
        // agent object — verify against your instance (devtools Network
        // tab on GET /agents/<id>/ in the RMM web UI) and adjust as needed.
        name: agent.hostname,
        ip: agent.local_ips ?? agent.public_ip ?? null,
        os: agent.operating_system ?? agent.plat ?? null,
        lastSeen: agent.last_seen,
        securityStatus: agent.status,
        infected: mostRecentCompleted ? (mostRecentCompleted.threatsDetected ?? 0) > 0 : false,
        detection: mostRecentCompleted ? (mostRecentCompleted.threatsDetected ?? 0) > 0 : false,
        agentVersion: agent.version ?? null,
        engineVersion: null, // Defender engine version isn't surfaced by RMM's agent payload
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
// Replaces GravityZone's getManagedEndpointDetails with a raw RMM agent
// details fetch. Requires ?agentId= now, since there's no single hardcoded
// network endpoint to fall back to.
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

module.exports = {
  startTool,
  getToolStatus,
  getEndpoints,
  getScanResults,
  getScanReport,
  startBackup,
  listBackups,
  downloadBackup,
  getReportData
};