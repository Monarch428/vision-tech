const mongoose = require('mongoose');

// Audit log of remote actions requested from the portal (restart, disk cleanup,
// antivirus scan). Also used for per-device cooldowns and per-user rate limits.
const rmmActionSchema = new mongoose.Schema(
  {
    agentId: { type: String, required: true, index: true },
    hostname: { type: String, default: null },
    siteId: { type: Number, default: null },
    action: { type: String, required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedByRole: { type: String, default: null },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    error: { type: String, default: null },
    reference: { type: String, default: null }, // e.g. Bitdefender task id
  },
  { timestamps: true }
);

rmmActionSchema.index({ agentId: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('RmmAction', rmmActionSchema);
