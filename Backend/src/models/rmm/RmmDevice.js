const mongoose = require('mongoose');

// One record per Tactical RMM agent in our Client, kept in sync by
// src/cron/rmmDeviceSync.js. Ownership comes from the agent's Site, which is
// linked to a user (user.rmm.siteId).
const rmmDeviceSchema = new mongoose.Schema(
  {
    agentId: { type: String, required: true, unique: true },
    siteId: { type: Number, required: true, index: true },
    siteName: { type: String, default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    hostname: { type: String, default: null },
    serialNumber: { type: String, default: null },
    platform: { type: String, default: null },
    status: { type: String, default: null },
    lastSeen: { type: Date, default: null },

    // Used to decide which devices are "extra" when a plan limit is exceeded:
    // the earliest-enrolled devices stay within the limit.
    firstSeenAt: { type: Date, default: Date.now },
    removedAt: { type: Date, default: null },

    // Cached metrics and Tactical check results, refreshed every ~10 minutes.
    os: { type: String, default: null },
    cpuModel: { type: String, default: null },
    totalRamGb: { type: Number, default: null },
    cpu: { type: Number, default: null },     // Windows only (WMI)
    memory: { type: Number, default: null },  // Windows only (WMI)
    storage: { type: Number, default: null }, // highest used % across disks
    checks: [
      {
        _id: false,
        checkId: Number,
        checkType: String, // diskspace | cpuload | memory | script | …
        title: String,
        status: String, // passing | failing | pending
        severity: String,
      },
    ],
    metricsUpdatedAt: { type: Date, default: null },
    // First alert evaluation for this device; problems found then are recorded without emails.
    alertsInitializedAt: { type: Date, default: null },

    overLimit: { type: Boolean, default: false },
    overLimitNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RmmDevice', rmmDeviceSchema);
