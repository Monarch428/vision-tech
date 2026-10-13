const nodemailer = require('nodemailer');
const SystemConfig = require('../models/system-config/SystemConfig');
const { decryptSecret } = require('./secretBox');

// smtpOverride lets System Config > "Test email" try unsaved form values;
// any field it leaves empty falls back to the saved configuration.
const sendEmail = async ({ to, subject, html, smtpOverride }) => {
  const config = await SystemConfig.findOne().lean();
  const saved = config?.email || {};
  const override = smtpOverride || {};
  const pick = (field) => (override[field] !== undefined && override[field] !== '' ? override[field] : saved[field]);

  const smtpHost = pick('smtpHost');
  const smtpPort = pick('smtpPort');
  const smtpUsername = pick('smtpUsername');
  const smtpPassword = override.smtpPassword ? override.smtpPassword : decryptSecret(saved.smtpPassword);
  const fromEmail = pick('fromEmail');
  const fromName = pick('fromName');

  if (!smtpHost || !smtpUsername || !smtpPassword || !fromEmail) {
    throw new Error('SMTP configuration is incomplete — please fill in System Config > Email settings');
  }

  const port = Number(smtpPort) || 587;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port,
    secure: port === 465,
    auth: {
      user: smtpUsername,
      pass: smtpPassword,
    },
    // Certificates are verified unless explicitly allowed for a self-signed dev server.
    tls: { rejectUnauthorized: process.env.SMTP_ALLOW_SELF_SIGNED !== 'true' },
  });

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;
