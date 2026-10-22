const mongoose = require('mongoose');

// A customer's backup of files on one of their own computers. The RMM agent
// zips the chosen folders and uploads the zip in parts (utils/fileBackups.js);
// each part is a private raw file in Cloudinary.
const partSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    publicId: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const fileBackupSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agentId: { type: String, required: true },
    hostname: { type: String, default: null },
    siteId: { type: Number, default: null },
    folders: { type: [String], default: [] },
    trigger: { type: String, enum: ['manual', 'schedule'], default: 'manual' },

    // pending: sent to the device · running: the device is zipping/uploading
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending', index: true },
    error: { type: String, default: null },

    // Upload credentials for the device; only the SHA-256 of the token is kept.
    tokenHash: { type: String, default: null, select: false },
    tokenExpiresAt: { type: Date, default: null },
    maxBytes: { type: Number, required: true }, // quota left when the backup started

    parts: { type: [partSchema], default: [] },
    size: { type: Number, default: 0 },
    fileCount: { type: Number, default: null },
    skippedCount: { type: Number, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

fileBackupSchema.index({ tokenHash: 1 }, { sparse: true });
fileBackupSchema.index({ user: 1, agentId: 1, createdAt: -1 });

module.exports = mongoose.model('FileBackup', fileBackupSchema);
