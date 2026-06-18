// const mongoose = require("mongoose");

// const getSystemHealth = async (req, res) => {
//   try {
//     const ping = await mongoose.connection.db.admin().ping();
//     const stats = await mongoose.connection.db.stats();

//     let databaseHealth = 100;

//     const diskUsagePercent =
//       (stats.fsUsedSize / stats.fsTotalSize) * 100;

//     if (diskUsagePercent > 80) databaseHealth -= 10;
//     if (diskUsagePercent > 90) databaseHealth -= 20;

//     const response = {
//       databaseHealth,
//       databaseStatus: ping.ok ? "Healthy" : "Unhealthy",
//       systemStatus: "Operational",
//       apiStatus: "Online",
//       collections: stats.collections,
//       documents: stats.objects,
//       totalSize: stats.totalSize,
//       diskUsagePercent: diskUsagePercent.toFixed(2),
//     };

//     res.status(200).json({
//       success: true,
//       data: response,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// module.exports = {
//   getSystemHealth,
// };