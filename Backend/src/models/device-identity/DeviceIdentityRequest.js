const mongoose = require('mongoose');

const deviceIdentityRequestSchema = new mongoose.Schema({
  readTokenHash: { type: String, required: true, select: false },
  writeTokenHash: { type: String, required: true, select: false },
  // This is a short-lived, one-time capability embedded in the Windows
  // helper filename. It is deliberately separate from the longer API tokens.
  callbackCode: { type: String, required: true, unique: true, sparse: true, index: true },
  platform: { type: String, enum: ['windows', 'darwin', 'linux'], required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  hostname: { type: String, default: null },
  serialNumber: { type: String, default: null },
  collectedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// MongoDB deletes the short-lived request soon after it expires.
deviceIdentityRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('DeviceIdentityRequest', deviceIdentityRequestSchema);
