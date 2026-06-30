const SelfHelpTool = require('../../models/tools/SelfHelpTool');
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { runBackup } = require('../../cron/autoBackup');
const AdmZip = require("adm-zip");
const systemLogger = require("../../utils/systemLogger");

const categoryMap = {
  'browser-cleanup': 'browser',
  'network-restart': 'network',
  'antivirus-scan': 'security',
  'start-backup': 'backup',
};

// ─── Helper: build Bitdefender auth headers ───────────────────────────────────
const getBDHeaders = () => {
  const apiKey = process.env.BITDEFENDER_API_KEY;
  const encodedKey = Buffer.from(`${apiKey}:`).toString('base64');
  return {
    Authorization: `Basic ${encodedKey}`,
    'Content-Type': 'application/json',
  };
};

// ─── Helper: derive base + sub-URLs from env ──────────────────────────────────
const getBDUrls = () => {
  const BASE = process.env.BITDEFENDER_API_URL
    .replace(/\/(network|reports|incidents|accounts)$/, '');
  return {
    networkUrl: `${BASE}/network`,
    reportsUrl: `${BASE}/reports`,
  };
};

// ─── Shared CSV helpers ───────────────────────────────────────────────────────
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
    else { current += char; }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

const parseCSVToMap = (csvData) => {
  if (!csvData) return {};
  // Strip UTF-8 BOM that Bitdefender prepends to CSV files
  const cleaned = csvData.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return {};
  const hdrs = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const vals = parseCSVLine(lines[1]);
  const map = {};
  hdrs.forEach((h, i) => { map[h] = vals[i] ?? '0'; });
  return map;
};

const getExact = (map, key) => {
  const raw = map[key];
  if (raw === undefined || raw === '' || raw === 'N/A') return 0;
  const parsed = parseInt(raw.replace(/,(?=\d{3})/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
};

// ─── Download ZIP / CSV from a BD report link ─────────────────────────────────
const downloadCSVFromLink = async (link, authHeader) => {
  try {
    const separator = link.includes('?') ? '&' : '?';
    const csvRes = await axios.get(`${link}${separator}format=csv`, {
      headers: { Authorization: authHeader },
      responseType: 'text',
    });
    if (csvRes.data && !csvRes.data.startsWith('%PDF') && csvRes.data.includes(',')) {
      console.log('[downloadCSV] Got CSV directly');
      return csvRes.data;
    }
  } catch (_) { }

  const binRes = await axios.get(link, {
    headers: { Authorization: authHeader },
    responseType: 'arraybuffer',
  });
  const buffer = Buffer.from(binRes.data);
  if (buffer.slice(0, 4).toString('hex') === '504b0304') {
    const zip = new AdmZip(buffer);
    const csvEntry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('.csv'));
    if (csvEntry) {
      console.log('[downloadCSV] Extracted CSV from ZIP');
      return csvEntry.getData().toString('utf8');
    }
  }
  return null;
};

// ─── Create a BD report, poll until ready, download CSV, then delete ──────────
const fetchBDReportCSV = async (post, reportsUrl, authHeader, type, label) => {
  const reportName = `TempReport_${label}_${Date.now()}`;
  const createRes = await post(reportsUrl, 'createReport', {
    name: reportName,
    type,
    targetIds: ['6a202a9198740422ae09c75e'],
    options: { reportingInterval: 0 },
  }, `${label}-create`);

  const reportId = createRes.data.result;
  if (!reportId) throw new Error(`createReport failed for type ${type}`);
  console.log(`[${label}] Created reportId: ${reportId}`);

  let link = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const dlRes = await post(reportsUrl, 'getDownloadLinks', { reportId }, `${label}-dl`);
    const result = dlRes.data.result;
    if (result?.readyForDownload === true) {
      link = result.lastInstanceUrl || result.allInstancesUrl;
      console.log(`[${label}] ✅ Ready after ${(i + 1) * 5}s, link: ${link}`);
      break;
    }
    if (i % 6 === 5) console.log(`[${label}] still waiting... ${(i + 1) * 5}s elapsed`);
  }

  if (!link) {
    console.warn(`[${label}] ⚠️ Report not ready after 300s — giving up`);
  }

  let csvData = null;
  if (link) csvData = await downloadCSVFromLink(link, authHeader);

  await post(reportsUrl, 'deleteReport', { reportId }, `${label}-del`).catch(() => { });
  console.log(`[${label}] Report deleted.`);

  return csvData;
};

