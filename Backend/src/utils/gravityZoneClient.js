const axios = require("axios");
const AdmZip = require("adm-zip");

// ─── Environment ─────────────────────────────────────────────────────────────

const RAW_API_URL = process.env.BITDEFENDER_API_URL;
const RAW_API_KEY = process.env.BITDEFENDER_API_KEY;

if (!RAW_API_URL || !RAW_API_KEY) {
  console.warn(
    "[gravityZoneClient] BITDEFENDER_API_URL or BITDEFENDER_API_KEY missing"
  );
}

const JSONRPC_BASE = RAW_API_URL
  ?.trim()
  .replace(/\/$/, "");


// ─── Authentication ──────────────────────────────────────────────────────────

const authHeader = () => {
  const key = (RAW_API_KEY || "").trim();

  return (
    "Basic " +
    Buffer.from(`${key}:`).toString("base64")
  );
};


// ─── Axios ───────────────────────────────────────────────────────────────────

const http = axios.create({
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});


http.interceptors.response.use((response) => {
  if (
    typeof response.data === "string" &&
    response.data.trim().startsWith("<!DOCTYPE")
  ) {
    throw new Error(
      "[gravityZoneClient] Received HTML instead of JSON. Check BITDEFENDER_API_URL."
    );
  }

  return response;
});


let rpcId = 0;


// ─── Generic RPC ─────────────────────────────────────────────────────────────

const call = async (
  api,
  method,
  params = {}
) => {

  if (!JSONRPC_BASE) {
    throw new Error(
      "[gravityZoneClient] BITDEFENDER_API_URL missing"
    );
  }

  if (!RAW_API_KEY) {
    throw new Error(
      "[gravityZoneClient] BITDEFENDER_API_KEY missing"
    );
  }

  const url = `${JSONRPC_BASE}/${api}`;

  const body = {
    params,
    jsonrpc: "2.0",
    method,
    id: ++rpcId,
  };

  console.log(
    `[gz call] -> ${api}.${method}`,
    JSON.stringify(body)
  );

  const { data } = await http.post(
    url,
    body,
    {
      headers: {
        Authorization: authHeader(),
      },
    }
  );

  console.log(
    `[gz call] <- ${api}.${method}`,
    JSON.stringify(data)
  );

  if (data?.error) {
    const error = new Error(
      data.error.message ||
      "GravityZone API error"
    );

    error.rpcError = data.error;

    throw error;
  }

  return data?.result;
};


// ─────────────────────────────────────────────────────────────────────────────
// PACKAGES API
// ─────────────────────────────────────────────────────────────────────────────

const getPackagesList = (
  params = {}
) => {
  return call(
    "packages",
    "getPackagesList",
    params
  );
};


const getPackageDetails = (
  packageId
) => {

  if (!packageId) {
    throw new Error(
      "packageId is required"
    );
  }

  return call(
    "packages",
    "getPackageDetails",
    {
      packageId:
        typeof packageId === "string"
          ? packageId.trim()
          : packageId,
    }
  );
};


const createPackage = (
  params
) => {
  return call(
    "packages",
    "createPackage",
    params
  );
};


const getInstallationLinks = (
  packageName,
  params = {}
) => {

  const cleanName =
    typeof packageName === "string"
      ? packageName.trim()
      : packageName;

  if (!cleanName) {
    throw new Error(
      "packageName is required"
    );
  }

  return call(
    "packages",
    "getInstallationLinks",
    {
      packageName: cleanName,
      ...params,
    }
  );
};


const getInstallationLinksByPackageId =
  async (packageId) => {

    const cleanId =
      typeof packageId === "string"
        ? packageId.trim()
        : packageId;

    if (!cleanId) {
      throw new Error(
        "packageId is required"
      );
    }

    const details =
      await getPackageDetails(cleanId);

    const packageName =
      details?.name ||
      details?.packageName;

    if (!packageName) {
      throw new Error(
        `Could not resolve package name for ${cleanId}`
      );
    }

    return getInstallationLinks(
      packageName
    );
  };


