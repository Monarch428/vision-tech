const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    planName: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },

    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);