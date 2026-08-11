const SelfHelpTool = require('../../models/tools/SelfHelpTool');
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { runBackup, backupDir } = require('../../cron/autoBackup');
const AdmZip = require("adm-zip");
const systemLogger = require("../../utils/systemLogger");

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
const parseCSVLine = (line, delimiter) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === delimiter && !inQuotes) { result.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
    else { current += char; }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

// Bitdefender's CSV export delimiter can vary (comma vs semicolon) depending
// on the account's locale settings. Detect it from the header line instead
// of assuming comma, otherwise every column collapses into one field and
// nothing downstream matches.
const detectDelimiter = (headerLine) => {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  return semiCount > commaCount ? ';' : ',';
};

// Parses the FULL CSV into an array of row objects (one per data line),
// instead of only reading the header + first row. GravityZone's
// "On demand scanning" report returns one row per individual scan
// execution, not one aggregated summary row.
const parseCSVRows = (csvData) => {
  if (!csvData) return { rows: [], headers: [] };
  const cleaned = csvData.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(Boolean);
  if (lines.length < 1) return { rows: [], headers: [] };

  const delimiter = detectDelimiter(lines[0]);
  const hdrs = parseCSVLine(lines[0], delimiter).map((h) => h.toLowerCase().trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i], delimiter);
    if (!vals.length) continue;
    const row = {};
    hdrs.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return { rows, headers: hdrs };
};

// Finds a column value by fuzzy-matching header text, since GravityZone's
// exact wording for report columns varies by report type/version/locale
// (e.g. "Last successful scan - Scanned files" vs "Scanned files" vs
// "Objects scanned"). `patterns` is a list of keyword-arrays; a header
// matches if it contains ALL keywords in at least one array.
const findFieldValue = (row, patterns) => {
  const keys = Object.keys(row);
  for (const keywords of patterns) {
    const match = keys.find((k) => keywords.every((kw) => k.includes(kw)));
    if (match) return row[match];
  }
  return undefined;
};

const getExact = (raw) => {
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

  const now = new Date();

  const startOfWeek = (d) => {
    const copy = new Date(d);
    const day = (copy.getDay() + 6) % 7; // 0 = Monday
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - day);
    return copy;
  };

  const sameCalendarWeek = startOfWeek(oldestDate).getTime() === startOfWeek(now).getTime();

  const sameCalendarMonth =
    oldestDate.getFullYear() === now.getFullYear() &&
    oldestDate.getMonth() === now.getMonth();

  if (days <= 1) return 1; // Last day
  if (days <= 7 && sameCalendarWeek) return 2; // This week (only if truly same week)
  if (days <= 14) return 3; // Last week (covers spillover into prior week)
  if (days <= 30 && sameCalendarMonth) return 4; // This month
  if (days <= 60) return 6; // Last 2 months
  if (days <= 90) return 7; // Last 3 months
  return 8; // This year
};

