const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      required: true,
      unique: true,
    },

    price: {
      type: Number,
      required: true,
    },

    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },

    features: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Plan', planSchema);