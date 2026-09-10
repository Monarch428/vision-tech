const express = require("express");
const Device = require("../../models/system-config/device.model");
const { deleteDeviceInfo } = require("../../services/device.service");
const { protect } = require("../../middleware/auth.middleware");

const router = express.Router();

router.get("/current", protect, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const device = await Device.findOne({ userId });

    if (!device || !device.hostname) {
      return res.status(404).json({ success: false, message: "No device found" });
    }

    return res.status(200).json({
      success: true,
      hostname: device.hostname,
      platform: device.platform,
      osVersion: device.osVersion,
      architecture: device.architecture,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get current device" });
  }
});

router.delete("/remove-device", protect, async (req, res) => {
  try {
    await deleteDeviceInfo(req.user._id);
    return res.status(200).json({ success: true, message: "Device removed successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to remove device" });
  }
});

module.exports = router;