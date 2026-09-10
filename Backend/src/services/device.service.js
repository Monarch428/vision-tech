const os = require("os");
const Device = require("../models/system-config/device.model"); // → collection 'devices'

async function saveDeviceInfo(userId) {
  const hostname = os.hostname();

  const device = await Device.findOneAndUpdate(
    { userId },
    {
      $set: { hostname },
      $setOnInsert: { userId },
    },
    { upsert: true, new: true }
  );

  return device;
}

async function deleteDeviceInfo(userId) {
  return await Device.findOneAndDelete({ userId });
}

module.exports = { saveDeviceInfo, deleteDeviceInfo };