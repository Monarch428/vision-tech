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

// Cloud storage for customers' file backups, in bytes.
const MB = 1024 * 1024;
const BACKUP_LIMITS = {
  free: 500 * MB,
  pro: 5 * 1024 * MB,
  enterprise: 50 * 1024 * MB,
};

const getBackupLimit = (planName) => BACKUP_LIMITS[String(planName || 'free').toLowerCase()] ?? BACKUP_LIMITS.free;

module.exports = { DEVICE_LIMITS, getDeviceLimit, describeLimit, BACKUP_LIMITS, getBackupLimit };
