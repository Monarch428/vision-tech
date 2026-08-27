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
  installBitdefender,
  getBitdefenderInstallStatus,
  getBitdefenderDownloadLink,
} = require("../../controllers/selfhelp/selfHelp.controller");

// Auth middleware
const { protect } = require("../../middleware/auth.middleware");

router.get(
  "/bitdefender/status",
  protect,
  getBitdefenderInstallStatus
);

// Self-help tools
router.post("/start", protect, startTool);
router.get("/status/:id", protect, getToolStatus);

// Antivirus
router.get("/endpoints", protect, getEndpoints);
router.get("/scan-results", protect, getScanResults);
router.get("/scan-report", protect, getScanReport);

// Backup
router.post("/backup", protect, startBackup);
router.get("/backups", protect, listBackups);
router.get("/backups/:id/download", protect, downloadBackup);

// Debug
router.get("/report-data", protect, getReportData);

router.get('/bitdefender/download-link', protect, getBitdefenderDownloadLink);

module.exports = router;