// ─── Download ZIP / CSV from a BD report link ─────────────────────────────────
// IMPORTANT: GravityZone's `downloadReportZip` link always returns a real
// ZIP binary. Requesting it with responseType: 'text' (as a first attempt)
// forces axios to decode raw ZIP bytes as UTF-8, which corrupts the payload
// — but the corrupted garbage can still coincidentally contain a comma
// character, so a naive `.includes(',')` check can wrongly accept it as
// "CSV data present" while it's actually unparsable noise. Binary magic-byte
// detection must always come first.
const downloadCSVFromLink = async (link, authHeader) => {
  const binRes = await axios.get(link, {
    headers: { Authorization: authHeader },
    responseType: 'arraybuffer',
  });
  const buffer = Buffer.from(binRes.data);

  const isZip = buffer.slice(0, 4).toString('hex') === '504b0304';
  const isPDF = buffer.slice(0, 4).toString('latin1') === '%PDF';

  if (isZip) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    console.log('[downloadCSVFromLink][DEBUG] zip entries:', entries.map((e) => e.entryName));
    const csvEntry = entries.find((e) => e.entryName.toLowerCase().endsWith('.csv'));
    if (csvEntry) {
      const text = csvEntry.getData().toString('utf8');
      console.log('[downloadCSVFromLink][DEBUG] csv entry bytes:', csvEntry.getData().length);
      return text;
    }
    console.warn('[downloadCSVFromLink][DEBUG] zip contained no .csv entry');
    return null;
  }

  if (isPDF) {
    console.warn('[downloadCSVFromLink][DEBUG] link returned a PDF, not a CSV/ZIP');
    return null;
  }

  // Not a zip, not a PDF — the bytes might just be plain CSV text already.
  const asText = buffer.toString('utf8');
  if (asText.includes(',') || asText.includes(';')) {
    return asText;
  }

  // Last resort fallback for endpoints that do honor an explicit format param.
  try {
    const separator = link.includes('?') ? '&' : '?';
    const csvRes = await axios.get(`${link}${separator}format=csv`, {
      headers: { Authorization: authHeader },
      responseType: 'text',
    });
    if (csvRes.data && !String(csvRes.data).startsWith('%PDF') && (String(csvRes.data).includes(',') || String(csvRes.data).includes(';'))) {
      return csvRes.data;
    }
  } catch (_) { }

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
              targetIds: ["6a742295aec4de6bb6853cc4"],
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

        const bitdefenderTaskId = response.data.result;
        const updated = await SelfHelpTool.findByIdAndUpdate(
          record._id,
          { status: "running", progress: 10, bitdefenderTaskId },
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
      if (tool.status !== 'completed' && tool.status !== 'failed' && tool.bitdefenderTaskId) {
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
          const taskMatch = items.find(t => t.id === tool.bitdefenderTaskId);

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
  // TEMPORARY: mirrors the [getScanReport][DEBUG] console.log lines into the
  // JSON response so the report-fallback pipeline can be diagnosed from the
  // browser Network tab when server terminal access isn't available.
  // Remove this block (and the `debug: debugInfo` line near the bottom)
  // once files-scanned is confirmed working reliably.
  const debugInfo = {
    pendingTasksCount: null,
    reportingIntervalUsed: null,
    createReportResponse: null,
    createReportError: null,
    reportId: null,
    reportReadyLink: null,
    reportPollTimedOut: null,
    csvDataPresent: null,
    csvHeadersFound: null,
    csvRowCount: null,
    usableCandidateRows: null,
    sampleRow: null,
    matchedLatestCompletedTask: null,
    matchedCount: null,
    staleReportSkipped: null,
    staleSkippedCount: null,
    matchDetails: null,
    reportFallbackError: null,
  };

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
      post(networkUrl, 'getManagedEndpointDetails', { endpointId: '6a742295aec4de6bb6853cc4' }, 'endpoint'),
    ]);

    const endpoint = endpointRes.data.result;

    const taskIdByRecordId = {};
    for (const task of tasks) {
      const match = typeof task.name === 'string' && task.name.match(/^SelfHelp_Scan_([a-f0-9]{24})$/i);
      if (match) taskIdByRecordId[task.id] = match[1];
    }
    const recordIds = Object.values(taskIdByRecordId);

    let ownerByRecordId = {};
    let dbStatsByRecordId = {};
    if (recordIds.length) {
      // Select filesScanned/threatsDetected too, not just for owner display —
      // this lets us skip re-generating a Bitdefender report for any scan
      // whose result was already saved to the DB on a previous request.
      const ownerRecords = await SelfHelpTool.find({ _id: { $in: recordIds } })
        .select('_id user filesScanned threatsDetected')
        .populate('user', 'name email')
        .lean();
      ownerByRecordId = Object.fromEntries(
        ownerRecords.map((r) => [
          r._id.toString(),
          r.user ? { id: r.user._id, name: r.user.name ?? null, email: r.user.email ?? null } : null,
        ])
      );
      dbStatsByRecordId = Object.fromEntries(
        ownerRecords.map((r) => [
          r._id.toString(),
          { filesScanned: r.filesScanned ?? null, threatsDetected: r.threatsDetected ?? 0 },
        ])
      );
    }

    const getScannedBy = (taskId) => {
      const recordId = taskIdByRecordId[taskId];
      return recordId ? (ownerByRecordId[recordId] ?? null) : null;
    };

    // ─── User filter ────────────────────────────────────────────────────
    // Previously this endpoint hard-locked results to req.user.id, so no
    // one (including an admin) could ever see another user's scan history
    // through this API — even though the underlying data covers every
    // user's scans on the endpoint. Now it defaults to showing everyone's
    // scans, with an optional ?userId=<id> query param to narrow the
    // results down to one specific user server-side (the frontend's
    // "Requested by" dropdown can pass this instead of, or in addition to,
    // filtering client-side).
    const requestedUserId = typeof req.query.userId === 'string' && req.query.userId.trim()
      ? req.query.userId.trim()
      : null;

    const scopedTasks = tasks.filter((task) => {
      const scannedBy = getScannedBy(task.id);
      if (!scannedBy) return false; // exclude tasks we can't attribute to any known user
      if (!requestedUserId) return true; // no filter — include everyone
      return scannedBy.id?.toString() === requestedUserId;
    });

    const myCompletedTasks = scopedTasks.filter((t) => t.status === 3);
    const myLatestCompleted = myCompletedTasks.length
      ? [...myCompletedTasks].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]
      : null;
    const myFailedTasks = scopedTasks.filter((t) => t.status === 4);

    // ─── Sync SelfHelpTool record status with the real Bitdefender task
    //     status. Previously, a record only left "running"/progress:10 when
    //     getToolStatus happened to be polled and saw status === 3 — if the
    //     frontend instead only ever called getScanReport (as it does once
    //     scanning finishes), the record stayed stuck at "running" forever
    //     even though the underlying scan had completed. ─────────────────
    const recordIdsToSync = [
      ...myCompletedTasks.map((t) => ({ id: taskIdByRecordId[t.id], finishedAt: t.endDate ? new Date(t.endDate) : new Date() })),
      ...myFailedTasks.map((t) => ({ id: taskIdByRecordId[t.id], failed: true })),
    ].filter((r) => r.id);

    if (recordIdsToSync.length) {
      await Promise.all(recordIdsToSync.map(({ id, finishedAt, failed }) =>
        SelfHelpTool.updateOne(
          { _id: id, status: { $nin: ['completed', 'failed'] } },
          failed
            ? { $set: { status: 'failed' } }
            : { $set: { status: 'completed', progress: 100, scanFinishedAt: finishedAt } }
        ).catch(() => { })
      ));
    }

    // ─── Build the base scans array from task-level stats (fast, no I/O).
    //     Hydrate from the DB first wherever we already have a saved value —
    //     this is what prevents re-triggering a brand-new Bitdefender report
    //     (createReport + up to 60 polling calls) on every single dashboard
    //     refresh for scans that were already resolved on a prior request.
    //     Without this, repeated polling reliably hits GravityZone's API
    //     rate limit (HTTP 429). ───────────────────────────────────────────
    const scanStatsById = {};
    for (const task of scopedTasks) {
      const recordId = taskIdByRecordId[task.id];
      const dbStats = recordId ? dbStatsByRecordId[recordId] : null;
      if (dbStats && dbStats.filesScanned != null && dbStats.filesScanned > 0) {
        scanStatsById[task.id] = dbStats;
      } else {
        scanStatsById[task.id] = extractTaskStats(task);
      }
    }

    // ─── Report fallback: GravityZone's getScanTasksList never returns
    //     scanned-file counts, so we pull them from the "On demand scanning"
    //     report (type 15), which contains the endpoint's single latest
    //     successful scan. ──────────────────────────────────────────────
    const pendingTasks = myCompletedTasks.filter(
      (t) => scanStatsById[t.id].filesScanned == null
    );

    debugInfo.pendingTasksCount = pendingTasks.length;

    if (pendingTasks.length > 0) {
      try {
        // GravityZone's "On demand scanning" report (type 15) returns ONE ROW
        // PER TARGETED ENDPOINT, containing that endpoint's most recent
        // successful scan (columns like "last successful scan - start time",
        // "last successful scan - scanned files"). It is NOT one row per scan
        // execution, so there is nothing to time-match against per task —
        // the report can only ever tell us about the single latest scan.
        // Always request the widest available window so today's scan is
        // guaranteed to fall inside it, regardless of how GravityZone buckets
        // "Last day" / "This week" etc.
        const reportingInterval = 8; // This year — widest available option
        debugInfo.reportingIntervalUsed = reportingInterval;

        const reportName = `Report_${req.user.id}_${Date.now()}`;
        const createRes = await post(reportsUrl, 'createReport', {
          name: reportName,
          type: 15, // On demand scanning
          targetIds: ['6a742295aec4de6bb6853cc4'],
          options: { reportingInterval },
        }, 'report-create');

        console.log('[getScanReport][DEBUG] reportingInterval used:', reportingInterval);
        console.log('[getScanReport][DEBUG] createReport response:', JSON.stringify(createRes.data));
        debugInfo.createReportResponse = createRes.data;

        if (createRes.data.error) {
          // Surface this distinctly: if it's a licensing/permission error,
          // this is where it will show up (e.g. code -32610 "insufficient
          // permissions" or a plan-tier restriction message from GravityZone).
          debugInfo.createReportError = createRes.data.error;
          throw new Error(
            `createReport failed: ${createRes.data.error.message || 'unknown error'} (code: ${createRes.data.error.code ?? 'n/a'})`
          );
        }

        const reportId = createRes.data.result;
        let link = null;

        // Poll longer (up to ~3 minutes) since report generation time scales
        // with account size and the number of files in each scan (large
        // Local Scan runs can push report compilation well past 90s — 60
        // attempts * 3s gives GravityZone more headroom). A 429 from
        // GravityZone during polling is treated as "not ready yet, back off
        // longer" rather than aborting the whole report attempt.
        if (reportId) {
          const maxAttempts = 60;
          let waitMs = 3000;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, waitMs));
            try {
              const dlRes = await post(reportsUrl, 'getDownloadLinks', { reportId }, 'report-dl');
              const result = dlRes.data.result;
              waitMs = 3000; // reset backoff after a successful call
              if (result?.readyForDownload) {
                link = result.lastInstanceUrl || result.allInstancesUrl;
                break;
              }
            } catch (pollErr) {
              if (pollErr.response?.status === 429) {
                console.warn('[getScanReport][DEBUG] rate limited while polling, backing off');
                waitMs = Math.min(waitMs * 2, 15000); // exponential backoff, capped at 15s
                continue;
              }
              throw pollErr;
            }
            if (i === maxAttempts - 1) {
              console.warn('[getScanReport][DEBUG] report never became ready for download after', maxAttempts * 3, 'seconds');
              debugInfo.reportPollTimedOut = true;
            }
          }

          console.log('[getScanReport][DEBUG] reportId:', reportId, 'link:', link);
          debugInfo.reportId = reportId;
          debugInfo.reportReadyLink = link;
          if (debugInfo.reportPollTimedOut == null) debugInfo.reportPollTimedOut = false;

          let csvData = null;
          if (link) csvData = await downloadCSVFromLink(link, headers.Authorization);
          post(reportsUrl, 'deleteReport', { reportId }, 'report-del').catch(() => { });

          console.log('[getScanReport][DEBUG] csvData present:', !!csvData);
          debugInfo.csvDataPresent = !!csvData;

          if (csvData) {
            const { rows, headers: csvHeaders } = parseCSVRows(csvData);
            console.log('[getScanReport][DEBUG] CSV headers found:', csvHeaders);
            console.log('[getScanReport][DEBUG] CSV row count:', rows.length);
            debugInfo.csvHeadersFound = csvHeaders;
            debugInfo.csvRowCount = rows.length;

            // Column names matched fuzzily (any header containing all
            // keywords in one of these arrays) since GravityZone's wording
            // varies by report/locale.
            const scanTimePatterns = [
              ['last successful scan', 'start time'],
              ['last scan', 'start time'],
              ['scan start time'],
              ['start time'],
            ];
            const scannedFilesPatterns = [
              ['last successful scan', 'scanned files'],
              ['scanned files'],
              ['scanned objects'],
              ['objects scanned'],
              ['files scanned'],
            ];

            const candidates = rows
              .map((r) => {
                const scanTime = parseBDDate(findFieldValue(r, scanTimePatterns));
                const filesScanned = getExact(findFieldValue(r, scannedFilesPatterns));
                return (filesScanned > 0) ? { scanTime, filesScanned } : null;
              })
              .filter(Boolean);

            console.log('[getScanReport][DEBUG] usable candidate rows:', candidates.length);
            debugInfo.usableCandidateRows = candidates.length;
            if (rows.length > 0 && candidates.length === 0) {
              console.warn('[getScanReport][DEBUG] No candidates matched. Sample row:', JSON.stringify(rows[0]));
              debugInfo.sampleRow = rows[0];
            }

            // Correction: this report is NOT limited to one row per endpoint
            // — with a wide enough reportingInterval it returns one row per
            // completed scan. Grabbing "row 0" (as an earlier version of
            // this code did) is wrong: rows aren't guaranteed to be sorted
            // newest-first, so row 0 can be an old scan, permanently
            // starving newer tasks of their real data.
            //
            // Correct approach: match EACH pending task to its OWN row,
            // chronologically. Sort both tasks and candidate rows by time
            // ascending, then greedily assign each task the earliest
            // still-unused row whose scan time is at or after the task's
            // own start time (a completed scan can't be reporting on
            // something that finished before it started — that's the
            // staleness guard, now applied per-task instead of once).
            const sortedPendingTasks = [...pendingTasks].sort(
              (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
            );
            const sortedCandidates = [...candidates]
              .map((c, idx) => ({ ...c, idx }))
              .filter((c) => c.scanTime)
              .sort((a, b) => a.scanTime.getTime() - b.scanTime.getTime());

            const usedCandidateIdx = new Set();
            let matchedCount = 0;
            let staleSkippedCount = 0;
            const matchDetails = [];

            for (const task of sortedPendingTasks) {
              const taskStart = task.startDate ? new Date(task.startDate) : null;
              if (!taskStart) continue;

              const candidate = sortedCandidates.find(
                (c) => !usedCandidateIdx.has(c.idx) && c.scanTime.getTime() >= taskStart.getTime()
              );

              if (!candidate) {
                staleSkippedCount++;
                matchDetails.push({
                  taskId: task.id,
                  taskStart: taskStart.toISOString(),
                  result: 'no report row at/after task start yet — still pending',
                });
                continue;
              }

              usedCandidateIdx.add(candidate.idx);
              matchedCount++;
              matchDetails.push({
                taskId: task.id,
                taskStart: taskStart.toISOString(),
                matchedScanTime: candidate.scanTime.toISOString(),
                filesScanned: candidate.filesScanned,
              });

              scanStatsById[task.id] = {
                filesScanned: candidate.filesScanned,
                threatsDetected: scanStatsById[task.id]?.threatsDetected ?? 0,
              };

              const matchedRecordId = taskIdByRecordId[task.id];
              if (matchedRecordId) {
                await SelfHelpTool.findByIdAndUpdate(matchedRecordId, {
                  filesScanned: candidate.filesScanned,
                  threatsDetected: scanStatsById[task.id].threatsDetected,
                }).catch(() => { });
              }
            }

            console.log('[getScanReport][DEBUG] per-task match results:', JSON.stringify(matchDetails));
            debugInfo.matchedLatestCompletedTask = matchedCount > 0;
            debugInfo.matchedCount = matchedCount;
            debugInfo.staleReportSkipped = staleSkippedCount > 0;
            debugInfo.staleSkippedCount = staleSkippedCount;
            debugInfo.matchDetails = matchDetails;
          }
        }
      } catch (reportErr) {
        console.warn('[getScanReport] Report fallback error:', reportErr.message);
        debugInfo.reportFallbackError = reportErr.message;
        if (reportErr.response) {
          console.warn('[getScanReport] Report fallback error response:', JSON.stringify(reportErr.response.data));
          debugInfo.reportFallbackError += ' | response: ' + JSON.stringify(reportErr.response.data);
        }
      }
    }

    // ─── Build scans[] using the (possibly patched) stats map ────────────────
    const scans = scopedTasks.map((task) => {
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

    // Full list of users who have requested a scan on this endpoint, built
    // from ALL tasks (not scopedTasks) so the filter dropdown always offers
    // every option regardless of which filter is currently applied.
    const availableRequesters = Array.from(
      new Map(
        tasks
          .map((task) => getScannedBy(task.id))
          .filter(Boolean)
          .map((user) => [user.id?.toString(), user])
      ).values()
    );

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
      } else if (userLastScan.bitdefenderTaskId && scanStatsById[userLastScan.bitdefenderTaskId]) {
        const taskInfo = scanStatsById[userLastScan.bitdefenderTaskId];
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
        totalScans: scopedTasks.length,
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
      // Every user who has ever requested a scan on this endpoint, and the
      // filter currently applied (null = showing everyone). The frontend's
      // "Requested by" dropdown should source its options from this list
      // rather than deriving it from `scans`, since `scans` is already
      // filtered down to `appliedUserFilter` when one is set.
      availableRequesters,
      appliedUserFilter: requestedUserId,
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
      debug: debugInfo, // TEMPORARY — remove once files-scanned is confirmed working
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, debug: debugInfo });
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

    // runBackup() may return either a plain path string, or an object like
    // { backupPath, collections, message } — handle both so we never pass
    // a non-string into fs/path APIs.
    const backupPath =
      typeof backupResult === 'string' ? backupResult : backupResult?.backupPath ?? null;
    const collections = Array.isArray(backupResult?.collections) ? backupResult.collections : undefined;

    // Best-effort file size lookup — never let a stat failure fail the backup.
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
// Returns the current user's completed backups, most recent first, so the
// frontend can render a downloadable history list.
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
// Streams a single backup file to the requesting user. Enforces ownership
// and confines the resolved path to BACKUP_DIR to prevent path traversal.
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
    const headers = getBDHeaders();
    const { networkUrl } = getBDUrls();

    const post = (url, method, params, id) =>
      axios.post(url, { jsonrpc: '2.0', method, params, id }, { headers });

    const endpointRes = await post(networkUrl, 'getManagedEndpointDetails', { endpointId: '6a742295aec4de6bb6853cc4' }, 'ep-details');
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
  listBackups,
  downloadBackup,
  getReportData
};