const RmmAlert = require('../models/rmm/RmmAlert');
const UserManagement = require('../models/user-management/User');
const SystemConfig = require('../models/system-config/SystemConfig');
const sendEmail = require('./sendEmail');
const notifyStaff = require('./notifyStaff');
const systemLogger = require('./systemLogger');

// A device is "offline" for alerting once it hasn't checked in for this long.
const OFFLINE_AFTER_MS = 30 * 60 * 1000;
const CHECK_TYPES = ['diskspace', 'cpuload', 'memory', 'script'];
const SEVERITIES = ['info', 'warning', 'error'];

// Problems a device currently has, keyed so each maps to at most one open alert.
const currentProblems = (device, now) => {
  const problems = [];
  const lastSeen = device.lastSeen ? device.lastSeen.getTime() : 0;
  if (device.status !== 'online' && now - lastSeen > OFFLINE_AFTER_MS) {
    problems.push({ key: 'offline', type: 'offline', severity: 'error', title: 'Device is offline (no check-in for over 30 minutes)' });
  }
  for (const check of device.checks || []) {
    if (check.status !== 'failing') continue;
    problems.push({
      key: `check:${check.checkId}`,
      type: CHECK_TYPES.includes(check.checkType) ? check.checkType : 'other',
      severity: SEVERITIES.includes(check.severity) ? check.severity : 'warning',
      title: check.title || `${check.checkType} check failing`,
    });
  }
  return problems;
};

// Opens/resolves alerts for one device. Returns alerts opened that need an email.
// `checksKnown` is false until the device's checks have been fetched at least once,
// so check-based alerts aren't resolved just because results are missing.
const evaluateDeviceAlerts = async (device, { checksKnown }) => {
  const now = Date.now();
  const problems = currentProblems(device, now);
  // Keep open alerts attached to the device's current owner (Sites can be linked later).
  await RmmAlert.updateMany(
    { agentId: device.agentId, status: 'open', user: { $ne: device.user } },
    { $set: { user: device.user, hostname: device.hostname, siteId: device.siteId } }
  );
  const open = await RmmAlert.find({ agentId: device.agentId, status: 'open' });
  const isBaseline = !device.alertsInitializedAt;
  const opened = [];

  for (const problem of problems) {
    if (open.some((a) => a.key === problem.key)) continue;
    const alert = await RmmAlert.create({
      ...problem,
      agentId: device.agentId,
      hostname: device.hostname,
      siteId: device.siteId,
      user: device.user,
      baseline: isBaseline,
    });
    if (!isBaseline) opened.push(alert);
  }

  for (const alert of open) {
    const stillFailing = problems.some((p) => p.key === alert.key);
    const canJudge = alert.key === 'offline' || checksKnown;
    if (!stillFailing && canJudge) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      await alert.save();
    }
  }
  return opened;
};

const resolveAlertsForRemovedDevices = (agentIds) =>
  RmmAlert.updateMany({ agentId: { $in: agentIds }, status: 'open' }, { $set: { status: 'resolved', resolvedAt: new Date() } });

const alertListHtml = (alerts) =>
  `<ul>${alerts.map((a) => `<li><strong>${a.hostname || a.agentId}</strong>: ${a.title}</li>`).join('')}</ul>`;

// One email per customer for their new alerts, and one summary for staff.
const notifyNewAlerts = async (alerts) => {
  if (!alerts.length) return;
  const config = await SystemConfig.findOne().select('notifications').lean();
  if (config?.notifications?.deviceAlerts === false) return;

  const byUser = new Map();
  for (const alert of alerts) {
    if (!alert.user) continue;
    const key = String(alert.user);
    byUser.set(key, [...(byUser.get(key) || []), alert]);
  }

  for (const [userId, list] of byUser) {
    const user = await UserManagement.findById(userId).select('email name').lean();
    if (!user?.email) continue;
    try {
      await sendEmail({
        to: user.email,
        subject: `Device alert: ${list.length} new issue${list.length === 1 ? '' : 's'}`,
        html: `<p>Hi ${user.name || ''},</p><p>We detected new issues on your monitored devices:</p>${alertListHtml(list)}
          <p>Our support team has been notified. You can see details on the RMM page of your Vision Tech account.</p>`,
      });
    } catch (error) {
      await systemLogger({
        type: 'warning', action: 'RMM_ALERT_EMAIL_FAILED', user: userId, userEmail: user.email,
        details: error.message, module: 'rmm',
      });
    }
  }

  await notifyStaff({
    subject: `RMM: ${alerts.length} new device alert${alerts.length === 1 ? '' : 's'}`,
    html: `<p>New device alerts:</p>${alertListHtml(alerts)}`,
  });
  await RmmAlert.updateMany({ _id: { $in: alerts.map((a) => a._id) } }, { $set: { notifiedAt: new Date() } });
};

module.exports = { evaluateDeviceAlerts, resolveAlertsForRemovedDevices, notifyNewAlerts, OFFLINE_AFTER_MS };
