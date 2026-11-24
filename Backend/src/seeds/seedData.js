require("dotenv").config();

const mongoose = require("mongoose");
const AuthUser = require("../models/auth/User");
const UserManagement = require("../models/user-management/User");
const Plan = require("../models/subscription/Plan");
const Subscription = require("../models/subscription/Subscription");
const SystemConfig = require("../models/system-config/SystemConfig");
const getMongoUri = require("../conifg/getMongoUri");
const { encryptSecret } = require("../utils/secretBox");

const PLAN_DEFINITIONS = [
  {
    name: "free",
    price: 0,
    billingCycle: "monthly",
    features: [
      "1 Device monitoring",
      "Basic support",
      "Self-help tools",
      "Community access",
    ],
  },
  {
    name: "pro",
    price: 49.99,
    billingCycle: "monthly",
    features: [
      "5 Devices monitoring",
      "Priority support",
      "Antivirus services",
      "RMM included",
    ],
  },
  {
    name: "enterprise",
    price: 149.99,
    billingCycle: "monthly",
    features: [
      "Unlimited devices",
      "24/7 dedicated support",
      "Full antivirus suite",
      "Advanced RMM",
      "Custom integrations",
    ],
  },
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      parsed.mode = arg.split("=")[1];
      continue;
    }

    if (arg.startsWith("--email=")) {
      parsed.email = arg.split("=")[1];
      continue;
    }

    if (arg.startsWith("--password=")) {
      parsed.password = arg.split("=")[1];
      continue;
    }

    if (arg.startsWith("--name=")) {
      parsed.name = arg.split("=")[1];
    }
  }

  return parsed;
};

