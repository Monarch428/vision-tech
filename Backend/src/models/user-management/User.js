// Backend/src/models/user-management/User.js

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
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

module.exports = mongoose.model('User-Management', userSchema);