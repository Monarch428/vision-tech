const mongoose = require('mongoose');

const deviceMetricSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
    },

    health: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },

    cpuUsage: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },

    memoryUsage: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },

    storageUsage: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },

    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DeviceMetric', deviceMetricSchema);