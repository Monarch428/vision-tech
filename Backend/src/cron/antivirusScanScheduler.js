// cron/antivirusScanScheduler.js

const cron = require("node-cron");
const Antivirus = require("../models/antivirus/AntivirusSchedule");
const bitdefender = require("../services/bitdefender.service");
const sendEmail = require("../utils/sendEmail");
const systemLogger = require("../utils/systemLogger");

function getScheduledDateTime(preferredDate, preferredTime) {
  if (!preferredDate || !preferredTime) {
    return null;
  }

  const date = new Date(preferredDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const [hours, minutes] = preferredTime.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  date.setHours(hours, minutes, 0, 0);

  return date;
}

const startAntivirusScanScheduler = () => {
  console.log("[Antivirus Cron] Scheduler started");

  cron.schedule("* * * * *", async () => {
    const now = new Date();

    console.log(
      `[Antivirus Cron] Checking schedules at ${now.toISOString()}`
    );

    try {
      const schedules = await Antivirus.find({
        status: "scheduled",
        serviceType: "scan",
      }).populate("user");

      console.log(
        `[Antivirus Cron] Found ${schedules.length} scheduled scan(s)`
      );

      for (const sched of schedules) {
        try {
          const scheduledAt = getScheduledDateTime(
            sched.preferredDate,
            sched.preferredTime
          );

          console.log("[Antivirus Cron] Schedule:", {
            id: sched._id.toString(),
            endpointId: sched.endpointId,
            preferredDate: sched.preferredDate,
            preferredTime: sched.preferredTime,
            scheduledAt,
            now,
          });

          if (!scheduledAt) {
            console.error(
              `[Antivirus Cron] Invalid date/time for ${sched._id}`
            );
            continue;
          }

          if (scheduledAt > now) {
            console.log(
              `[Antivirus Cron] ${sched._id} is not due yet`
            );
            continue;
          }

          if (!sched.endpointId) {
            throw new Error(
              "No endpointId saved for scheduled antivirus scan"
            );
          }

          console.log(
            `[Antivirus Cron] Triggering GravityZone scan for endpoint ${sched.endpointId}`
          );

          const taskResult = await bitdefender.triggerScan(
            sched.endpointId
          );

          console.log(
            "[Antivirus Cron] GravityZone createScanTask result:",
            taskResult
          );

          sched.status = "triggered";
          sched.scanTriggeredAt = new Date();
          sched.failureReason = null;

          // Optional, if you add this field to the model:
          if (Array.isArray(taskResult)) {
            sched.gravityZoneTaskId = taskResult[0] || null;
          } else if (typeof taskResult === "string") {
            sched.gravityZoneTaskId = taskResult;
          }

          await sched.save();

          console.log(
            `[Antivirus Cron] Schedule ${sched._id} marked triggered`
          );

          await systemLogger({
            type: "success",
            action: "ANTIVIRUS_SCAN_TRIGGERED",
            user: sched.user?._id,
            userEmail: sched.user?.email,
            details:
              `Scheduled scan triggered for endpoint ` +
              `${sched.endpointId}. GravityZone result: ` +
              `${JSON.stringify(taskResult)}`,
            module: "antivirus",
          });

          if (sched.user?.email) {
            try {
              await sendEmail({
                to: sched.user.email,
                subject: "Your scheduled antivirus scan has started",
                html: `
                  <p>Hi ${sched.user.name || ""},</p>
                  <p>Your scheduled antivirus scan has started.</p>
                  <p>Device: ${sched.endpointId}</p>
                  <p>Scheduled time: ${sched.preferredTime}</p>
                `,
              });
            } catch (emailError) {
              // Email failure should NOT turn a successful scan into failed.
              console.error(
                "[Antivirus Cron] Email failed:",
                emailError.message
              );
            }
          }
        } catch (err) {
          console.error(
            `[Antivirus Cron] Failed schedule ${sched._id}:`,
            err
          );

          sched.status = "failed";
          sched.failureReason = err.message;

          await sched.save();

          await systemLogger({
            type: "error",
            action: "ANTIVIRUS_SCAN_TRIGGER_ERROR",
            user: sched.user?._id,
            userEmail: sched.user?.email,
            details: `${err.message}`,
            module: "antivirus",
          });
        }
      }
    } catch (error) {
      console.error(
        "[Antivirus Cron] Cron error:",
        error
      );
    }
  });
};

module.exports = startAntivirusScanScheduler;