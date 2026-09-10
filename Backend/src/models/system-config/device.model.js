const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    hostname: {
      type: String,
      required: true,
      trim: true,
    },

    platform: String,
    osVersion: String,
    architecture: String,
  },
  {
    timestamps: true,
  }
);

deviceSchema.index(
  { userId: 1, hostname: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'UserDevice',
  deviceSchema,
  'devices'
);