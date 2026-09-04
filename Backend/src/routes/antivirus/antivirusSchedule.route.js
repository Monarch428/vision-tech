const express = require('express');
const router = express.Router();

const {
  createAntivirusSchedule,
  getAntivirusSchedules,
  getAllAntivirusSchedules,
  getScanReport
} = require('../../controllers/antivirus/antivirusSchedule.controller');

const { protect } = require('../../middleware/auth.middleware');

// Routes
router.post('/', protect, createAntivirusSchedule);
router.get('/', protect, getAntivirusSchedules);
router.get('/all', protect, getAllAntivirusSchedules);
// router.get("/antivirus/scan-report", protect, getScanReport);

module.exports = router;