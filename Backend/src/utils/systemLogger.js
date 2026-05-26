const SystemLog = require("../models/system-log/SystemLogs");

const systemLogger = async ({
  type = "info",
  action,
  user = null,
  userEmail = "",
  details,
  module = "system",
  ipAddress = "",
  referenceId = "",
  metadata = {},
}) => {
  try {
    await SystemLog.create({
      type,
      action,
      user,
      userEmail,
      details,
      module,
      ipAddress,
      referenceId,
      metadata,
    });
  } catch (error) {
    console.error("System log failed:", error.message);
  }
};

module.exports = systemLogger;