// ─── pollAndSaveScanResults ───────────────────────────────────────────────────
// Fire-and-forget background function. Polls BD every 30s until the named scan
// task reaches status=3 (Completed), then reads real scan stats from:
//   1. getManagedEndpointDetails  — scanInfo.lastSuccessfulScan (filesScanned)
//   2. Malware status report (type 12) — threats (Unresolved)
// The type-15 on-demand report is NOT used because it always reflects the
// endpoint's last historical scan, not the current task.
const pollAndSaveScanResults = async (recordId, scanName) => {
  const MAX_ATTEMPTS = 60;     // 60 × 30s = 30 minutes max
  const POLL_INTERVAL = 30_000;

  const headers = getBDHeaders();
  const { networkUrl, reportsUrl } = getBDUrls();
  const post = (url, method, params, id) =>
    axios.post(url, { jsonrpc: '2.0', method, params, id }, { headers });

  console.log(`[pollAndSave] Starting background poll — record: ${recordId}, scan: ${scanName}`);

  // ── Step 1: Wait for BD scan task to complete (status=3) ─────────────────
  let completedTask = null;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    // Update live progress in DB so frontend shows activity (10%–90%)
    const liveProgress = Math.min(10 + Math.floor((i / MAX_ATTEMPTS) * 80), 90);
    await SelfHelpTool.findByIdAndUpdate(recordId, { progress: liveProgress }).catch(() => { });

    try {
      let page = 1;
      let found = false;

      while (true) {
        const res = await post(networkUrl, 'getScanTasksList', { page, perPage: 100 }, `poll-p${page}`);
        const items = res.data.result?.items || [];
        const total = res.data.result?.total || 0;

        const match = items.find((t) => t.name === scanName);
        if (match) {
          console.log(`[pollAndSave] Found task "${scanName}" — BD status: ${match.status} (attempt ${i + 1}/${MAX_ATTEMPTS})`);
          if (match.status === 3) {
            completedTask = match;
            found = true;
          }
          break;
        }

        if (items.length < 100 || page * 100 >= total) break;
        page++;
      }

      if (found) break;
    } catch (err) {
      console.error(`[pollAndSave] Poll error (attempt ${i + 1}):`, err.message);
    }
  }

  if (!completedTask) {
    console.warn(`[pollAndSave] Timed out — marking record ${recordId} failed`);
    await SelfHelpTool.findByIdAndUpdate(recordId, { status: 'failed', progress: 100 }).catch(() => { });
    return;
  }

  console.log('[pollAndSave] completedTask raw data:', JSON.stringify(completedTask, null, 2));
  console.log(`[pollAndSave] BD scan completed! Fetching endpoint details + malware report...`);

  try {
    // ── Step 2a: Get endpoint details — has real scan stats ──────────────────
    // getManagedEndpointDetails returns scanInfo.lastSuccessfulScan with
    // scannedFiles, infectedFiles etc. for the most recent completed scan.
    const endpointRes = await post(networkUrl, 'getManagedEndpointDetails', {
      endpointId: '6a202a9198740422ae09c75e',
    }, 'ep-detail');

    const endpoint = endpointRes.data.result;
    console.log('[pollAndSave] Endpoint scanInfo:', JSON.stringify(endpoint?.scanInfo ?? endpoint?.lastScan ?? null, null, 2));
    console.log('[pollAndSave] Endpoint malwareStatus:', JSON.stringify(endpoint?.malwareStatus ?? null, null, 2));
    console.log('[pollAndSave] Full endpoint keys:', Object.keys(endpoint || {}));

    // Try every known field path BD uses for file counts
    const scanInfo = endpoint?.scanInfo || endpoint?.lastScan || {};
    const filesScannedFromEndpoint =
      scanInfo?.scannedFiles ||
      scanInfo?.filesScanned ||
      scanInfo?.totalScanned ||
      endpoint?.malwareStatus?.scannedFiles ||
      endpoint?.malwareStatus?.filesScanned ||
      0;

    console.log(`[pollAndSave] filesScannedFromEndpoint: ${filesScannedFromEndpoint}`);

    // ── Step 2b: Malware report (type 12) for threats only ───────────────────
    // We still need this for threatsDetected (Unresolved column).
    // We skip type-15 entirely since it always shows historical Quick Scan data.
    const malwareCSV = await fetchBDReportCSV(post, reportsUrl, headers.Authorization, 12, 'bg-malware');
    const malwareMap = parseCSVToMap(malwareCSV);
    console.log(malwareCSV);
    console.log(
      malwareCSV
        .split("\n")
        .slice(0, 5)
        .join("\n")
    );

    console.log('[pollAndSave] Malware map:', JSON.stringify(malwareMap));

    const threatsDetected = getExact(malwareMap, 'unresolved');

    // filesScanned: prefer live endpoint data, fall back to malware report columns
    const filesScanned =
      filesScannedFromEndpoint ||
      getExact(malwareMap, 'scanned') ||
      getExact(malwareMap, 'total scanned') ||
      getExact(malwareMap, 'files scanned');

    console.log(`[pollAndSave] Final — filesScanned: ${filesScanned}, threatsDetected: ${threatsDetected}`);

    // ── Step 3: Save to DB ────────────────────────────────────────────────────
    await SelfHelpTool.findByIdAndUpdate(recordId, {
      filesScanned,
      threatsDetected,
      status: 'completed',
      progress: 100,
      scanFinishedAt: completedTask.startDate ? new Date(completedTask.startDate) : new Date(),
    });

    console.log(`[pollAndSave] ✅ DB record ${recordId} updated — filesScanned: ${filesScanned}, threatsDetected: ${threatsDetected}`);

    await systemLogger({
      type: threatsDetected > 0 ? 'warning' : 'success',
      action: 'ANTIVIRUS_SCAN_COMPLETED',
      details: threatsDetected > 0
        ? `Scan completed — ${threatsDetected} threat(s) detected (${filesScanned} files scanned)`
        : `Scan completed — clean (${filesScanned} files scanned)`,
      module: 'antivirus',
      metadata: { filesScanned, threatsDetected, recordId },
    });

  } catch (err) {
    console.error(`[pollAndSave] Failed to fetch/save report:`, err.message);
    await SelfHelpTool.findByIdAndUpdate(recordId, {
      status: 'completed',
      progress: 100,
      scanFinishedAt: new Date(),
    }).catch(() => { });
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

    // ── Browser / Network: complete immediately ───────────────────────────────
    if (toolId === 'browser-cleanup' || toolId === 'network-restart') {
      await SelfHelpTool.findByIdAndUpdate(record._id, {
        progress: 100,
        status: 'completed',
        scanFinishedAt: new Date(),
      });

      await systemLogger({
        type: 'success',
        action: toolId === 'browser-cleanup' ? 'BROWSER_CLEANUP_COMPLETED' : 'NETWORK_RESTART_COMPLETED',
        user: req.user?.id,
        userEmail: req.user?.email,
        details: `${toolId} completed by user`,
        module: 'self-help-tools',
        ipAddress: req.ip,
      });

      return res.status(200).json({
        success: true,
        tool: { ...record.toObject(), progress: 100, status: 'completed' },
      });
    }

    // ── Antivirus → Bitdefender ───────────────────────────────────────────────
    if (toolId === 'antivirus-scan') {
      try {
        const headers = getBDHeaders();
        const { networkUrl } = getBDUrls();
        const scanName = `SelfHelp_Scan_${record._id}`;

        console.log("=== Starting Bitdefender Scan ===");
        console.log("Record ID:", record._id);
        console.log("Scan Name:", scanName);
        console.log("Network URL:", networkUrl);

        const response = await axios.post(
          networkUrl,
          {
            jsonrpc: "2.0",
            method: "createScanTask",
            params: {
              targetIds: ["6a202a9198740422ae09c75e"],
              type: 2,  // Full Scan (type 1 Quick Scan was failing on the endpoint)
              name: scanName,
            },
            id: record._id.toString(),
          },
          { headers }
        );

        console.log("=== BD createScanTask response ===");
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.error) {
          throw new Error(response.data.error.message || "Bitdefender internal error");
        }

        await SelfHelpTool.findByIdAndUpdate(record._id, { status: "running" });

        // Fire-and-forget — do NOT await
        pollAndSaveScanResults(record._id.toString(), scanName);

        await systemLogger({
          type: "success",
          action: "ANTIVIRUS_SCAN_STARTED",
          user: req.user?.id,
          userEmail: req.user?.email,
          details: `Antivirus full scan started (Tool record ${record._id}, scan: ${scanName})`,
          module: "antivirus",
          ipAddress: req.ip,
        });

        return res.status(200).json({
          success: true,
          tool: { ...record.toObject(), status: "running" },
          bitdefenderResponse: response.data.result,
        });

      } catch (err) {
        console.error("=== Bitdefender Axios Error ===");
        console.error(err.response ? err.response.data : err.message);

        await SelfHelpTool.findByIdAndUpdate(record._id, { status: "failed" });

        await systemLogger({
          type: "error",
          action: "ANTIVIRUS_SCAN_START_ERROR",
          user: req.user?.id,
          userEmail: req.user?.email,
          details: err.response ? JSON.stringify(err.response.data) : err.message,
          module: "antivirus",
          ipAddress: req.ip,
        });

        return res.status(500).json({
          success: false,
          message: "Bitdefender scan failed",
          error: err.response ? JSON.stringify(err.response.data) : err.message,
        });
      }
    }

    return res.status(200).json({ success: true, tool: record });

  } catch (error) {
    console.error(error);

    await systemLogger({
      type: 'error',
      action: 'SELF_HELP_TOOL_START_ERROR',
      user: req.user?.id,
      userEmail: req.user?.email,
      details: error.message,
      module: 'self-help-tools',
      ipAddress: req.ip,
    });

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
      return res.status(200).json({
        success: true,
        data: {
          id: tool._id,
          category: tool.category,
          progress: tool.progress,
          status: tool.status,
          scanStartedAt: tool.scanStartedAt,
          scanFinishedAt: tool.scanFinishedAt,
          filesScanned: tool.filesScanned,
          threatsDetected: tool.threatsDetected,
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
const getEndpoints = async (req, res) => {
  try {
    const headers = getBDHeaders();
    const { networkUrl } = getBDUrls();

    const response = await axios.post(
      networkUrl,
      {
        jsonrpc: '2.0',
        method: 'getEndpointsList',
        params: { page: 1, perPage: 100 },
        id: '1',
      },
      { headers }
    );

    return res.json(response.data);
  } catch (err) {
    console.error('STATUS:', err.response?.status);
    console.error('DATA:', err.response?.data);
    console.error('MESSAGE:', err.message);

    await systemLogger({
      type: 'error',
      action: 'ANTIVIRUS_GET_ENDPOINTS_ERROR',
      user: req.user?.id,
      userEmail: req.user?.email,
      details: err.response?.data ? JSON.stringify(err.response.data) : err.message,
      module: 'antivirus',
      ipAddress: req.ip,
    });

    return res.status(500).json({
      success: false,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
  }
};

// ─── getScanResults ───────────────────────────────────────────────────────────
const getScanResults = async (req, res) => {
  try {
    const headers = getBDHeaders();
    const { networkUrl } = getBDUrls();

    const response = await axios.post(
      networkUrl,
      {
        jsonrpc: '2.0',
        method: 'getScanTasksList',
        params: { page: 1, perPage: 10 },
        id: '1',
      },
      { headers }
    );

    return res.json(response.data);
  } catch (err) {
    await systemLogger({
      type: 'error',
      action: 'ANTIVIRUS_GET_SCAN_RESULTS_ERROR',
      user: req.user?.id,
      userEmail: req.user?.email,
      details: err.message,
      module: 'antivirus',
      ipAddress: req.ip,
    });

    return res.status(500).json({ message: err.message });
  }
};

// ─── getScanReport ────────────────────────────────────────────────────────────
const getScanReport = async (req, res) => {
  try {
    const headers = getBDHeaders();
    const { networkUrl, reportsUrl } = getBDUrls();

    const post = (url, method, params, id) =>
      axios.post(url, { jsonrpc: '2.0', method, params, id }, { headers });

    const getAllTasks = async () => {
      const perPage = 100;
      let page = 1;
      let allTasks = [];
      while (true) {
        const taskRes = await post(networkUrl, 'getScanTasksList', { page, perPage }, `tasks-p${page}`);
        const items = taskRes.data.result?.items || [];
        const total = taskRes.data.result?.total || 0;
        allTasks = allTasks.concat(items);
        if (allTasks.length >= total || items.length < perPage) break;
        page++;
      }
      return allTasks;
    };

    // Tasks + endpoint details in parallel, then malware report sequentially
    const [tasks, endpointRes] = await Promise.all([
      getAllTasks(),
      post(networkUrl, 'getManagedEndpointDetails', {
        endpointId: '6a202a9198740422ae09c75e',
      }, 'endpoint'),
    ]);

    // Only fetch malware report (type 12) for threats — skip type 15
    const malwareCSV = await fetchBDReportCSV(post, reportsUrl, headers.Authorization, 12, 'malware');

    const endpoint = endpointRes.data.result;
    const completedTasks = tasks.filter((t) => t.status === 3);
    const latestCompleted = [...completedTasks].reverse()[0] ?? null;

    const malwareMap = parseCSVToMap(malwareCSV);
    const threatsDetected = getExact(malwareMap, 'unresolved');

    // Get filesScanned from endpoint's live scan info
    const scanInfo = endpoint?.scanInfo || endpoint?.lastScan || {};
    const filesScanned =
      scanInfo?.scannedFiles ||
      scanInfo?.filesScanned ||
      scanInfo?.totalScanned ||
      endpoint?.malwareStatus?.scannedFiles ||
      getExact(malwareMap, 'scanned') ||
      getExact(malwareMap, 'total scanned') ||
      getExact(malwareMap, 'files scanned') ||
      0;

    const scans = tasks.map((task) => ({
      id: task.id,
      name: task.name,
      startDate: task.startDate,
      filesScanned: task.id === latestCompleted?.id ? filesScanned : 0,
      threatsDetected: task.id === latestCompleted?.id ? threatsDetected : 0,
      status:
        task.status === 3 ? '✅ Completed' :
          task.status === 2 ? '🔄 Running' :
            task.status === 1 ? '⏳ Pending' : '❌ Failed',
    }));

    await systemLogger({
      type: threatsDetected > 0 ? 'warning' : 'success',
      action: 'ANTIVIRUS_SCAN_REPORT_FETCHED',
      user: req.user?.id,
      userEmail: req.user?.email,
      details: threatsDetected > 0
        ? `Scan report fetched — ${threatsDetected} unresolved threat(s) detected`
        : `Scan report fetched — no threats detected (${filesScanned} files scanned)`,
      module: 'antivirus',
      ipAddress: req.ip,
      metadata: { filesScanned, threatsDetected, totalScans: tasks.length },
    });

    // Save to matching SelfHelpTool record
    if (malwareCSV !== null) {
      try {
        const runningRecord = await SelfHelpTool.findOne({
          category: 'security',
          status: 'running',
        }).sort({ createdAt: -1 });

        if (runningRecord) {
          runningRecord.filesScanned = filesScanned;
          runningRecord.threatsDetected = threatsDetected;
          runningRecord.status = 'completed';
          runningRecord.progress = 100;
          runningRecord.scanFinishedAt = latestCompleted?.startDate
            ? new Date(latestCompleted.startDate)
            : new Date();
          await runningRecord.save();
          console.log(`=== Saved filesScanned=${filesScanned} to running record ${runningRecord._id} ===`);
        } else if (latestCompleted?.name) {
          const match = latestCompleted.name.match(/^SelfHelp_Scan_([a-f0-9]{24})$/i);
          if (match) {
            const toolRecordId = match[1];
            await SelfHelpTool.findByIdAndUpdate(toolRecordId, {
              filesScanned,
              threatsDetected,
              status: 'completed',
              progress: 100,
              scanFinishedAt: latestCompleted.startDate
                ? new Date(latestCompleted.startDate)
                : new Date(),
            });
            console.log(`=== Saved filesScanned=${filesScanned} to matched record ${toolRecordId} ===`);
          }
        }
      } catch (saveErr) {
        console.error('Failed to save scan results to SelfHelpTool:', saveErr.message);
      }
    }

    return res.json({
      success: true,
      machine: {
        name: endpoint?.name,
        ip: endpoint?.ip,
        os: endpoint?.operatingSystem,
        lastSeen: endpoint?.lastSeen,
        securityStatus: endpoint?.state,
        infected: endpoint?.malwareStatus?.infected ?? false,
        detection: endpoint?.malwareStatus?.detection ?? false,
        agentVersion: endpoint?.agent?.productVersion,
        engineVersion: endpoint?.agent?.engineVersion,
        lastUpdate: endpoint?.agent?.lastUpdate,
      },
      stats: {
        filesScanned,
        threatsBlocked: threatsDetected,
        totalScans: tasks.length,
        completedScans: completedTasks.length,
      },
      recentScan: {
        taskId: latestCompleted?.id ?? null,
        taskName: latestCompleted?.name ?? null,
        scanDate: latestCompleted?.startDate ?? null,
        filesScanned,
        threatsDetected,
        isClean: threatsDetected === 0,
      },
      scans,
    });

  } catch (err) {
    console.error(err.response?.data || err.message);

    await systemLogger({
      type: 'error',
      action: 'ANTIVIRUS_SCAN_REPORT_ERROR',
      user: req.user?.id,
      userEmail: req.user?.email,
      details: err.response?.data ? JSON.stringify(err.response.data) : err.message,
      module: 'antivirus',
      ipAddress: req.ip,
    });

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

    const backupPath = await runBackup();

    await SelfHelpTool.findByIdAndUpdate(record._id, {
      progress: 100,
      status: 'completed',
      scanFinishedAt: new Date(),
    });

    await systemLogger({
      type: 'success',
      action: 'BACKUP_COMPLETED',
      user: req.user?.id,
      userEmail: req.user?.email,
      details: `Backup completed successfully`,
      module: 'self-help-tools',
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Backup completed',
      backupPath,
    });
  } catch (error) {
    console.error('Backup error:', error);

    await systemLogger({
      type: 'error',
      action: 'BACKUP_FAILED',
      user: req.user?.id,
      userEmail: req.user?.email,
      details: error.message,
      module: 'self-help-tools',
      ipAddress: req.ip,
    });

    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── getReportData (debug endpoint) ──────────────────────────────────────────
const getReportData = async (req, res) => {
  try {
    const headers = getBDHeaders();
    const { networkUrl, reportsUrl } = getBDUrls();

    const post = (url, method, params, id) =>
      axios.post(url, { jsonrpc: '2.0', method, params, id }, { headers });

    // Get endpoint details to see live scan stats
    const endpointRes = await post(networkUrl, 'getManagedEndpointDetails', {
      endpointId: '6a202a9198740422ae09c75e',
    }, 'ep-debug');
    const endpoint = endpointRes.data.result;

    const listRes = await post(reportsUrl, 'getReportsList', { page: 1, perPage: 50 }, 'list');
    const existingReports = listRes.data.result?.items || [];

    const malwareCSV = await fetchBDReportCSV(post, reportsUrl, headers.Authorization, 12, 'debug-malware')
      .catch(e => ({ error: e.message }));

    await new Promise(r => setTimeout(r, 3000));

    const onDemandCSV = await fetchBDReportCSV(post, reportsUrl, headers.Authorization, 15, 'debug-ondemand')
      .catch(e => ({ error: e.message }));

    const malwareMap = typeof malwareCSV === 'string' ? parseCSVToMap(malwareCSV) : {};
    const onDemandMap = typeof onDemandCSV === 'string' ? parseCSVToMap(onDemandCSV) : {};

    const threatsDetected = getExact(malwareMap, 'unresolved');
    const filesScannedMalware =
      getExact(malwareMap, 'scanned') ||
      getExact(malwareMap, 'total scanned') ||
      getExact(malwareMap, 'files scanned');
    const filesScannedOnDemand =
      getExact(onDemandMap, 'last successful scan - scanned files') ||
      getExact(onDemandMap, 'scanned files') ||
      getExact(onDemandMap, 'scanned');

    const scanInfo = endpoint?.scanInfo || endpoint?.lastScan || {};
    const filesScannedEndpoint =
      scanInfo?.scannedFiles ||
      scanInfo?.filesScanned ||
      scanInfo?.totalScanned ||
      endpoint?.malwareStatus?.scannedFiles ||
      0;

    const filesScanned = filesScannedEndpoint || filesScannedMalware || filesScannedOnDemand;

    return res.json({
      success: true,
      // Live endpoint scan data — this is the most reliable source
      endpointScanInfo: {
        scanInfo: endpoint?.scanInfo ?? null,
        lastScan: endpoint?.lastScan ?? null,
        malwareStatus: endpoint?.malwareStatus ?? null,
        allKeys: Object.keys(endpoint || {}),
        filesScannedEndpoint,
      },
      existingReports: existingReports.map(r => ({
        id: r.id, name: r.name, type: r.type, status: r.status,
      })),
      malware: {
        csvError: typeof malwareCSV !== 'string' ? malwareCSV?.error : null,
        rawHeaders: typeof malwareCSV === 'string' ? malwareCSV.replace(/^\uFEFF/, '').split(/\r?\n/)[0] : null,
        rawRow: typeof malwareCSV === 'string' ? malwareCSV.replace(/^\uFEFF/, '').split(/\r?\n/)[1] : null,
        parsedMap: malwareMap,
        extracted: {
          unresolved: getExact(malwareMap, 'unresolved'),
          scanned: getExact(malwareMap, 'scanned'),
          totalScanned: getExact(malwareMap, 'total scanned'),
          filesScanned: getExact(malwareMap, 'files scanned'),
        },
      },
      onDemand: {
        csvError: typeof onDemandCSV !== 'string' ? onDemandCSV?.error : null,
        rawHeaders: typeof onDemandCSV === 'string' ? onDemandCSV.replace(/^\uFEFF/, '').split(/\r?\n/)[0] : null,
        rawRow: typeof onDemandCSV === 'string' ? onDemandCSV.replace(/^\uFEFF/, '').split(/\r?\n/)[1] : null,
        parsedMap: onDemandMap,
        extracted: {
          lastSuccessfulScanScannedFiles: getExact(onDemandMap, 'last successful scan - scanned files'),
          scannedFiles: getExact(onDemandMap, 'scanned files'),
          scanned: getExact(onDemandMap, 'scanned'),
          successfulScans: getExact(onDemandMap, 'successful scans'),
          failedScans: getExact(onDemandMap, 'failed scans'),
        },
      },
      resolved: {
        filesScanned,
        threatsDetected,
        filesScannedSource:
          filesScannedEndpoint ? 'endpoint-scanInfo' :
            filesScannedMalware ? 'malware-report' :
              filesScannedOnDemand ? 'ondemand-report' : 'none',
      },
    });

  } catch (err) {
    console.error('[getReportData]', err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
      bdError: err.response?.data ?? null,
    });
  }
};

module.exports = {
  startTool,
  getToolStatus,
  getEndpoints,
  getScanResults,
  getScanReport,
  startBackup,
  getReportData,
};