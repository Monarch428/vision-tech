const mongoose = require('mongoose');

const selfHelpToolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      enum: ['browser', 'network', 'security', 'backup'],
      default: 'general',
    },

    icon: {
      type: String, // optional icon reference
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SelfHelpTool', selfHelpToolSchema);