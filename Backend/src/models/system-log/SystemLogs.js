const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["success", "info", "warning", "error"],
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    details: {
      type: String,
      required: true,
    },
    module: {
      type: String,
      default: "system",
    },
    ipAddress: {
      type: String,
      default: "",
    },
    referenceId: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    loggedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemLog", systemLogSchema);