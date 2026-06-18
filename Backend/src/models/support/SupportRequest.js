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

    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "closed"],
      default: "open"
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

      resolvedAt: Date,
    },
    {
      timestamps: true,
    }
  );

  module.exports = mongoose.model('SupportRequest', supportRequestSchema);