const buildPackageDownloadUrl = (
  packageId,
  downloadType = 20
) => {

  const httpBase =
    JSONRPC_BASE.replace(
      "/jsonrpc",
      "/http"
    );

  return (
    `${httpBase}/downloadPackageFullKit` +
    `?packageId=${encodeURIComponent(packageId)}` +
    `&downloadType=${downloadType}`
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// NETWORK API
// ─────────────────────────────────────────────────────────────────────────────

const getEndpointsList = (
  params = {}
) => {

  return call(
    "network",
    "getEndpointsList",
    params
  );
};


// Get all managed endpoints
const getManagedEndpoints =
  async () => {

    const response =
      await getEndpointsList({
        isManaged: true,
        page: 1,
        perPage: 1000,
      });

    return response?.items || [];
  };


// ─────────────────────────────────────────────────────────────────────────────
// SCAN API
// ─────────────────────────────────────────────────────────────────────────────

const createScanTask =
  async ({
    endpointId,
    type = 1,
    name = "Self Help Quick Scan",
  }) => {

    if (!endpointId) {
      throw new Error(
        "endpointId is required"
      );
    }

    return call(
      "network",
      "createScanTask",
      {
        targetIds: [
          endpointId,
        ],
        type,
        name,

        // return task ID if supported by instance
        returnTaskId: true,
      }
    );
  };


const getScanTasksList = (
  params = {}
) => {

  return call(
    "network",
    "getScanTasksList",
    params
  );
};


// Find scan by ID
const getScanTaskById =
  async (taskId) => {

    if (!taskId) {
      throw new Error(
        "taskId is required"
      );
    }

    const response =
      await getScanTasksList({
        page: 1,
        perPage: 100,
      });

    const tasks =
      response?.items || [];

    return (
      tasks.find(
        (task) =>
          String(task.id) ===
          String(taskId)
      ) || null
    );
  };
  const getManagedEndpointDetails = async (endpointId) => {
  return call("network", "getManagedEndpointDetails", { endpointId });
};

// Returns { name, startDate, status, type, owner, company } for a task.
// NOTE: this does NOT include scanned/infected item counts — GravityZone's
// task-status API only reports lifecycle state (status: 1 = queued/running,
// 3 = finished, etc.), never file/threat counts. Don't read
// taskStatus.scannedItems / taskStatus.infectedItems, they don't exist.
const getTaskStatus = async (taskId) => {
  if (!taskId) {
    throw new Error("taskId is required");
  }

  return call("network", "getTaskStatus", { taskId });
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS API — the only place GravityZone exposes scanned-file counts
// ─────────────────────────────────────────────────────────────────────────────

const createReport = (params) => call("reports", "createReport", params);

const getReportDownloadLinks = (reportId) => {
  if (!reportId) throw new Error("reportId is required");
  return call("reports", "getDownloadLinks", { reportId });
};

const deleteReport = (reportId) => {
  if (!reportId) return Promise.resolve();
  return call("reports", "deleteReport", { reportId }).catch(() => {});
};

const downloadReportCSV = async (link) => {
  const res = await axios.get(link, {
    headers: { Authorization: authHeader() },
    responseType: "arraybuffer",
  });
  const buffer = Buffer.from(res.data);
  const isZip = buffer.slice(0, 4).toString("hex") === "504b0304";
  if (!isZip) {
    const asText = buffer.toString("utf8");
    return asText.includes(",") || asText.includes(";") ? asText : null;
  }
  const zip = new AdmZip(buffer);
  const csvEntry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".csv"));
  return csvEntry ? csvEntry.getData().toString("utf8") : null;
};

const waitForReportLink = async (reportId, { maxAttempts = 40, initialWaitMs = 3000 } = {}) => {
  let waitMs = initialWaitMs;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, waitMs));
    try {
      const result = await getReportDownloadLinks(reportId);
      if (result?.readyForDownload) return result.lastInstanceUrl || result.allInstancesUrl || null;
      waitMs = initialWaitMs;
    } catch (err) {
      if (err?.response?.status === 429) { waitMs = Math.min(waitMs * 2, 15000); continue; }
      throw err;
    }
  }
  return null;
};

