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

const startTool = async (req, res) => {
  try {
    const { toolId } = req.body;

    const category = categoryMap[toolId];

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tool',
      });
    }

    const record = await SelfHelpTool.create({
      user: req.user.id,
      category,
      scanStartedAt: new Date(),
      progress: 0,
    });

    // Antivirus Scan → Bitdefender
    if (toolId === 'antivirus-scan') {
      try {
        // Bitdefender API keys typically require Base64 encoding for Basic Auth
        const apiKey = process.env.BITDEFENDER_API_KEY;
        const encodedKey = Buffer.from(`${apiKey}:`).toString('base64');

        const response = await axios.post(
          process.env.BITDEFENDER_API_URL,
          {
            jsonrpc: "2.0",
            method: "createScanTask", // Standard Bitdefender JSON-RPC method
            params: {
              targetIds: ["6a202a9198740422ae09c75e"], // Bitdefender needs to know WHAT to scan
              type: 1, // 1 = Quick Scan, 2 = Full Scan
              name: `SelfHelp_Scan_${record._id}`
            },
            id: record._id.toString() // Request ID mapped to your DB record
          },
          {
            headers: {
              'Authorization': `Basic ${encodedKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        // Bitdefender responds with an 'error' object inside a successful 200 HTTP status if logic fails
        if (response.data.error) {
          throw new Error(response.data.error.message || 'Bitdefender internal error');
        }

        await systemLogger({
          type: "success",
          action: "ANTIVIRUS_SCAN_STARTED",
          user: req.user?.id,
          userEmail: req.user?.email,
          details: `Antivirus scan started (Tool record ${record._id})`,
          module: "antivirus",
          ipAddress: req.ip,
        });

        return res.status(200).json({
          success: true,
          tool: record,
          bitdefenderResponse: response.data.result,
        });
      } catch (err) {
        // Log the exact error response from Axios to see what Bitdefender complained about
        console.error("Bitdefender Axios Error:", err.response ? err.response.data : err.message);

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
          message: 'Bitdefender scan failed',
          error: err.response ? JSON.stringify(err.response.data) : err.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      tool: record,
    });
  } catch (error) {
    console.error(error);

    await systemLogger({
      type: "error",
      action: "SELF_HELP_TOOL_START_ERROR",
      user: req.user?.id,
      userEmail: req.user?.email,
      details: error.message,
      module: "self-help-tools",
      ipAddress: req.ip,
    });

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getToolStatus = async (req, res) => {
  try {
    const tool = await SelfHelpTool.findById(req.params.id);

    if (!tool) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    // Auto-increment progress in DB each time status is polled
    if (tool.progress < 100) {
      tool.progress = Math.min(tool.progress + 20, 100);

      if (tool.progress === 100) {
        tool.scanFinishedAt = new Date();

        if (tool.category === 'security') {
          await systemLogger({
            type: "success",
            action: "ANTIVIRUS_SCAN_COMPLETED",
            user: req.user?.id,
            userEmail: req.user?.email,
            details: `Antivirus scan completed (Tool record ${tool._id})`,
            module: "antivirus",
            ipAddress: req.ip,
          });
        }
      }

      await tool.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        id: tool._id,
        category: tool.category,
        progress: tool.progress,
        scanStartedAt: tool.scanStartedAt,
        scanFinishedAt: tool.scanFinishedAt,
        status: tool.progress === 100 ? 'completed' : 'running',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getEndpoints = async (req, res) => {
  try {
    const apiKey = process.env.BITDEFENDER_API_KEY;
    const encodedKey = Buffer.from(`${apiKey}:`).toString("base64");

    const response = await axios.post(
      process.env.BITDEFENDER_API_URL,
      {
        jsonrpc: "2.0",
        method: "getEndpointsList",
        params: {
          page: 1,
          perPage: 100
        },
        id: "1"
      },
      {
        headers: {
          Authorization: `Basic ${encodedKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.json(response.data);
  } catch (err) {
    console.error("STATUS:", err.response?.status);
    console.error("DATA:", err.response?.data);
    console.error("MESSAGE:", err.message);

    await systemLogger({
      type: "error",
      action: "ANTIVIRUS_GET_ENDPOINTS_ERROR",
      user: req.user?.id,
      userEmail: req.user?.email,
      details: err.response?.data ? JSON.stringify(err.response.data) : err.message,
      module: "antivirus",
      ipAddress: req.ip,
    });

    return res.status(500).json({
      success: false,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
  }
};

// Add to selfHelp.controller.js
const getScanResults = async (req, res) => {
  try {
    const apiKey = process.env.BITDEFENDER_API_KEY;
    const encodedKey = Buffer.from(`${apiKey}:`).toString("base64");

    const response = await axios.post(
      process.env.BITDEFENDER_API_URL,
      {
        jsonrpc: "2.0",
        method: "getScanTasksList",
        params: { page: 1, perPage: 10 },
        id: "1"
      },
      {
        headers: {
          Authorization: `Basic ${encodedKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.json(response.data);
  } catch (err) {
    await systemLogger({
      type: "error",
      action: "ANTIVIRUS_GET_SCAN_RESULTS_ERROR",
      user: req.user?.id,
      userEmail: req.user?.email,
      details: err.message,
      module: "antivirus",
      ipAddress: req.ip,
    });

    return res.status(500).json({ message: err.message });
  }
};

const getScanReport = async (req, res) => {
  try {
    const apiKey     = process.env.BITDEFENDER_API_KEY;
    const encodedKey = Buffer.from(`${apiKey}:`).toString("base64");
    const headers    = {
      Authorization: `Basic ${encodedKey}`,
      "Content-Type": "application/json",
    };

    const BASE       = process.env.BITDEFENDER_API_URL
      .replace(/\/(network|reports|incidents|accounts)$/, "");
    const networkUrl = `${BASE}/network`;
    const reportsUrl = `${BASE}/reports`;

    const post = (url, method, params, id) =>
      axios.post(url, { jsonrpc: "2.0", method, params, id }, { headers });

    // ─── CSV parser (handles quoted fields with commas) ───────────────────────
    const parseCSVLine = (line) => {
      const result = [];
      let current  = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ""));
      return result;
    };

    // ─── Download ZIP / CSV from a link ──────────────────────────────────────
    const downloadAndExtractCSV = async (link) => {
      try {
        const separator = link.includes("?") ? "&" : "?";
        const csvRes    = await axios.get(`${link}${separator}format=csv`, {
          headers:      { Authorization: `Basic ${encodedKey}` },
          responseType: "text",
        });
        if (csvRes.data && !csvRes.data.startsWith("%PDF") && csvRes.data.includes(",")) {
          return csvRes.data;
        }
      } catch (_) {}

      const binRes = await axios.get(link, {
        headers:      { Authorization: `Basic ${encodedKey}` },
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(binRes.data);
      const magic  = buffer.slice(0, 4).toString("hex");

      if (magic === "504b0304") {
        const AdmZip   = require("adm-zip");
        const zip      = new AdmZip(buffer);
        const entries  = zip.getEntries();
        const csvEntry = entries.find((e) => e.entryName.toLowerCase().endsWith(".csv"));
        if (csvEntry) return csvEntry.getData().toString("utf8");
      }

      return null;
    };

    // ─── Create report, poll, download, delete ────────────────────────────────
    const fetchReportCSV = async (type, idPrefix) => {
      const reportName = `TempReport_${idPrefix}_${Date.now()}`;
      const createRes  = await post(reportsUrl, "createReport", {
        name:      reportName,
        type,
        targetIds: ["6a202a9198740422ae09c75e"],
        options:   { reportingInterval: 0 },
      }, `${idPrefix}-create`);

      const reportId = createRes.data.result;
      if (!reportId) throw new Error(`createReport failed for type ${type}`);
      console.log(`[type=${type}] Created reportId:`, reportId);

      let link = null;
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const dlRes  = await post(reportsUrl, "getDownloadLinks", { reportId }, `${idPrefix}-dl`);
        const result = dlRes.data.result;
        if (result?.readyForDownload === true) {
          link = result.lastInstanceUrl || result.allInstancesUrl;
          console.log(`[type=${type}] ✅ Ready, link:`, link);
          break;
        }
      }

      let csvData = null;
      if (link) csvData = await downloadAndExtractCSV(link);

      try {
        await post(reportsUrl, "deleteReport", { reportId }, `${idPrefix}-del`);
        console.log(`[type=${type}] Report deleted.`);
      } catch (_) {}

      return csvData;
    };

    // ─── Parse CSV first data row → header→value map ─────────────────────────
    const parseCSVToMap = (csvData) => {
      if (!csvData) return {};
      const lines = csvData.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return {};
      const hdrs = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
      const vals = parseCSVLine(lines[1]);
      const map  = {};
      hdrs.forEach((h, i) => { map[h] = vals[i] ?? "0"; });
      return map;
    };

    // ─── Read integer from map by exact key ──────────────────────────────────
    const getExact = (map, key) => {
      const raw = map[key];
      if (raw === undefined || raw === "" || raw === "N/A") return 0;
      const parsed = parseInt(raw.replace(/,(?=\d{3})/g, ""), 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    // ─── Fetch all scan tasks (paginated) ────────────────────────────────────
    const getAllTasks = async () => {
      const perPage = 100;
      let page      = 1;
      let allTasks  = [];

      while (true) {
        const taskRes = await post(networkUrl, "getScanTasksList", { page, perPage }, `tasks-p${page}`);
        const items   = taskRes.data.result?.items || [];
        const total   = taskRes.data.result?.total  || 0;
        allTasks = allTasks.concat(items);
        if (allTasks.length >= total || items.length < perPage) break;
        page++;
      }

      return allTasks;
    };

    // ─── Step 1: Tasks + endpoint + both reports — all in parallel ────────────
    const [tasks, endpointRes, malwareCSV, onDemandCSV] = await Promise.all([
      getAllTasks(),
      post(networkUrl, "getManagedEndpointDetails", {
        endpointId: "6a202a9198740422ae09c75e",
      }, "endpoint"),
      fetchReportCSV(12, "malware"),   // Malware Status  → unresolved threats
      fetchReportCSV(15, "ondemand"),  // On-demand scan  → last successful scan files
    ]);

    const endpoint       = endpointRes.data.result;
    const completedTasks = tasks.filter((t) => t.status === 3);
    const latestCompleted = [...completedTasks].reverse()[0] ?? null;

    // ─── Step 2: Parse report values ─────────────────────────────────────────
    const malwareMap    = parseCSVToMap(malwareCSV);
    const onDemandMap   = parseCSVToMap(onDemandCSV);

    const threatsDetected = getExact(malwareMap,  "unresolved");
    const filesScanned    = getExact(onDemandMap, "last successful scan - scanned files");

    // ─── Step 3: Build scans array ───────────────────────────────────────────
    const scans = tasks.map((task) => ({
      id:              task.id,
      name:            task.name,
      startDate:       task.startDate,
      filesScanned:    task.id === latestCompleted?.id ? filesScanned : 0,
      threatsDetected: task.id === latestCompleted?.id ? threatsDetected : 0,
      status:
        task.status === 3 ? "✅ Completed" :
        task.status === 2 ? "🔄 Running"   :
        task.status === 1 ? "⏳ Pending"   : "❌ Failed",
    }));

    await systemLogger({
      type: threatsDetected > 0 ? "warning" : "success",
      action: "ANTIVIRUS_SCAN_REPORT_FETCHED",
      user: req.user?.id,
      userEmail: req.user?.email,
      details: threatsDetected > 0
        ? `Scan report fetched — ${threatsDetected} unresolved threat(s) detected`
        : `Scan report fetched — no threats detected (${filesScanned} files scanned)`,
      module: "antivirus",
      ipAddress: req.ip,
      metadata: { filesScanned, threatsDetected, totalScans: tasks.length },
    });

    // ─── Step 4: Return response ──────────────────────────────────────────────
    return res.json({
      success: true,

      machine: {
        name:           endpoint?.name,
        ip:             endpoint?.ip,
        os:             endpoint?.operatingSystem,
        lastSeen:       endpoint?.lastSeen,
        securityStatus: endpoint?.state,
        infected:       endpoint?.malwareStatus?.infected  ?? false,
        detection:      endpoint?.malwareStatus?.detection ?? false,
        agentVersion:   endpoint?.agent?.productVersion,
        engineVersion:  endpoint?.agent?.engineVersion,
        lastUpdate:     endpoint?.agent?.lastUpdate,
      },

      stats: {
        filesScanned,
        threatsBlocked: threatsDetected,
        totalScans:     tasks.length,
        completedScans: completedTasks.length,
      },

      recentScan: {
        taskId:          latestCompleted?.id        ?? null,
        taskName:        latestCompleted?.name      ?? null,
        scanDate:        latestCompleted?.startDate ?? null,
        filesScanned,
        threatsDetected,
        isClean:         threatsDetected === 0,
      },

      scans,
    });

  } catch (err) {
    console.error(err.response?.data || err.message);

    await systemLogger({
      type: "error",
      action: "ANTIVIRUS_SCAN_REPORT_ERROR",
      user: req.user?.id,
      userEmail: req.user?.email,
      details: err.response?.data ? JSON.stringify(err.response.data) : err.message,
      module: "antivirus",
      ipAddress: req.ip,
    });

    return res.status(500).json({ success: false, message: err.message });
  }
};

const startBackup = async (req, res) => {
  try {
    const backupPath = await runBackup();
    return res.status(200).json({
      success: true,
      message: 'Backup completed',
      backupPath,
    });
  } catch (error) {
    console.error('Backup error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  startTool,
  getToolStatus,
  getEndpoints,
  getScanResults,
  getScanReport,
  startBackup
};