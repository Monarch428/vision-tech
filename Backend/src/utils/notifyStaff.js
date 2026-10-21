const UserManagement = require('../models/user-management/User');
const sendEmail = require('./sendEmail');
const systemLogger = require('./systemLogger');
const { STAFF_ROLES } = require('../middleware/auth.middleware');

// Emails every admin and the Super Admin. Email problems (e.g. SMTP not
// configured) are logged and never break the calling job or request.
const notifyStaff = async ({ subject, html }) => {
  const staff = await UserManagement.find({ role: { $in: STAFF_ROLES }, isActive: { $ne: false } })
    .select('email')
    .lean();

  for (const { email } of staff) {
    try {
      await sendEmail({ to: email, subject, html });
    } catch (error) {
      await systemLogger({
        type: 'warning', action: 'STAFF_NOTIFY_EMAIL_FAILED', userEmail: email,
        details: `${subject}: ${error.message}`, module: 'notifications',
      });
    }
  }
};

module.exports = notifyStaff;
