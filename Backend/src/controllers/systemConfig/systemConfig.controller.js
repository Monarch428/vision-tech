const SystemConfig = require('../../models/system-config/SystemConfig');
const sendEmail = require('../../utils/sendEmail');

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

    res.status(201).json({
      message: 'System configuration created successfully',
      config,
    });
  } catch (error) {
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

    res.status(200).json({
      message: 'System configuration updated successfully',
      config,
    });
  } catch (error) {
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

    res.json({ message: "Test email sent successfully" });
  } catch (err) {
    res.status(500).json({
      message: "Failed to send test email",
      error: err.message,
    });
  }
};

const notificationTimeEmail = async (req,res)=>{
   
};

module.exports = {
  createSystemConfig,
  getConfigByUserId,
  getMySystemConfig,
  updateSystemConfig,
  testEmail
};