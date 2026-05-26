const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const User = require('../../models/auth/User');
const Plan = require('../../models/subscription/Plan');
const systemConfig = require('../../models/system-config/SystemConfig')
const Subscription = require('../../models/subscription/Subscription');
const { createSessionLogger, destroySessionLogger, logger } = require("../../utils/logger"); // ✅ single import
const sendEmail = require('../../utils/sendEmail');
const systemLogger = require("../../utils/systemLogger");
const systemConfigModel = require('../../models/system-config/SystemConfig');

const LOCK_DURATION_MS = 24 * 60 * 60 * 1000;

const generateToken = async(user) => {
  const config = await systemConfig.findOne();

  const expiresIn = config?.security?.sessionTimeoutMinutes || 10;``

  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: `${expiresIn}m` }
  );
};

const refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    const newToken = await generateToken(user);
    return res.status(200).json({ token: newToken });
  } catch (error) {
    return res.status(500).json({ message: "Token refresh failed", error: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const emailNormalized = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: emailNormalized });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      email: emailNormalized,
      password,
      role: role || 'user',
    });

    try {
      const freePlan = await Plan.findOne({ name: 'free' });
      if (freePlan) {
        const now = new Date();
        const noExpiry = new Date(now);
        noExpiry.setFullYear(noExpiry.getFullYear() + 100);

        await Subscription.create({
          subscriptionId:  uuidv4(),
          user:            user._id,
          plan:            freePlan._id,
          amount:          0,
          status:          'active',
          startDate:       now,
          nextRenewalDate: noExpiry,
        });
      } else {
        console.warn('⚠️  Free plan not found. Run: node src/seeds/seedPlans.js');
      }
    } catch (subErr) {
      console.warn('⚠️  Could not auto-assign free plan:', subErr.message);
    }

    const token = await generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: 'Register failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    
    const config = await systemConfigModel.findOne();

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const allowedIpAddresses = config?.security?.allowedIpAddresses || [];
    const ipRestrictionEnabled =
      allowedIpAddresses.length > 0 && !allowedIpAddresses.includes("*");

    if (ipRestrictionEnabled && !allowedIpAddresses.includes(req.ip)) {
      await systemLogger({
        type: "warning",
        action: "BLOCKED_IP_LOGIN_ATTEMPT",
        details: `Unauthorized IP ${req.ip} attempted to log in with email ${email}`,
        module: "auth",
        ipAddress: req.ip
      });

      return res.status(403).json({
        message: "Access denied from this IP address"
      });
    }

    const emailNormalized = email.toLowerCase().trim();
    const user = await User.findOne({ email: emailNormalized }).select("+password +loginAttempts +lockUntil");

    if (!user) {
      await systemLogger({ type: "warning", action: "USER_LOGIN_FAILED", userEmail: emailNormalized,
        details: "Login failed: user not found", module: "auth", ipAddress: req.ip });
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const maxAttempts = config?.security?.maxLoginAttempts;

    if (!maxAttempts) {
      return res.status(500).json({ message: "Login policy not configured. Contact administrator." });
    }

    const now = Date.now();

    // ── Account still locked ───────────────────────────────────────────────
    if (user.lockUntil && user.lockUntil > now) {
      return res.status(403).json({
        message: "Your account has been locked for 24 hours due to too many failed attempts.",
        locked: true,
        lockUntil: user.lockUntil,
      });
    }

    // ── Lock expired — reset ───────────────────────────────────────────────
    if (user.lockUntil && user.lockUntil <= now) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      if (user.loginAttempts >= maxAttempts) {
        user.lockUntil = new Date(now + LOCK_DURATION_MS); // locked for 1 day
        await user.save();

        await systemLogger({ type: "warning", action: "USER_ACCOUNT_LOCKED", user: user._id,
          userEmail: user.email, details: `Account locked for 24h after ${maxAttempts} failed attempts`,
          module: "auth", ipAddress: req.ip });

        return res.status(403).json({
          message: `Too many failed attempts. Your account is locked for 24 hours.`,
          locked: true,
          lockUntil: user.lockUntil,
        });
      }

      await user.save();

      await systemLogger({ type: "warning", action: "USER_LOGIN_FAILED", user: user._id,
        userEmail: user.email, details: "Login failed: invalid password", module: "auth", ipAddress: req.ip });

      return res.status(400).json({
        message: "Invalid credentials",
        attemptsLeft: maxAttempts - user.loginAttempts,
      });
    }

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    const token = await generateToken(user);

    await systemLogger({ type: "success", action: "USER_LOGIN", user: user._id, userEmail: user.email,
      details: "User logged in successfully", module: "auth", ipAddress: req.ip,
      metadata: { role: user.role, userAgent: req.headers["user-agent"] } });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });

  } catch (error) {
    await systemLogger({ type: "error", action: "USER_LOGIN_ERROR",
      userEmail: req.body?.email || "", details: error.message, module: "auth", ipAddress: req.ip });
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
};

const loginTimer = async (req, res) => {
  try {
    const { email } = req.body;

    const config = await systemConfigModel.findOne();
    const maxAttempts = config?.security?.maxLoginAttempts;

    if (!maxAttempts) {
      return res.status(500).json({ message: "Login policy not configured." });
    }

    if (!email) {
      return res.status(200).json({ locked: false, attemptsLeft: maxAttempts });
    }

    const emailNormalized = email.toLowerCase().trim();
    const user = await User.findOne({ email: emailNormalized }).select("+loginAttempts +lockUntil");

    if (!user) {
      return res.status(200).json({ locked: false, attemptsLeft: maxAttempts });
    }

    const now = Date.now();

    if (user.lockUntil && user.lockUntil > now) {
      return res.status(200).json({
        locked: true,
        lockUntil: user.lockUntil,  // FE calculates remaining time from this
        attemptsLeft: 0,
      });
    }

    return res.status(200).json({
      locked: false,
      attemptsLeft: maxAttempts - (user.loginAttempts || 0),
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const emailNormalized = email.toLowerCase().trim();
    const user = await User.findOne({ email: emailNormalized });

    if (!user) {
      return res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = Date.now() + 60 * 60 * 1000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetExpiry;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: emailNormalized,
      subject: 'Reset your SOLO password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
          <h2 style="color:#1a1a1a">Reset your password</h2>
          <p style="color:#555">Click the button below. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetLink}" style="display:inline-block;margin:16px 0;padding:12px 28px;
            background:#22c55e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
            Reset Password
          </a>
          <p style="color:#aaa;font-size:12px;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  try {
    const user = await User.findOne({
      resetPasswordToken:  token,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset link.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken  = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful.' });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    logger.info(`User ${req.user?.email} logged out`);
    destroySessionLogger();
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  getMe,
  loginTimer,
  forgotPassword,
  resetPassword,
  logout, 
  refreshToken
};