const parseAllowedIps = () => {
  const raw = process.env.SEED_ALLOWED_IPS || "*";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const buildConfigPayload = () => ({
  general: {
    siteName: process.env.SEED_SITE_NAME || "Vision Tech",
    siteUrl: process.env.FRONTEND_URL || "",
    timezone: process.env.SEED_TIMEZONE || "UTC",
    maintenanceMode: false,
    autoBackup: true,
    minimumPasswordLength: undefined,
  },
  email: {
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUsername: process.env.SMTP_USER || "",
    smtpPassword: encryptSecret(process.env.SMTP_PASS || ""),
    fromEmail: process.env.SMTP_USER || "",
    fromName: process.env.SEED_FROM_NAME || "Vision Tech Support",
    emailNotificationsEnabled: true,
  },
  security: {
    sessionTimeoutMinutes: Number(process.env.SEED_SESSION_TIMEOUT_MINUTES) || 60,
    maxLoginAttempts: Number(process.env.SEED_MAX_LOGIN_ATTEMPTS) || 5,
    minimumPasswordLength: Number(process.env.SEED_MIN_PASSWORD_LENGTH) || 8,
    requireTwoFactorAuth: false,
    allowedIpAddresses: parseAllowedIps(),
  },
  notifications: {
    newUserRegistration: true,
    serviceRequestAlerts: true,
    systemErrors: true,
    securityAlerts: true,
    subscriptionRenewals: true,
  },
});

const mergeConfig = (existingConfig, payload) => {
  if (!existingConfig) {
    return payload;
  }

  return {
    general: {
      siteName: existingConfig.general?.siteName || payload.general.siteName,
      siteUrl: existingConfig.general?.siteUrl || payload.general.siteUrl,
      timezone: existingConfig.general?.timezone || payload.general.timezone,
      maintenanceMode:
        existingConfig.general?.maintenanceMode ?? payload.general.maintenanceMode,
      autoBackup: existingConfig.general?.autoBackup ?? payload.general.autoBackup,
    },
    email: {
      smtpHost: existingConfig.email?.smtpHost || payload.email.smtpHost,
      smtpPort: existingConfig.email?.smtpPort || payload.email.smtpPort,
      smtpUsername: existingConfig.email?.smtpUsername || payload.email.smtpUsername,
      smtpPassword: existingConfig.email?.smtpPassword || payload.email.smtpPassword,
      fromEmail: existingConfig.email?.fromEmail || payload.email.fromEmail,
      fromName: existingConfig.email?.fromName || payload.email.fromName,
      emailNotificationsEnabled:
        existingConfig.email?.emailNotificationsEnabled ??
        payload.email.emailNotificationsEnabled,
    },
    security: {
      sessionTimeoutMinutes:
        existingConfig.security?.sessionTimeoutMinutes || payload.security.sessionTimeoutMinutes,
      maxLoginAttempts:
        existingConfig.security?.maxLoginAttempts || payload.security.maxLoginAttempts,
      minimumPasswordLength:
        existingConfig.security?.minimumPasswordLength || payload.security.minimumPasswordLength,
      requireTwoFactorAuth:
        existingConfig.security?.requireTwoFactorAuth ?? payload.security.requireTwoFactorAuth,
      allowedIpAddresses:
        existingConfig.security?.allowedIpAddresses?.length
          ? existingConfig.security.allowedIpAddresses
          : payload.security.allowedIpAddresses,
    },
    notifications: {
      newUserRegistration:
        existingConfig.notifications?.newUserRegistration ??
        payload.notifications.newUserRegistration,
      serviceRequestAlerts:
        existingConfig.notifications?.serviceRequestAlerts ??
        payload.notifications.serviceRequestAlerts,
      systemErrors:
        existingConfig.notifications?.systemErrors ?? payload.notifications.systemErrors,
      securityAlerts:
        existingConfig.notifications?.securityAlerts ?? payload.notifications.securityAlerts,
      subscriptionRenewals:
        existingConfig.notifications?.subscriptionRenewals ??
        payload.notifications.subscriptionRenewals,
    },
    updatedBy: existingConfig.updatedBy || payload.updatedBy,
  };
};

const ensurePlans = async (dryRun) => {
  for (const plan of PLAN_DEFINITIONS) {
    if (dryRun) {
      console.log(`[dry-run] Upsert plan: ${plan.name}`);
      continue;
    }

    await Plan.updateOne(
      { name: plan.name },
      {
        $set: {
          price: plan.price,
          billingCycle: plan.billingCycle,
          features: plan.features,
        },
      },
      { upsert: true }
    );
  }
};

const ensureStaffUser = async ({ name, email, password, role, dryRun }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await AuthUser.findOne({ email: normalizedEmail }).select("+password");

  // The schema deliberately permits only one super-admin. Never silently
  // replace an existing owner account merely because a seed environment has a
  // different email address.
  if (role === "superadmin") {
    const existingSuperAdmin = await AuthUser.findOne({ role: "superadmin" });
    if (existingSuperAdmin && existingSuperAdmin.email !== normalizedEmail) {
      throw new Error(
        `A super-admin already exists (${existingSuperAdmin.email}). Use that email in SEED_SUPERADMIN_EMAIL instead of creating another account.`
      );
    }
  }

  if (dryRun) {
    console.log(
      `[dry-run] ${existingUser ? "Update" : "Create"} ${role} user: ${normalizedEmail}`
    );
    return existingUser;
  }

  let authUser = existingUser;

  if (!authUser) {
    authUser = await AuthUser.create({
      name,
      email: normalizedEmail,
      password,
      role,
      isActive: true,
      isVerified: true,
    });
  } else {
    authUser.name = name;
    authUser.email = normalizedEmail;
    authUser.password = password;
    authUser.role = role;
    authUser.isActive = true;
    authUser.isVerified = true;
    await authUser.save();
  }

  return authUser;
};

const ensureStaffAccess = async (authUser, role, dryRun) => {
  if (!authUser) {
    return;
  }

  const enterprisePlan = await Plan.findOne({ name: "enterprise" });

  if (!enterprisePlan) {
    throw new Error("Enterprise plan not found after seeding.");
  }

  const subId = `SUB-${authUser._id.toString().slice(-6).toUpperCase()}`;

  if (dryRun) {
    console.log(`[dry-run] Sync ${role} access for user: ${authUser.email}`);
    return;
  }

  await UserManagement.updateOne(
    { _id: authUser._id },
    {
      $set: {
        name: authUser.name,
        email: authUser.email,
        role,
        status: "active",
        isActive: true,
        avatar: "",
        plan: "enterprise",
        sub_id: subId,
        deletedAt: null,
        lastActiveAt: new Date(),
      },
    },
    { upsert: true }
  );

  const now = new Date();
  const nextRenewalDate = new Date(now);
  nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 100);

  await Subscription.updateOne(
    { user: authUser._id },
    {
      $set: {
        sub_id: subId,
        user: authUser._id,
        plan: enterprisePlan._id,
        amount: enterprisePlan.price,
        status: "active",
        startDate: now,
        nextRenewalDate,
        cancelledAt: null,
        pausedAt: null,
        renewalReminderSent: false,
      },
    },
    { upsert: true }
  );
};

