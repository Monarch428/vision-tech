const express = require("express");
const router = express.Router();

const {
  startTool,
  getToolStatus,
  getEndpoints,
  getScanResults,
  getScanReport,
  startBackup,
  listBackups,
  downloadBackup,
  getReportData,

  // Bitdefender
  getBitdefenderInstallStatus,
  getBitdefenderDownloadLink,
  registerDeviceHostname,
  getBitdefenderEndpoint,   // ← added
  runBitdefenderScan,       // ← added
  listCompanyEndpoints,     // ← added
  runScanOnEndpoint,        // ← added
} = require("../../controllers/selfhelp/selfHelp.controller");

const { protect } = require("../../middleware/auth.middleware");


// ─── Self-help tools ─────────────────────────────────────────────

router.post("/start", protect, startTool);

router.get("/status/:id", protect, getToolStatus);


// ─── Bitdefender ─────────────────────────────────────────────────

// Download Bitdefender installer
router.get(
  "/bitdefender/download-link",
  protect,
  getBitdefenderDownloadLink
);

// Register hostname after installation
router.post(
  "/bitdefender/register-hostname",
  protect,
  registerDeviceHostname
);

// Check whether GravityZone detected the machine (uses DeviceAntivirus record)
router.get(
  "/bitdefender/status",
  protect,
  getBitdefenderInstallStatus
);

// Direct endpoint lookup — called when the page loads, to resolve the
// per-user target/endpoint id without waiting for the "installing" poll.
router.get(
  "/bitdefender/endpoint",
  protect,
  getBitdefenderEndpoint
);

// Optional: dedicated scan trigger using the resolved endpoint id directly.
router.post(
  "/bitdefender/scan",
  protect,
  runBitdefenderScan
);


// ─── Antivirus reports ───────────────────────────────────────────

router.get("/endpoints", protect, getEndpoints);

router.get("/scan-results", protect, getScanResults);

router.get("/scan-report", protect, getScanReport);


// ─── Backup ──────────────────────────────────────────────────────

router.post("/backup", protect, startBackup);

router.get("/backups", protect, listBackups);

router.get(
  "/backups/:id/download",
  protect,
  downloadBackup
);


// ─── Debug ───────────────────────────────────────────────────────

router.get("/report-data", protect, getReportData);

// Optional: dedicated scan trigger using the resolved endpoint id directly.
router.post(
  "/bitdefender/scan",
  protect,
  runBitdefenderScan
);

// Scan report — combined Bitdefender + our own DB data
router.get(
  "/bitdefender/scan-report",
  protect,
  getScanReport
);

router.get("/bitdefender/company-endpoints", protect, listCompanyEndpoints);

router.post("/bitdefender/scan-endpoint", protect, runScanOnEndpoint);


module.exports = router;