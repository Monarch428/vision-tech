const mongoose = require('mongoose');

const deviceAntivirusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rmmAgentId: {
      type: String,
      required: true,
      unique: true,
    },
    hostname: {
      type: String,
      default: null,
    },
    installStatus: {
      type: String,
      enum: ['not_installed', 'installing', 'installed', 'failed'],
      default: 'not_installed',
    },
    installStartedAt: {
      type: Date,
      default: null,
    },
    installCompletedAt: {
      type: Date,
      default: null,
    },
    installError: {
      type: String,
      default: null,
    },
    bitdefenderEndpointId: {
      type: String,
      default: null,
    },
    rmmAgentId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DeviceAntivirus', deviceAntivirusSchema);