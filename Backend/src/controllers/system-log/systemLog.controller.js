const SystemLog = require('../../models/system-log/SystemLog');

// GET /api/system-logs
const getLogs = async (req, res) => {
  try {
    const { search = '', type = '', page = 1, limit = 10 } = req.query;

    const query = {};

    if (type && type !== 'all') {
      query.type = type;
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
    res.status(500).json({
      message: 'Failed to fetch logs',
      error: error.message,
    });
  }
};

// GET /api/system-logs/stats
const getLogStats = async (req, res) => {
  try {
    const totalLogs = await SystemLog.countDocuments();
    const errors = await SystemLog.countDocuments({ type: 'error' });
    const warnings = await SystemLog.countDocuments({ type: 'warning' });
    const success = await SystemLog.countDocuments({ type: 'success' });

    res.status(200).json({
      message: 'System log stats fetched successfully',
      stats: {
        totalLogs,
        errors,
        warnings,
        success,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch log stats',
      error: error.message,
    });
  }
};

// POST /api/system-logs
const createLog = async (req, res) => {
  try {
    const {
      type,
      action,
      user,
      userEmail,
      details,
      module,
      ipAddress,
      referenceId,
      metadata,
    } = req.body;

    if (!type || !action || !details) {
      return res.status(400).json({
        message: 'type, action, and details are required',
      });
    }

    const log = await SystemLog.create({
      type,
      action,
      user: user || null,
      userEmail: userEmail || '',
      details,
      module: module || 'system',
      ipAddress: ipAddress || '',
      referenceId: referenceId || '',
      metadata: metadata || {},
    });

    res.status(201).json({
      message: 'System log created successfully',
      log,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to create log',
      error: error.message,
    });
  }
};

// GET /api/system-logs/:id
const getLogById = async (req, res) => {
  try {
    const log = await SystemLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        message: 'Log not found',
      });
    }

    res.status(200).json({
      message: 'System log fetched successfully',
      log,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch log',
      error: error.message,
    });
  }
};

module.exports = {
  getLogs,
  getLogStats,
  createLog,
  getLogById,
};