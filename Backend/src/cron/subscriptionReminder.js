const cron = require("node-cron");
const Subscription = require("../models/subscription/Subscription");
const sendEmail = require("../utils/sendEmail");
const SystemConfig = require('../models/system-config/SystemConfig')

const startSubscriptionReminder = () => {
  cron.schedule("0 9 * * *", async () => {
    try {
        const config = await SystemConfig.findOne().lean();
        if (config?.notifications?.serviceRequestAlerts) {
      const now = new Date();

      const threeDaysLater = new Date();
      threeDaysLater.setDate(now.getDate() + 3);

      const subscriptions = await Subscription.find({
        status: "active",
        renewalReminderSent: false,
        nextRenewalDate: {
          $gte: now,
          $lte: threeDaysLater,
        },
      }).populate("user");

      for (const sub of subscriptions) {
        await sendEmail({
          to: sub.user.email,
          subject: "Subscription Expiry Reminder",
          html: `
            <h2>Hello ${sub.user.name}</h2>
            <p>Your current plan will expire on 
            <b>${new Date(
              sub.nextRenewalDate
            ).toLocaleDateString()}</b></p>

            <p>Please renew within 3 days to avoid interruption.</p>
          `,
        });

        sub.renewalReminderSent = true;
        await sub.save();
      }
    }
    } catch (error) {
      console.log("Reminder cron error:", error.message);
    }
  });
};

module.exports = startSubscriptionReminder;