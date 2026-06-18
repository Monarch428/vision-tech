const express = require('express');
const cors = require('cors');
const { logger } = require("./utils/logger");
require("dotenv").config();
const { v2: cloudinary } = require("cloudinary");

const authRoutes = require('./routes/auth/auth.routes');
const supportBookingRoutes  = require('./routes/support/supportBooking.routes');
const supportRequestRoutes  = require('./routes/support/supportRequest.routes');
const userRoutes = require('./routes/user-management/user.routes');
const userSubscriptionRoutes = require('./routes/subscription/userSubscription.routes');
const paymentRoutes = require('./routes/subscription/payment.routes');
const SystemLog = require("./models/system-log/SystemLogs");
const antivirusScheduleRoutes = require('./routes/antivirus/antivirusSchedule.route');
const systemConfig = require('./routes/system-config/systemConfig.route');
const startSubscriptionReminder = require("./cron/subscriptionReminder");
const selfHelpRoutes = require('./routes/selfHelp/selfHelp.route');
const dataManagementRoutes = require('./routes/data-management/dataManagement.route')
// const systemHealthRoutes = require("./routes/systemHealth/systemHealth.route");


const app = express();

const normalizeOrigin = (value) => (value || "").trim().replace(/\/$/, "");

const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ALLOWED_ORIGINS || "").split(","),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://depletion-cartoon-nephew.ngrok-free.dev",
]
  .map(normalizeOrigin)
  .filter(Boolean);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests and same-origin tools with no Origin header.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked for origin: ${normalizedOrigin}`);
    return callback(new Error(`CORS blocked for origin: ${normalizedOrigin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(
  cors(corsOptions)
);
app.options(/.*/, cors(corsOptions));
app.use(express.json());

// ✅ Request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const user = req.user?.email || "guest";
    logger.info(
      `[${user}] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | IP: ${req.ip} | Duration: ${duration}ms`
    );
  });
  next();
});

// ✅ System logs routes
app.get("/api/system-logs", async (req, res) => {
  try {
    const { page = 1, limit = 10, type = "all", search = "" } = req.query;

    const query = {
      action: { $exists: true, $nin: [null, "UNKNOWN_ACTION"] }
    };

    if (type !== "all") query.type = type;

    if (search) {
      query.$or = [
        { action: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } },
        { module: { $regex: search, $options: "i" } },
      ];
    }

    const [logs, total] = await Promise.all([
      SystemLog.find(query)
        .sort({ loggedAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),
      SystemLog.countDocuments(query)
    ]);

    res.status(200).json({
      message: "System logs fetched successfully",
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      logs,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch logs", error: error.message });
  }
});

app.get("/api/system-logs/stats", async (req, res) => {
  try {
    const [totalLogs, errors, warnings, success, info] = await Promise.all([
      SystemLog.countDocuments(),
      SystemLog.countDocuments({ type: "error" }),
      SystemLog.countDocuments({ type: "warning" }),
      SystemLog.countDocuments({ type: "success" }),
      SystemLog.countDocuments({ type: "info" }),
    ]);

    res.status(200).json({ totalLogs, errors, warnings, success, info });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch log stats", error: error.message });
  }
});

// ✅ All other routes
app.use('/api/auth',               authRoutes);
app.use('/api/support-booking', supportBookingRoutes);
app.use('/api/support-requests', supportRequestRoutes);
app.use('/api/v1/users',           userRoutes);
app.use('/api/user-subscriptions', userSubscriptionRoutes);
app.use('/api/admin',              userSubscriptionRoutes);
app.use('/api/payments',           paymentRoutes);
app.use('/api/antivirus-schedules', antivirusScheduleRoutes);
app.use('/api/self-help',          selfHelpRoutes);
app.use('/api/system-config',          systemConfig);
app.use('/api/data-management',          dataManagementRoutes);
// app.use("/api/system-health", systemHealthRoutes);


startSubscriptionReminder();

module.exports = app;
