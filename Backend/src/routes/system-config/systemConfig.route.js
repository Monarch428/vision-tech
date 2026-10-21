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
// Only the Super Admin may change system configuration.
const superAdminOnly = authorize('superadmin');

// Create (only once per user)
router.post('/', protect, superAdminOnly, createSystemConfig);

// Get logged-in user's config
router.get('/me', protect, staffOnly, getMySystemConfig);

// Update logged-in user's config
router.put('/', protect, superAdminOnly, updateSystemConfig);

// (Optional) Admin or debug route
router.get('/user/:userId', protect, staffOnly, getConfigByUserId);

router.post('/test-email', protect, superAdminOnly, testEmail);

router.get('/health', protect, staffOnly, getSystemHealth);

module.exports = router;