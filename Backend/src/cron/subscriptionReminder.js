const cron = require("node-cron");
const Subscription = require("../models/subscription/Subscription");
const sendEmail = require("../utils/sendEmail");
const systemLogger = require("../utils/systemLogger");
const SystemConfig = require('../models/system-config/SystemConfig')

// Emails customers whose paid plan renews within 3 days (once per period).
// Controlled by System Configuration → Notifications → Subscription Renewals.
const runSubscriptionReminder = async () => {
  const config = await SystemConfig.findOne().lean();
  if (config?.notifications?.subscriptionRenewals === false) return 0;

  const now = new Date();
  const threeDaysLater = new Date();
  threeDaysLater.setDate(now.getDate() + 3);

  const subscriptions = await Subscription.find({
    status: "active",
    renewalReminderSent: false,
    nextRenewalDate: { $gte: now, $lte: threeDaysLater },
  }).populate("user").populate("plan", "name price");

  const billingUrl = `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/user/billingsubscriptions`;
  let sent = 0;
  for (const sub of subscriptions) {
    if (!sub.user?.email || !(sub.plan?.price > 0)) continue;
    try {
      await sendEmail({
        to: sub.user.email,
        subject: "Your Vision Tech plan renews soon",
        html: `
          <h2>Hello ${sub.user.name}</h2>
          <p>Your <b>${sub.plan.name}</b> plan ends on
          <b>${new Date(sub.nextRenewalDate).toDateString()}</b>.</p>
          <p>Renew before then to keep your devices monitored without interruption.
          ${process.env.FRONTEND_URL ? `<a href="${billingUrl}">Renew in Billing &amp; Subscription</a>.` : 'You can renew from Billing &amp; Subscription in your account.'}</p>
          <p>If you don't renew, your plan stays active for a 7-day grace period and then moves to the Free plan.</p>
        `,
      });
      sub.renewalReminderSent = true;
      await sub.save();
      sent += 1;
    } catch (error) {
      // One failed email must not stop reminders to everyone else.
      await systemLogger({
        type: 'warning', action: 'RENEWAL_REMINDER_EMAIL_FAILED', user: sub.user?._id, userEmail: sub.user?.email,
        details: error.message, module: 'subscriptions',
      });
    }
  }
  return sent;
};

const startSubscriptionReminder = () => {
  cron.schedule("0 9 * * *", () => {
    runSubscriptionReminder().catch((error) => console.log("Reminder cron error:", error.message));
  });
};

module.exports = startSubscriptionReminder;
module.exports.runSubscriptionReminder = runSubscriptionReminder;
