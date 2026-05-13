const mongoose = require("mongoose");

const supportbookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    ticket_no: {
      type: Number,
      unique: true,
      index: true
    },

    assigned_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    },

    duration: {
      type: Number,
      enum: [30, 60, 120],
      required: true,
    },

    category: {
      type: String,
      enum: ["technical_issue", "billing", "antivirus", "rmm", "general"],
      default: "general",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    status: {
      type: String,
      enum: ["open", "in progress", "resolved", "closed"],
      default: "open",
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SupportBooking", supportbookingSchema);