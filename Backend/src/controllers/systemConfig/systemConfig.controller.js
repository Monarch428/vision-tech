const SystemConfig = require('../../models/system-config/SystemConfig');
const sendEmail = require('../../utils/sendEmail');
const mongoose = require("mongoose");
const os = require("os");
const systemLogger = require("../../utils/systemLogger");
// getLogs() below was calling SystemLog.find() with no import at all.
const SystemLog = require('../../models/system-log/SystemLogs');

// POST /api/system-config
const createSystemConfig = async (req, res) => {
  try {
    const userId = req.user._id;

    const existingConfig = await SystemConfig.findOne({ updatedBy: userId });

    if (existingConfig) {
      return res.status(400).json({
        message: 'System configuration already exists for this user. Please update instead.',
      });
    }

    const config = await SystemConfig.create({
      ...req.body,
      updatedBy: userId,
    });

    await systemLogger({
      type: "success",
      action: "SYSTEM_CONFIG_CREATED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `System configuration created (Config record ${config._id})`,
      module: "system-config",
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'System configuration created successfully',
      config,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SYSTEM_CONFIG_CREATE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: error.message,
      module: "system-config",
      ipAddress: req.ip,
    });

    res.status(500).json({
      message: 'Failed to create system configuration',
      error: error.message,
    });
  }
};

// GET /api/system-config/user/:userId
const getConfigByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const config = await SystemConfig.findOne({ updatedBy: userId });

    if (!config) {
      return res.status(404).json({
        message: 'System configuration not found for this user',
      });
    }

    res.status(200).json({
      message: 'System configuration fetched successfully',
      config,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SYSTEM_CONFIG_FETCH_BY_USER_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: error.message,
      module: "system-config",
      ipAddress: req.ip,
    });

    res.status(500).json({
      message: 'Failed to fetch configuration',
      error: error.message,
    });
  }
};

// GET /api/system-config/me
const getMySystemConfig = async (req, res) => {
  try {
    const userId = req.user._id;

    const config = await SystemConfig.findOne({ updatedBy: userId });


    if (!config) {
      return res.status(404).json({
        message: 'System configuration not found',
      });
    }

    res.status(200).json({
      message: 'System configuration fetched successfully',
      config,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SYSTEM_CONFIG_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: error.message,
      module: "system-config",
      ipAddress: req.ip,
    });

    res.status(500).json({
      message: 'Failed to fetch configuration',
      error: error.message,
    });
  }
};

// PUT /api/system-config
const updateSystemConfig = async (req, res) => {
  try {
    const userId = req.user._id;

    const config = await SystemConfig.findOneAndUpdate(
      { updatedBy: userId },
      { ...req.body, updatedBy: userId },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: 'System configuration not found. Please create first.',
      });
    }

    await systemLogger({
      type: "success",
      action: "SYSTEM_CONFIG_UPDATED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `System configuration updated (Config record ${config._id})`,
      module: "system-config",
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'System configuration updated successfully',
      config,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SYSTEM_CONFIG_UPDATE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: error.message,
      module: "system-config",
      ipAddress: req.ip,
    });

    res.status(500).json({
      message: 'Failed to update configuration',
      error: error.message,
    });
  }
};

const testEmail = async (req, res) => {
  try {
    const {
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      fromEmail,
      fromName,
    } = req.body;

    await sendEmail({
      to: fromEmail,
      subject: "Test Email",
      html: "<h2>Test Email Successful ✅</h2>",
      smtpOverride: {
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        fromEmail,
        fromName,
      },
    });

    await systemLogger({
      type: "success",
      action: "TEST_EMAIL_SENT",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Test email sent to ${fromEmail} via ${smtpHost}:${smtpPort}`,
      module: "email",
      ipAddress: req.ip,
    });

    res.json({ message: "Test email sent successfully" });
  } catch (err) {
    await systemLogger({
      type: "error",
      action: "TEST_EMAIL_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: err.message,
      module: "email",
      ipAddress: req.ip,
    });

    res.status(500).json({
      message: "Failed to send test email",
      error: err.message,
    });
  }
};

const notificationTimeEmail = async (req,res)=>{
   
};

const getSystemHealth = async (req, res) => {
  try {
    // Database Health
    const dbStart = Date.now();

    let dbConnected = false;
    let dbResponseTime = 0;
    let dbHealth = 0;

    try {
      await mongoose.connection.db.admin().ping();

      dbResponseTime = Date.now() - dbStart;
      dbConnected = true;

      dbHealth = 100;

      if (dbResponseTime > 100)
        dbHealth -= 10;

      if (dbResponseTime > 300)
        dbHealth -= 20;

      if (dbResponseTime > 1000)
        dbHealth -= 50;
    } catch {
      dbHealth = 0;
    }

    // Memory Usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    const memoryUsage =
      ((totalMemory - freeMemory) / totalMemory) * 100;

    // CPU Usage
    const cpuCount = os.cpus().length;
    const load = os.loadavg()[0];

    const cpuUsage = (load / cpuCount) * 100;

    // System Health
    const systemHealth = Math.max(
      0,
      Math.round(
        100 -
          (memoryUsage * 0.5 +
            cpuUsage * 0.5)
      )
    );

    // API Health
    const apiHealth = 100;

    // Overall
    const overallHealth = Math.round(
      dbHealth * 0.4 +
      systemHealth * 0.3 +
      apiHealth * 0.3
    );

    await systemLogger({
      type: overallHealth >= 70 ? "success" : "warning",
      action: "SYSTEM_HEALTH_CHECKED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: overallHealth >= 70
        ? `System health check completed — overall health ${overallHealth}%`
        : `System health check completed — degraded (overall health ${overallHealth}%)`,
      module: "system-config",
      ipAddress: req.ip,
      metadata: { dbHealth, systemHealth, apiHealth, overallHealth },
    });

    res.json({
      success: true,

      system: {
        status:
          systemHealth > 70
            ? "Operational"
            : "Degraded",
        health: systemHealth,
        cpuUsage: cpuUsage.toFixed(1),
        memoryUsage: memoryUsage.toFixed(1),
      },

      database: {
        status:
          dbConnected
            ? "Connected"
            : "Disconnected",
        health: dbHealth,
        responseTime: `${dbResponseTime}ms`,
      },

      api: {
        status: "Online",
        health: apiHealth,
      },

      overallHealth,
      uptime: process.uptime(),
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SYSTEM_HEALTH_CHECK_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: error.message,
      module: "system-config",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getLogs = async (req, res) => {
  try {
    const { search = '', type = '', module: moduleFilter = '', page = 1, limit = 10 } = req.query;

    const query = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    if (moduleFilter && moduleFilter !== 'all') {
      query.module = moduleFilter;
    }

    if (search) {
      query.$or = [
        { action: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const logs = await SystemLog.find(query)
      .sort({ loggedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await SystemLog.countDocuments(query);

    res.status(200).json({
      message: 'System logs fetched successfully',
      total,
      page: Number(page),
      limit: Number(limit),
      logs,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SYSTEM_LOGS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: error.message,
      module: "system-config",
      ipAddress: req.ip,
    });

    res.status(500).json({
      message: 'Failed to fetch logs',
      error: error.message,
    });
  }
};

module.exports = {
  createSystemConfig,
  getConfigByUserId,
  getMySystemConfig,
  updateSystemConfig,
  testEmail,
  getSystemHealth,
  getLogs
};