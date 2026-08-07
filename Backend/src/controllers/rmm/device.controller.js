const crypto = require('crypto');
const Device = require('../../models/rnm/Device');
<<<<<<< HEAD

// GET /api/devices  — dashboard fetch (auth required, scoped to logged-in user)
=======
const { assignCredentials,disconnectDevice  } = require('../../wsServer');

>>>>>>> abhinesh
exports.getDevices = async (req, res) => {
  try {
    const devices = await Device.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

<<<<<<< HEAD
// POST /api/devices  — register a new device, returns token+id for the agent's .env
=======
>>>>>>> abhinesh
exports.addDevice = async (req, res) => {
  try {
    const { name, type } = req.body;

<<<<<<< HEAD
=======
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Device name is required.' });
    }

>>>>>>> abhinesh
    const deviceId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');

    const device = await Device.create({
      deviceId,
<<<<<<< HEAD
      name,
=======
      name: name.trim(),
>>>>>>> abhinesh
      type,
      token,
      owner: req.user.id,
    });

<<<<<<< HEAD
    // only ever return the raw token on creation — never again after this
    res.status(201).json({
      success: true,
      device,
      agentConfig: { deviceId, token },
    });
=======
    const paired = assignCredentials({ deviceId, token });
    if (!paired) {
      await Device.deleteOne({ _id: device._id }); // no agent waiting — don't leave an orphaned record
      return res.status(400).json({
        success: false,
        message: 'No agent is currently waiting to pair. Start the agent on the target device, then try again.',
      });
    }

    res.status(201).json({ success: true, device });
>>>>>>> abhinesh
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

<<<<<<< HEAD
// PATCH /api/devices/:id/monitoring  — toggle monitoring on/off from UI
=======
>>>>>>> abhinesh
exports.toggleMonitoring = async (req, res) => {
  try {
    const { monitoring } = req.body;
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      { monitoring },
      { new: true }
    );
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });
    res.json({ success: true, device });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

<<<<<<< HEAD
// DELETE /api/devices/:id
=======
>>>>>>> abhinesh
exports.deleteDevice = async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });
<<<<<<< HEAD
=======

    disconnectDevice(device.deviceId); // kick the live agent connection immediately

>>>>>>> abhinesh
    res.json({ success: true, message: 'Device removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
<<<<<<< HEAD
};

// POST /api/devices/heartbeat  — called by the AGENT, not the browser
// No user session here — auth is via the device token in the header
exports.heartbeat = async (req, res) => {
  try {
    const authHeader = req.headers.authorization; // "Bearer <token>"
    const token = authHeader?.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'Missing token' });

    const { deviceId, cpu, memory, storage, uptime, platform, hostname } = req.body;

    const device = await Device.findOne({ deviceId }).select('+token');
    if (!device) return res.status(404).json({ success: false, message: 'Unknown device' });

    if (device.token !== token) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    device.cpu = cpu;
    device.memory = memory;
    device.storage = storage;
    device.uptime = uptime;
    device.platform = platform;
    device.hostname = hostname;
    device.lastSeen = new Date();

    await device.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
=======
>>>>>>> abhinesh
};