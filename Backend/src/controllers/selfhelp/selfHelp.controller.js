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

// Parses the FULL CSV into an array of row objects (one per data line),
// instead of only reading the header + first row. GravityZone's
// "On demand scanning" report returns one row per individual scan
// execution, not one aggregated summary row.
const parseCSVRows = (csvData) => {
  if (!csvData) return [];
  const cleaned = csvData.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const hdrs = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (!vals.length) continue;
    const row = {};
    hdrs.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
};

const getExact = (map, key) => {
  const raw = map[key];
  if (raw === undefined || raw === '' || raw === 'N/A') return 0;
  const parsed = parseInt(String(raw).replace(/,(?=\d{3})/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
};

// GravityZone's CSV date format looks like: "01 July 2026, 14:25:58"
// (day, full month name, year, comma, HH:mm:ss). Node's Date constructor
// can't reliably parse this directly, so we parse it explicitly.
const parseBDDate = (raw) => {
  if (!raw || raw === 'N/A') return null;
  const match = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, day, monthName, year, hour, min, sec] = match;
    const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
    if (!isNaN(monthIndex)) {
      return new Date(Number(year), monthIndex, Number(day), Number(hour), Number(min), Number(sec));
    }
  }
  const fallback = new Date(raw.replace(',', ''));
  return isNaN(fallback.getTime()) ? null : fallback;
};

// Maps how far back we need historical data to the smallest GravityZone
// reportingInterval value that will cover it. Values per Bitdefender's
// createReport docs (monthly-report scale, used for instant reports):
// 0-Today, 1-Last day, 2-This week, 3-Last week, 4-This month,
// 5-Last month, 6-Last 2 months, 7-Last 3 months, 8-This year.
const pickReportingInterval = (oldestDate) => {
  if (!oldestDate) return 8; // safest fallback: This year
  const days = (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 0) return 0;
  if (days <= 1) return 1;
  if (days <= 7) return 2;
  if (days <= 30) return 4;
  if (days <= 60) return 6;
  if (days <= 90) return 7;
  return 8;
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
      return csvEntry.getData().toString('utf8');
    }
  }
  return null;
};

