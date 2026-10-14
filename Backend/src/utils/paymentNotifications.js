const UserManagement = require('../models/user-management/User');
const sendEmail = require('./sendEmail');
const systemLogger = require('./systemLogger');

// Customer emails about payments. Best effort: a missing SMTP setup is logged,
// never allowed to break the payment itself.
const PROVIDER_LABELS = { paypal: 'PayPal', stripe: 'Card (Stripe)' };

const emailUser = async (userId, subject, html) => {
  const user = await UserManagement.findById(userId).select('email name').lean();
  if (!user?.email) return;
  try {
    await sendEmail({ to: user.email, subject, html: html(user) });
  } catch (error) {
    await systemLogger({
      type: 'warning', action: 'PAYMENT_EMAIL_FAILED', user: userId, userEmail: user.email,
      details: `${subject}: ${error.message}`, module: 'payments',
    });
  }
};

const sendReceipt = (payment) =>
  emailUser(payment.user, `Payment receipt ${payment.invoiceNumber}`, (user) => `
    <p>Hi ${user.name || ''},</p>
    <p>Thank you for your payment. Your <strong>${payment.planName || ''}</strong> plan is active.</p>
    <table cellpadding="4">
      <tr><td>Invoice</td><td><strong>${payment.invoiceNumber}</strong></td></tr>
      <tr><td>Amount</td><td>$${Number(payment.amount).toFixed(2)} USD</td></tr>
      <tr><td>Paid with</td><td>${PROVIDER_LABELS[payment.paymentMethod] || payment.paymentMethod}</td></tr>
      <tr><td>Date</td><td>${new Date(payment.paidAt).toDateString()}</td></tr>
    </table>
    <p>You can download the invoice from Billing &amp; Subscription in your account.</p>`);

const sendRefundNotice = (payment) =>
  emailUser(payment.user, `Refund for ${payment.invoiceNumber}`, (user) => `
    <p>Hi ${user.name || ''},</p>
    <p>We have refunded <strong>$${Number(payment.amount).toFixed(2)} USD</strong> for invoice
    <strong>${payment.invoiceNumber}</strong> to your ${PROVIDER_LABELS[payment.paymentMethod] || payment.paymentMethod} account.
    It can take 5–10 business days to appear.</p>
    <p>Your account is now on the Free plan.</p>`);

module.exports = { sendReceipt, sendRefundNotice, PROVIDER_LABELS };
