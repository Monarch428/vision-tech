const express = require('express');
const router = express.Router();

const {
  createSupportBooking,
  getSupportBookings,
  getAllSupportBookings,
  assignTicket
} = require('../../controllers/support/supportBooking.controller');

const { protect } = require('../../middleware/auth.middleware');

// Routes
router.post('/', protect, createSupportBooking);
router.get('/', protect, getSupportBookings);
router.get('/all', protect, getAllSupportBookings);
router.post('/assign/:ticketId', protect, assignTicket);

module.exports = router;