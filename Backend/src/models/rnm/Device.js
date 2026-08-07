const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['Laptop', 'Desktop'], default: 'Desktop' },
    hostname: { type: String },
    platform: { type: String }, // win32, darwin, linux etc.

    // auth token the agent uses to authenticate its heartbeats
    token: { type: String, required: true, select: false },

    // link device to a user/org, adjust ref name to match your auth model
<<<<<<< HEAD
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
=======
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
>>>>>>> abhinesh

    monitoring: { type: Boolean, default: true },

    // latest reported stats
    cpu: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
    storage: { type: Number, default: 0 },
    uptime: { type: Number, default: 0 }, // seconds

    lastSeen: { type: Date },
  },
  { timestamps: true }
);

// virtual, not stored — computed on the fly
deviceSchema.virtual('status').get(function () {
  if (!this.lastSeen) return 'offline';
  const secondsSinceSeen = (Date.now() - this.lastSeen.getTime()) / 1000;
  return secondsSinceSeen < 120 ? 'online' : 'offline'; // 2 min grace window
});

deviceSchema.virtual('health').get(function () {
  // No heartbeat received yet — cpu/memory/storage are just schema defaults (0),
  // not real data. Reporting 100% here would be misleading, so treat as unknown.
  if (!this.lastSeen) return 0;

  const cpuScore = 100 - this.cpu;
  const memScore = 100 - this.memory;
  const storageScore = 100 - this.storage;
  return Math.round((cpuScore + memScore + storageScore) / 3);
});

deviceSchema.set('toJSON', { virtuals: true });
deviceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Device', deviceSchema);