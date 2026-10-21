const mongoose = require('mongoose');

// A monitoring problem on a device: offline too long, or a failing Tactical
// RMM check (disk, CPU, memory, script). Opened and resolved automatically by
// src/cron/rmmDeviceSync.js; at most one open alert per device + source.
const rmmAlertSchema = new mongoose.Schema(
  {
    agentId: { type: String, required: true, index: true },
    hostname: { type: String, default: null },
    siteId: { type: Number, default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // "offline" or "check:<tactical check id>"
    key: { type: String, required: true },
    type: { type: String, enum: ['offline', 'diskspace', 'cpuload', 'memory', 'script', 'other'], required: true },
    title: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'error'], default: 'warning' },

    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    openedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },

    // Baseline alerts were already failing when monitoring started; no email is sent for them.
    baseline: { type: Boolean, default: false },
    notifiedAt: { type: Date, default: null },

    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

rmmAlertSchema.index({ agentId: 1, key: 1, status: 1 });

module.exports = mongoose.model('RmmAlert', rmmAlertSchema);