// ─── Extract Scan Metrics safely from getScanTasksList schema payload ────────
const extractTaskStats = (task) => {
  if (!task) return { filesScanned: null, threatsDetected: 0 };

  const filesScanned =
    task.scannedItemsCount ??
    task.scannedItems ??
    task.scannedFiles ??
    task.stats?.scannedFiles ??
    task.stats?.scanned ??
    task.scanStats?.scannedFiles ??
    null;

  const threatsDetected =
    task.infectedItemsCount ??
    task.infectedItems ??
    task.infectedFiles ??
    task.stats?.infected ??
    task.stats?.detected ??
    task.scanStats?.infected ??
    0;

  return {
    filesScanned: filesScanned != null ? Number(filesScanned) : null,
    threatsDetected: Number(threatsDetected)
  };
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
      try {
        const headers = getBDHeaders();
        const { networkUrl } = getBDUrls();
        const scanName = `SelfHelp_Scan_${record._id}`;

        const response = await axios.post(
          networkUrl,
          {
            jsonrpc: "2.0",
            method: "createScanTask",
            params: {
              targetIds: ["6a202a9198740422ae09c75e"],
              type: 2,
              name: scanName,
            },
            id: record._id.toString(),
          },
          { headers }
        );

        if (response.data.error) {
          throw new Error(response.data.error.message || "Bitdefender internal error");
        }

        const bdTaskId = response.data.result;
        const updated = await SelfHelpTool.findByIdAndUpdate(
          record._id,
          { status: "running", progress: 10, bdTaskId },
          { returnDocument: 'after' }
        );

        return res.status(200).json({
          success: true,
          tool: updated,
          bitdefenderResponse: response.data.result,
        });
      } catch (err) {
        await SelfHelpTool.findByIdAndUpdate(record._id, { status: "failed" });
        return res.status(500).json({ success: false, message: "Bitdefender scan failed" });
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
      if (tool.status !== 'completed' && tool.status !== 'failed' && tool.bdTaskId) {
        try {
          const headers = getBDHeaders();
          const { networkUrl } = getBDUrls();

          const taskRes = await axios.post(networkUrl, {
            jsonrpc: '2.0',
            method: 'getScanTasksList',
            params: { page: 1, perPage: 100 },
            id: 'status-lookup'
          }, { headers });

          const items = taskRes.data.result?.items || [];
          const taskMatch = items.find(t => t.id === tool.bdTaskId);

          if (taskMatch) {
            const info = extractTaskStats(taskMatch);
            const update = {};

            if (taskMatch.status === 3) {
              update.status = 'completed';
              update.progress = 100;
              update.scanFinishedAt = new Date();
              if (info.filesScanned != null) update.filesScanned = info.filesScanned;
              update.threatsDetected = info.threatsDetected;
            } else if (taskMatch.status === 4) {
              update.status = 'failed';
            } else if (taskMatch.status === 2) {
              update.status = 'running';
              update.progress = Math.max(tool.progress, 50);
            } else {
              update.status = 'running';
              update.progress = Math.max(tool.progress, 10);
            }
            await SelfHelpTool.findByIdAndUpdate(tool._id, update);
            Object.assign(tool, update);
          }
        } catch (err) {
          console.warn('[getToolStatus] BD task list update failed:', err.message);
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
const getEndpoints = async (req, res) => {
  try {
    const headers = getBDHeaders();
    const { networkUrl } = getBDUrls();
    const response = await axios.post(
      networkUrl,
      { jsonrpc: '2.0', method: 'getEndpointsList', params: { page: 1, perPage: 100 }, id: '1' },
      { headers }
    );
    return res.json(response.data);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── getScanResults ───────────────────────────────────────────────────────────
const getScanResults = async (req, res) => {
  try {
    const headers = getBDHeaders();
    const { networkUrl } = getBDUrls();
    const response = await axios.post(
      networkUrl,
      { jsonrpc: '2.0', method: 'getScanTasksList', params: { page: 1, perPage: 10 }, id: '1' },
      { headers }
    );
    return res.json(response.data);
  } catch (err) {
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

    const [tasks, endpointRes] = await Promise.all([
      getAllTasks(),
      post(networkUrl, 'getManagedEndpointDetails', { endpointId: '6a202a9198740422ae09c75e' }, 'endpoint'),
    ]);

    const endpoint = endpointRes.data.result;

    const taskIdByRecordId = {};
    for (const task of tasks) {
      const match = typeof task.name === 'string' && task.name.match(/^SelfHelp_Scan_([a-f0-9]{24})$/i);
      if (match) taskIdByRecordId[task.id] = match[1];
    }
    const recordIds = Object.values(taskIdByRecordId);

    let ownerByRecordId = {};
    if (recordIds.length) {
      const ownerRecords = await SelfHelpTool.find({ _id: { $in: recordIds } })
        .select('_id user')
        .populate('user', 'name email')
        .lean();
      ownerByRecordId = Object.fromEntries(
        ownerRecords.map((r) => [
          r._id.toString(),
          r.user ? { id: r.user._id, name: r.user.name ?? null, email: r.user.email ?? null } : null,
        ])
      );
    }

    const getScannedBy = (taskId) => {
      const recordId = taskIdByRecordId[taskId];
      return recordId ? (ownerByRecordId[recordId] ?? null) : null;
    };

    const myTasks = tasks.filter((task) => {
      const scannedBy = getScannedBy(task.id);
      return scannedBy?.id?.toString() === req.user.id.toString();
    });

    const myCompletedTasks = myTasks.filter((t) => t.status === 3);
    const myLatestCompleted = myCompletedTasks.length
      ? [...myCompletedTasks].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]
      : null;

    // ─── Build the base scans array from task-level stats (fast, no I/O) ──────
    const scanStatsById = {};
    for (const task of myTasks) {
      scanStatsById[task.id] = extractTaskStats(task);
    }

    // ─── Report fallback: GravityZone's getScanTasksList never returns
    //     scanned-file counts, so we pull them from the "On demand scanning"
    //     report (type 15) and match rows to tasks by start-time proximity,
    //     since the report labels every task generically ("Full Scan"). ────
    const pendingTasks = myCompletedTasks.filter(
      (t) => scanStatsById[t.id].filesScanned == null
    );

    if (pendingTasks.length > 0) {
      try {
        const oldestPendingDate = pendingTasks.reduce((min, t) => {
          const d = t.startDate ? new Date(t.startDate) : null;
          if (!d) return min;
          return (!min || d < min) ? d : min;
        }, null);

        const reportingInterval = pickReportingInterval(oldestPendingDate);

        const reportName = `Report_${req.user.id}_${Date.now()}`;
        const createRes = await post(reportsUrl, 'createReport', {
          name: reportName,
          type: 15, // On demand scanning
          targetIds: ['6a202a9198740422ae09c75e'],
          options: { reportingInterval },
        }, 'report-create');

        console.log('[getScanReport][DEBUG] reportingInterval used:', reportingInterval);
        console.log('[getScanReport][DEBUG] createReport response:', JSON.stringify(createRes.data));

        if (createRes.data.error) {
          throw new Error(createRes.data.error.message || 'createReport failed');
        }

        const reportId = createRes.data.result;
        let link = null;

        if (reportId) {
          for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const dlRes = await post(reportsUrl, 'getDownloadLinks', { reportId }, 'report-dl');
            const result = dlRes.data.result;
            if (result?.readyForDownload) {
              link = result.lastInstanceUrl || result.allInstancesUrl;
              break;
            }
          }

          console.log('[getScanReport][DEBUG] reportId:', reportId, 'link:', link);

          let csvData = null;
          if (link) csvData = await downloadCSVFromLink(link, headers.Authorization);
          post(reportsUrl, 'deleteReport', { reportId }, 'report-del').catch(() => { });

          console.log('[getScanReport][DEBUG] csvData present:', !!csvData);

          if (csvData) {
            const rows = parseCSVRows(csvData);
            console.log('[getScanReport][DEBUG] CSV row count:', rows.length);

            // Build a list of usable candidate scans from the report:
            // { scanTime, filesScanned }
            const candidates = rows
              .map((r) => {
                const scanTime = parseBDDate(r['last successful scan - start time']);
                const filesScanned = getExact(r, 'last successful scan - scanned files');
                return (scanTime && filesScanned > 0) ? { scanTime, filesScanned } : null;
              })
              .filter(Boolean);

            console.log('[getScanReport][DEBUG] usable candidate rows:', candidates.length);

            // Greedy nearest-match: each pending task claims the closest
            // unclaimed candidate row within a 15-minute window.
            const usedIdx = new Set();
            const sortedPending = [...pendingTasks].sort(
              (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
            );

            for (const task of sortedPending) {
              const taskTime = task.startDate ? new Date(task.startDate) : null;
              if (!taskTime) continue;

              let bestIdx = -1;
              let bestDelta = Infinity;
              candidates.forEach((c, idx) => {
                if (usedIdx.has(idx)) return;
                const delta = Math.abs(c.scanTime.getTime() - taskTime.getTime());
                if (delta < 15 * 60 * 1000 && delta < bestDelta) {
                  bestDelta = delta;
                  bestIdx = idx;
                }
              });

              if (bestIdx !== -1) {
                usedIdx.add(bestIdx);
                const matched = candidates[bestIdx];

                scanStatsById[task.id] = {
                  filesScanned: matched.filesScanned,
                  threatsDetected: scanStatsById[task.id]?.threatsDetected ?? 0,
                };

                const matchedRecordId = taskIdByRecordId[task.id];
                if (matchedRecordId) {
                  await SelfHelpTool.findByIdAndUpdate(matchedRecordId, {
                    filesScanned: matched.filesScanned,
                    threatsDetected: scanStatsById[task.id].threatsDetected,
                  }).catch(() => { });
                }
              }
            }
          }
        }
      } catch (reportErr) {
        console.warn('[getScanReport] Report fallback error:', reportErr.message);
        if (reportErr.response) {
          console.warn('[getScanReport] Report fallback error response:', JSON.stringify(reportErr.response.data));
        }
      }
    }

    // ─── Build scans[] using the (possibly patched) stats map ────────────────
    const scans = myTasks.map((task) => {
      const info = scanStatsById[task.id] ?? { filesScanned: null, threatsDetected: 0 };

      return {
        id: task.id,
        name: task.name,
        startDate: task.startDate,
        requestedBy: getScannedBy(task.id),
        status:
          task.status === 3 ? '✅ Completed' :
            task.status === 2 ? '🔄 Running' :
              task.status === 1 ? '⏳ Pending' : '❌ Failed',
        filesScanned: info.filesScanned,
        filesScannedAvailable: info.filesScanned != null && info.filesScanned > 0,
        threatsDetected: info.threatsDetected,
      };
    });

    const userLastScan = await SelfHelpTool.findOne({ user: req.user.id, category: 'security' }).sort({ createdAt: -1 });

    let recentFilesScanned = null;
    let recentThreatsDetected = 0;
    let recentFilesScannedAvailable = false;

    if (myLatestCompleted) {
      const latestInfo = scanStatsById[myLatestCompleted.id] ?? extractTaskStats(myLatestCompleted);
      recentFilesScanned = latestInfo.filesScanned;
      recentThreatsDetected = latestInfo.threatsDetected;
      recentFilesScannedAvailable = recentFilesScanned != null && recentFilesScanned > 0;
    }

    let filesScanned = null;
    let threatsDetected = 0;
    let filesScannedAvailable = false;

    if (userLastScan) {
      if (userLastScan.filesScanned != null && userLastScan.filesScanned > 0) {
        filesScanned = userLastScan.filesScanned;
        threatsDetected = userLastScan.threatsDetected ?? 0;
        filesScannedAvailable = true;
      } else if (userLastScan.bdTaskId && scanStatsById[userLastScan.bdTaskId]) {
        const taskInfo = scanStatsById[userLastScan.bdTaskId];
        filesScanned = taskInfo.filesScanned;
        threatsDetected = taskInfo.threatsDetected;
        filesScannedAvailable = filesScanned != null && filesScanned > 0;
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
        totalScans: myTasks.length,
        completedScans: myCompletedTasks.length,
      },
      recentScan: myLatestCompleted ? {
        taskId: myLatestCompleted.id,
        taskName: myLatestCompleted.name,
        scanDate: myLatestCompleted.startDate ?? null,
        scannedBy: getScannedBy(myLatestCompleted.id),
        filesScanned: recentFilesScanned,
        filesScannedAvailable: recentFilesScannedAvailable,
        threatsDetected: recentThreatsDetected,
      } : null,
      scans,
      userLastScan: userLastScan ? {
        id: userLastScan._id,
        status: userLastScan.status,
        progress: userLastScan.progress,
        scanStartedAt: userLastScan.scanStartedAt,
        scanFinishedAt: userLastScan.scanFinishedAt,
        filesScanned,
        filesScannedAvailable,
        threatsDetected,
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

    const backupPath = await runBackup();
    await SelfHelpTool.findByIdAndUpdate(record._id, {
      progress: 100,
      status: 'completed',
      scanFinishedAt: new Date(),
    });

    return res.status(200).json({ success: true, message: 'Backup completed', backupPath });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── getReportData (debug endpoint) ──────────────────────────────────────────
const getReportData = async (req, res) => {
  try {
    const headers = getBDHeaders();
    const { networkUrl } = getBDUrls();

    const post = (url, method, params, id) =>
      axios.post(url, { jsonrpc: '2.0', method, params, id }, { headers });

    const endpointRes = await post(networkUrl, 'getManagedEndpointDetails', { endpointId: '6a202a9198740422ae09c75e' }, 'ep-details');
    return res.json(endpointRes.data);
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
  getReportData
};