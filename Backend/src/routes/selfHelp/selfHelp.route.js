const express = require('express');
const router = express.Router();
const axios = require('axios');

const {
  startTool,
  getToolStatus,
  getScanResults,
  getEndpoints,
  startBackup,
  getScanReport 
} = require('../../controllers/selfhelp/selfHelp.controller');

const { protect } = require('../../middleware/auth.middleware');

router.post('/start-tool', protect, startTool);

router.get('/tool-status/:id', protect, getToolStatus);

router.get("/bitdefender/endpoints",protect, getEndpoints);

router.get("/bitdefender/scan-results", protect, getScanResults);

router.get('/bitdefender/scan-report', protect, getScanReport);

router.post('/backup', protect, startBackup);

module.exports = router;