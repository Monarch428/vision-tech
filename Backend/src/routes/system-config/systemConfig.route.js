const express = require('express');
const router = express.Router();

const {
  createSystemConfig,
  getConfigByUserId,
  getMySystemConfig,
  updateSystemConfig,
  testEmail,
  getSystemHealth
} = require('../../controllers/systemConfig/systemConfig.controller');

const { protect, authorize, STAFF_ROLES } = require('../../middleware/auth.middleware');

const staffOnly = authorize(...STAFF_ROLES);
// Only the support (system owner) role may change system configuration.
const supportOnly = authorize('support');

// Create (only once per user)
router.post('/', protect, supportOnly, createSystemConfig);

// Get logged-in user's config
router.get('/me', protect, staffOnly, getMySystemConfig);

// Update logged-in user's config
router.put('/', protect, supportOnly, updateSystemConfig);

// (Optional) Admin or debug route
router.get('/user/:userId', protect, staffOnly, getConfigByUserId);

router.post('/test-email', protect, supportOnly, testEmail);

router.get('/health', protect, staffOnly, getSystemHealth);

module.exports = router;