const express = require('express');
const {
  register,
  login, resendOtp, verifyOtp,
  getMe, forgotPassword, resetPassword, refreshToken, loginTimer
} = require('../../controllers/auth/auth.controller');
const { protect } = require('../../middleware/auth.middleware');
const { limits } = require('../../middleware/rateLimit');

const router = express.Router();

router.post('/register', limits.register, register);
router.post('/login', limits.loginPerIp, limits.loginPerAccount, login);
router.post('/login-timer', loginTimer);
router.get('/me', protect, getMe);
router.post('/refresh-token', protect, refreshToken);
router.post('/forgot-password', limits.sendCode, forgotPassword);
router.post('/verify-otp', limits.verifyCode, verifyOtp);
router.post('/resend-otp', limits.sendCode, resendOtp);
router.post('/reset-password', limits.resetPassword, resetPassword);

module.exports = router;