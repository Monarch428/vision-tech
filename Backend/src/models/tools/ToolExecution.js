const toolExecutionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    tool: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SelfHelpTool',
      required: true,
    },

    status: {
      type: String,
      enum: ['idle', 'running', 'completed', 'failed'],
      default: 'idle',
    },

    resultMessage: {
      type: String,
      default: '',
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    durationSeconds: {
      type: Number,
      default: 0,
    },

    logs: [
      {
        message: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ToolExecution', toolExecutionSchema);