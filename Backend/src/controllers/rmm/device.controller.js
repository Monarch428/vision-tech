const crypto = require('crypto');
const Device = require('../../models/rnm/Device');
const { assignCredentials,disconnectDevice  } = require('../../wsServer');

exports.getDevices = async (req, res) => {
  try {
    const devices = await Device.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addDevice = async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Device name is required.' });
    }

    const deviceId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');

    const device = await Device.create({
      deviceId,
      name: name.trim(),
      type,
      token,
      owner: req.user.id,
    });

    const paired = assignCredentials({ deviceId, token });
    if (!paired) {
      await Device.deleteOne({ _id: device._id }); // no agent waiting — don't leave an orphaned record
      return res.status(400).json({
        success: false,
        message: 'No agent is currently waiting to pair. Start the agent on the target device, then try again.',
      });
    }

    res.status(201).json({ success: true, device });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

exports.deleteDevice = async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });

    disconnectDevice(device.deviceId); // kick the live agent connection immediately

    res.json({ success: true, message: 'Device removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};