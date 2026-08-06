const mongoose = require('mongoose');

const supportRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    ticketNumber: {
      type: String,
      unique: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },

    category: {
      type: String,
      enum: ['technical', 'billing', 'antivirus', 'rmm', 'general'],
      default: 'general',
    },

    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open',
    },

    assigned_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number,
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // ── NEW ──────────────────────────────────────────────────────────────
    // Length of the support session in minutes, for tickets that included a
    // booked one-on-one call. Left unset (0) for tickets filed without a
    // call attached.
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── NEW ──────────────────────────────────────────────────────────────
    // Audit trail: who assigned/reassigned/changed status, and when.
    // Denormalized (name stored directly) so the frontend doesn't need an
    // extra populate to show "by" on each entry.
    activity: [
      {
        message: { type: String, required: true },
        by: { type: String }, // display name of whoever performed the action
        status: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    resolvedAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SupportRequest', supportRequestSchema);