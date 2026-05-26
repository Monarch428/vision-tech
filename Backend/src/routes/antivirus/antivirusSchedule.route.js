const express = require('express');
const router = express.Router();

const {
  createAntivirusSchedule,
  getAntivirusSchedules,
  getAllAntivirusSchedules
} = require('../../controllers/antivirus/antivirusSchedule.controller');

const { protect } = require('../../middleware/auth.middleware');

// Routes
router.post('/', protect, createAntivirusSchedule);
router.get('/', protect, getAntivirusSchedules);
router.get('/all', protect, getAllAntivirusSchedules);

module.exports = router;