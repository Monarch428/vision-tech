const mongoose = require('mongoose');

const antivirusScheduleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    }
  }
);

module.exports = mongoose.model('AntivirusSchedule', antivirusScheduleSchema);