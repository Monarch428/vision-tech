const mongoose = require('mongoose');

const selfHelpToolSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      enum: ['browser', 'network', 'security', 'backup'],
      required: true,
    },
    progress: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    scanStartedAt: {
      type: Date,
      default: null,
    },
    scanFinishedAt: {
      type: Date,
      default: null,
    },
    bitdefenderTaskId: {
      type: String,
      default: null,
    },
    filesScanned: {
      type: Number,
      default: 0,
    },
    threatsDetected: {
      type: Number,
      default: 0,
    },
    backupPath: {
      type: String,
      default: null,
    },
    backupFileName: {
      type: String,
      default: null,
    },
    backupFileSize: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.SelfHelpTool ||
  mongoose.model('SelfHelpTool', selfHelpToolSchema);