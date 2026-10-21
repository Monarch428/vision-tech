// Devices each plan may monitor. Single source of truth for the backend.
const DEVICE_LIMITS = {
  free: 1,
  pro: 5,
  enterprise: Infinity,
};

const getDeviceLimit = (planName) => DEVICE_LIMITS[String(planName || 'free').toLowerCase()] ?? 1;

const describeLimit = (planName) => {
  const limit = getDeviceLimit(planName);
  return limit === Infinity ? 'unlimited devices' : `${limit} device${limit === 1 ? '' : 's'}`;
};

module.exports = { DEVICE_LIMITS, getDeviceLimit, describeLimit };
