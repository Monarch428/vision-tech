const express = require('express');
const {
  register,
  login,
  getMe, forgotPassword, resetPassword,refreshToken,loginTimer
} = require('../../controllers/auth/auth.controller');
const { protect } = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/login-timer', loginTimer);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;