const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    sub_id:{
      type:String,
      required:true,
      unique:true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'expired'],
      default: 'active',
    },

    startDate: {
      type: Date,
      required: true,
    },

    nextRenewalDate: {
      type: Date,
      required: true,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    pausedAt: {
      type: Date,
      default: null,
    },
    
    renewalReminderSent: {
      type: Boolean,
      default: false
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);