const mongoose = require('mongoose');

const deviceAlertSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
    },

    type: {
      type: String,
      enum: ['cpu', 'memory', 'storage', 'offline', 'security', 'general'],
      default: 'general',
    },

    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'warning',
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DeviceAlert', deviceAlertSchema);