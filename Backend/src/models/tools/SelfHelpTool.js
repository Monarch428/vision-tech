const mongoose = require("mongoose");

const selfHelpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    category: {
      type: String,
      enum: ["browser", "network", "security", "backup"],
      default: "browser",
    },

    progress: {
      type: Number,
      min: 0,
      max: 100,
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

    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SelfHelpTool", selfHelpSchema);