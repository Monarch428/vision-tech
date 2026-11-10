const express = require('express');
const router = express.Router();

const {
  createSupportRequest,
  getSupportRequests,
  assignTicket,
  getAllSupportRequests,
  getRecentSupportRequests
} = require('../../controllers/support/supportRequest.controller');

const { protect, authorize, STAFF_ROLES } = require('../../middleware/auth.middleware');

const staffOnly = authorize(...STAFF_ROLES);

router.post('/', protect, createSupportRequest);
router.get('/', protect, getSupportRequests);
router.get('/all', protect, staffOnly, getAllSupportRequests);
router.post('/assign/:ticketId', protect, staffOnly, assignTicket);
router.get('/recent', protect, staffOnly, getRecentSupportRequests);

module.exports = router;