const ensureSystemConfig = async (adminUserId, dryRun) => {
  const existingConfig = await SystemConfig.findOne();
  const payload = buildConfigPayload();
  payload.updatedBy = adminUserId || existingConfig?.updatedBy;

  const nextConfig = mergeConfig(existingConfig, payload);

  if (dryRun) {
    console.log("[dry-run] Upsert system config");
    return;
  }

  if (!existingConfig) {
    await SystemConfig.create(nextConfig);
    return;
  }

  existingConfig.set(nextConfig);
  await existingConfig.save();
};

const showHelp = () => {
  console.log(`
Usage:
  npm run seed:dev
  npm run seed:prod
  npm run seed -- --mode=dev
  npm run seed -- --mode=prod --email=admin@example.com --password=Secret123!

Environment variables:
  MONGO_URI_DEV or MONGO_URI
  MONGO_URI_PROD
  SEED_ADMIN_NAME
  SEED_ADMIN_EMAIL
  SEED_ADMIN_PASSWORD
  SEED_SUPERADMIN_NAME
  SEED_SUPERADMIN_EMAIL
  SEED_SUPERADMIN_PASSWORD
  SEED_ALLOWED_IPS
`);
};

const main = async () => {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  const { mode, uri } = getMongoUri(args.mode);
  const seedName = args.name || process.env.SEED_ADMIN_NAME || "Vision Tech Admin";
  const seedEmail = args.email || process.env.SEED_ADMIN_EMAIL || "admin@visiontech.local";
  const seedPassword = args.password || process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const superAdminName = process.env.SEED_SUPERADMIN_NAME || "NVT Essentials Owner";
  const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL?.trim();
  const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD;

  if (Boolean(superAdminEmail) !== Boolean(superAdminPassword)) {
    throw new Error(
      "Set both SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD, or leave both unset."
    );
  }
  if (superAdminEmail && superAdminEmail.toLowerCase() === seedEmail.toLowerCase()) {
    throw new Error("SEED_SUPERADMIN_EMAIL must be different from SEED_ADMIN_EMAIL.");
  }

  console.log(`Seeding ${mode} database...`);
  console.log(`Mongo URI: ${uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}`);

  await mongoose.connect(uri);

  try {
    await ensurePlans(args.dryRun);
    const adminUser = await ensureStaffUser({
      name: seedName,
      email: seedEmail,
      password: seedPassword,
      role: "admin",
      dryRun: args.dryRun,
    });

    await ensureStaffAccess(adminUser, "admin", args.dryRun);

    let superAdminUser = null;
    if (superAdminEmail) {
      superAdminUser = await ensureStaffUser({
        name: superAdminName,
        email: superAdminEmail,
        password: superAdminPassword,
        role: "superadmin",
        dryRun: args.dryRun,
      });
      await ensureStaffAccess(superAdminUser, "superadmin", args.dryRun);
    } else {
      console.warn(
        "No super-admin was seeded. Set SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD to create the System Configuration owner account."
      );
    }

    await ensureSystemConfig(superAdminUser?._id || adminUser?._id, args.dryRun);

    console.log(
      args.dryRun
        ? "Dry run complete. No data was written."
        : `Seed complete. Admin user ready: ${seedEmail}${superAdminEmail ? `; super-admin ready: ${superAdminEmail}` : ""}`
    );
  } finally {
    await mongoose.disconnect();
  }
};

main().catch(async (error) => {
  console.error("Seed failed:", error.message);
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
