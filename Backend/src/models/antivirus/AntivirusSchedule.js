const mongoose = require('mongoose');

const antivirusScheduleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    serviceType: {
      type: String,
      enum: ['installation', 'setup', 'maintenance', 'scan', 'cleanup'],
      required: true,
    },

    preferredDate: {
      type: Date,
      required: true,
    },

    preferredTime: {
      type: String,
      required: true,
    },

    numberOfDevices: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // Which company device to scan. null/undefined = user's own device,
    // resolved the same way bitdefender.service resolves it elsewhere.
    endpointId: {
      type: String,
      default: null,
    },

    // Only meaningful for serviceType: 'scan' — lets the cron find due,
    // not-yet-run scans and avoid re-triggering them.
    status: {
      type: String,
      enum: ['scheduled', 'triggered', 'failed', 'cancelled'],
      default: 'scheduled',
    },

    scanTriggeredAt: {
      type: Date,
      default: null,
    },

    gravityZoneTaskId: {
  type: String,
  default: null,
},

    failureReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

antivirusScheduleSchema.index({ status: 1, serviceType: 1, preferredDate: 1, preferredTime: 1 });

module.exports = mongoose.model('AntivirusSchedule', antivirusScheduleSchema);