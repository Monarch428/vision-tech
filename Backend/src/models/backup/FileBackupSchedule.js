const mongoose = require('mongoose');

// Weekly automatic file backup of one device, set by its owner on Self-Help.
const fileBackupScheduleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agentId: { type: String, required: true },
    folders: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    lastRunAt: { type: Date, default: null },
  },
  { timestamps: true }
);

fileBackupScheduleSchema.index({ user: 1, agentId: 1 }, { unique: true });

module.exports = mongoose.model('FileBackupSchedule', fileBackupScheduleSchema);