// ─── CSV parsing (column names vary by GravityZone locale, matched fuzzily) ──
const parseCSVLine = (line, delimiter) => {
  const result = [];
  let current = "", inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === delimiter && !inQuotes) { result.push(current.trim().replace(/^"|"$/g, "")); current = ""; }
    else current += char;
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
};
const detectDelimiter = (h) => ((h.match(/;/g) || []).length > (h.match(/,/g) || []).length ? ";" : ",");
const findFieldValue = (row, patternsList) => {
  const keys = Object.keys(row);
  for (const kws of patternsList) {
    const match = keys.find((k) => kws.every((kw) => k.includes(kw)));
    if (match) return row[match];
  }
  return undefined;
};
const parseBDDate = (raw) => {
  if (!raw || raw === "N/A") return null;
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, day, monthName, year, hour, min, sec] = m;
    const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
    if (!isNaN(monthIndex)) return new Date(+year, monthIndex, +day, +hour, +min, +sec);
  }
  const fb = new Date(raw.replace(",", ""));
  return isNaN(fb.getTime()) ? null : fb;
};
const getExactInt = (raw) => {
  if (raw === undefined || raw === "" || raw === "N/A") return 0;
  const p = parseInt(String(raw).replace(/,(?=\d{3})/g, ""), 10);
  return isNaN(p) ? 0 : p;
};

const parseOnDemandScanCsv = (csvData) => {
  const lines = csvData.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const hdrs = parseCSVLine(lines[0], delimiter).map((h) => h.toLowerCase().trim());
  const scanTimePatterns = [["last successful scan", "start time"], ["last scan", "start time"], ["scan start time"], ["start time"]];
  const filesPatterns = [["last successful scan", "scanned files"], ["scanned files"], ["scanned objects"], ["objects scanned"], ["files scanned"]];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i], delimiter);
    if (!vals.length) continue;
    const row = {};
    hdrs.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    const scanTime = parseBDDate(findFieldValue(row, scanTimePatterns));
    const filesScanned = getExactInt(findFieldValue(row, filesPatterns));
    if (filesScanned > 0) rows.push({ scanTime, filesScanned });
  }
  return rows;
};

// Public: generate the "On demand scanning" report for given endpoint(s)
// and return [{ scanTime, filesScanned }], widest window (This year).
const getOnDemandScanCsvRows = async (targetIds, { reportingInterval = 8 } = {}) => {
  const reportId = await createReport({
    name: `SelfHelp_FileCount_${Date.now()}`,
    type: 15,
    targetIds,
    options: { reportingInterval },
  });
  if (!reportId) return [];
  try {
    const link = await waitForReportLink(reportId);
    if (!link) return [];
    const csvData = await downloadReportCSV(link);
    return csvData ? parseOnDemandScanCsv(csvData) : [];
  } finally {
    deleteReport(reportId);
  }
};

module.exports = {

  call,

  // Packages
  getPackagesList,
  getPackageDetails,
  createPackage,
  getInstallationLinks,
  getInstallationLinksByPackageId,
  buildPackageDownloadUrl,

  // Endpoint
  getEndpointsList,
  getManagedEndpoints,
  getManagedEndpointDetails,  
  getTaskStatus,

  // Scan
  createScanTask,
  getScanTasksList,
  getScanTaskById,

  authHeader,
  createReport, getReportDownloadLinks, deleteReport, downloadReportCSV, getOnDemandScanCsvRows

  
};