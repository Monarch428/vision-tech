const express = require('express');
const router = express.Router();

const {
  createAntivirusSchedule,
  getAntivirusSchedules,
  getAllAntivirusSchedules,
  getScanReport
} = require('../../controllers/antivirus/antivirusSchedule.controller');

const { protect, authorize, STAFF_ROLES } = require('../../middleware/auth.middleware');

const staffOnly = authorize(...STAFF_ROLES);

// Routes
router.post('/', protect, createAntivirusSchedule);
router.get('/', protect, getAntivirusSchedules);
router.get('/all', protect, staffOnly, getAllAntivirusSchedules);
// router.get("/antivirus/scan-report", protect, getScanReport);

module.exports = router;