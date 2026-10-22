const mongoose = require('mongoose');

// One record per antivirus scan a customer started through the portal; counted
// against the plan's monthly limit (utils/scanQuota.js).
const antivirusScanUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: String, enum: ['self-help', 'rmm', 'schedule'], required: true },
    endpointId: { type: String, default: null },
  },
  { timestamps: true }
);

antivirusScanUsageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AntivirusScanUsage', antivirusScanUsageSchema);
