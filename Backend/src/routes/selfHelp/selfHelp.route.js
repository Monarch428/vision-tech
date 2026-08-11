const express = require('express');
const router = express.Router();
const axios = require('axios');

const {
  startTool,
  getToolStatus,
  getScanResults,
  getEndpoints,
  startBackup,
  getScanReport,
  downloadBackup,
  linkEndpoint,
  getReportData,
  createInstallPackage
} = require('../../controllers/selfhelp/selfHelp.controller');

const { protect } = require('../../middleware/auth.middleware');

router.post('/start-tool', protect, startTool);

router.get('/tool-status/:id', protect, getToolStatus);

router.get("/bitdefender/endpoints", protect, getEndpoints);

router.get("/bitdefender/scan-results", protect, getScanResults);

router.get('/bitdefender/scan-report', protect, getScanReport);

router.post('/backup', protect, startBackup);

router.get('/scan-report-debug', protect, getReportData);

router.get('/backups', protect, listBackups);

router.get('/backups/:id/download', protect, downloadBackup);

router.post('/link-endpoint', protect, linkEndpoint);

router.post('/create-install-package', protect, createInstallPackage);

module.exports = router;