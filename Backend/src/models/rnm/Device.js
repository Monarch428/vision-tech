const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    deviceType: {
      type: String,
      enum: ['desktop', 'laptop', 'server', 'mobile', 'other'],
      required: true,
    },

    hostname: {
      type: String,
      default: '',
      trim: true,
    },

    operatingSystem: {
      type: String,
      default: '',
    },

    ipAddress: {
      type: String,
      default: '',
    },

    monitoringEnabled: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ['online', 'offline', 'warning', 'critical'],
      default: 'online',
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Device', deviceSchema);