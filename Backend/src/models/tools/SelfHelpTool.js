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
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    progress: {
      type: Number,
      default: 0,
    },
    scanStartedAt: {
      type: Date,
      default: null,
    },
    scanFinishedAt: {
      type: Date,
      default: null,
    },
    rmmAgentId: {
      type: String,
      default: null,
    },
    bitdefenderTaskId: {
      type: String,
      default: null,
    },
    filesScanned: {
      type: Number,
      default: null,
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

module.exports = mongoose.model('SelfHelpTool', selfHelpToolSchema);