const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'user', 'support'],
      default: 'user',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    avatar: {
      type: String,
      default: '',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    plan: {
      type: String,
      default: 'free',
    },
    sub_id: {
      type: String,
      default: null,
    },
    deviceNames: {
      type: [String],
      default: [],
      required: [true, 'Device name is required'],
    },
        serialNumbers: {
  type: [String],
  default: [],
  required: [true, 'Serial number is required'],
},
    // The Tactical RMM Site that holds this customer's devices. Device
    // ownership is decided by this link, not by typed serial numbers.
    rmm: {
      clientId: { type: Number, default: null },
      siteId: { type: Number, default: null },
      siteName: { type: String, default: null },
      linkedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

module.exports = mongoose.model('User-Management', userSchema);