const nodemailer = require('nodemailer');
const SystemConfig = require('../models/system-config/SystemConfig');

const sendEmail = async ({ to, subject, html }) => {
   const config = await SystemConfig.findOne().lean();

   const{ smtpHost, smtpPort, smtpUsername, smtpPassword, fromEmail, fromName } = config.email;
   
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
    tls: { rejectUnauthorized: false },
  });
  
    await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;