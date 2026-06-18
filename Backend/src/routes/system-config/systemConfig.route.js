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

const { protect } = require('../../middleware/auth.middleware');

// Create (only once per user)
router.post('/', protect, createSystemConfig);

// Get logged-in user's config
router.get('/me', protect, getMySystemConfig);

// Update logged-in user's config
router.put('/', protect, updateSystemConfig);

// (Optional) Admin or debug route
router.get('/user/:userId', protect, getConfigByUserId);

router.post('/test-email', protect, testEmail);

router.get('/health',protect,getSystemHealth)

module.exports = router;