const express = require('express');
const router = express.Router();

const {
  createSupportRequest,
  getSupportRequests,
  assignTicket,
  getAllSupportRequests,
  getRecentSupportRequests
} = require('../../controllers/support/supportRequest.controller');

const { protect } = require('../../middleware/auth.middleware');

router.post('/', protect, createSupportRequest);
router.get('/', protect, getSupportRequests);
router.get('/all', protect, getAllSupportRequests);
router.post('/assign/:ticketId', protect, assignTicket);
router.get('/recent', protect, getRecentSupportRequests);

module.exports = router;