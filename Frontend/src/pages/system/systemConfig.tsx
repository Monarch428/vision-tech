import { useState, useEffect, useMemo } from "react";

type TabType = "general" | "email" | "security" | "notifications";

const API_BASE = "http://localhost:3000/api/system-config";

// ─────────────────────────────────────────────
// Toggle Component
// ─────────────────────────────────────────────
function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
        enabled ? "bg-gray-900" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ─────────────────────────────────────────────
// Toggle Row
// ─────────────────────────────────────────────
function ToggleRow({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between border border-gray-100 rounded-2xl px-5 py-4">
      <div>
        <p className="font-bold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Field
// ─────────────────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-900 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-gray-100 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-gray-400";

const selectClass =
  "w-full px-4 py-3 rounded-xl bg-gray-100 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer";

// ─────────────────────────────────────────────
// Save Button
// ─────────────────────────────────────────────
function SaveButton({
  label,
  onClick,
  loading,
  disabled,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = loading || disabled;
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onClick}
        disabled={isDisabled}
        title={
          disabled && !loading
            ? "Please fill in all required fields"
            : undefined
        }
        className={`inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-colors text-sm
          ${
            isDisabled
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600 active:bg-green-700 text-white cursor-pointer"
          }`}
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
        )}
        {loading ? "Saving..." : label}
      </button>
      {disabled && !loading && (
        <p className="text-xs text-gray-400">
          Fill in all required fields to save.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-semibold text-white ${
        type === "success" ? "bg-green-500" : "bg-red-500"
      }`}
    >
      {type === "success" ? (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
// System Actions
// ─────────────────────────────────────────────
function SystemActions() {
  const actions = [
    {
      label: "Restart Services",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      ),
    },
    {
      label: "Backup Database",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      ),
    },
    {
      label: "Run Security Audit",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-1">System Actions</h2>
      <p className="text-sm text-gray-500 mb-5">
        Perform critical system operations
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            className="flex flex-col items-center justify-center gap-3 border border-gray-100 rounded-2xl px-4 py-6 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-800"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function SystemConfig() {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [fetchLoading, setFetchLoading] = useState(true);
  const [isExisting, setIsExisting] = useState(false);
  const [savingTab, setSavingTab] = useState<TabType | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  // ── General ──
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);

  // ── Email ──
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);

  // ── Security ──
  const [sessionTimeout, setSessionTimeout] = useState("");
  const [maxLoginAttempts, setMaxLoginAttempts] = useState("");
  const [minPasswordLength, setMinPasswordLength] = useState("");
  const [require2FA, setRequire2FA] = useState(false);
  const [allowedIPs, setAllowedIPs] = useState("");

  // ── Notifications (toggles only — always valid) ──
  const [newUserRegistration, setNewUserRegistration] = useState(false);
  const [serviceRequestAlerts, setServiceRequestAlerts] = useState(false);
  const [systemErrors, setSystemErrors] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState(false);
  const [subscriptionRenewals, setSubscriptionRenewals] = useState(false);

  // ─────────────────────────────────────────────
  // Per-tab validity — true means Save is enabled
  // ─────────────────────────────────────────────
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleTestEmail = async () => {
    try {
      setTestEmailLoading(true);

      const res = await fetch(`${API_BASE}/test-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          fromEmail
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setToast({ message: "Test email sent!", type: "success" });
    } catch (err: any) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const tabValid = useMemo(
    () => ({
      // All three text fields must be non-empty; timezone always has a value
      general: siteName.trim() !== "" && siteUrl.trim() !== "",

      // SMTP host, port, username, password, fromEmail, fromName all required
      email:
        smtpHost.trim() !== "" &&
        smtpPort.trim() !== "" &&
        smtpUsername.trim() !== "" &&
        smtpPassword.trim() !== "" &&
        fromEmail.trim() !== "" &&
        EMAIL_RE.test(fromEmail.trim()) &&
        fromName.trim() !== "",

      // All three number fields required
      security:
        sessionTimeout.trim() !== "" &&
        maxLoginAttempts.trim() !== "" &&
        minPasswordLength.trim() !== "",

      // Notifications tab only has toggles — always valid
      notifications: true,
    }),
    [
      siteName,
      siteUrl,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      fromEmail,
      fromName,
      sessionTimeout,
      maxLoginAttempts,
      minPasswordLength,
    ],
  );

  // ── Fetch on mount ──
  useEffect(() => {
    fetchConfig();
  }, []);

  const getToken = () => localStorage.getItem("token") || "";

  const fetchConfig = async () => {
    try {
      setFetchLoading(true);

      const res = await fetch(`${API_BASE}/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const data = await res.json();

      if (res.status === 404) {
        setIsExisting(false);
        return;
      }

      if (!res.ok) throw new Error(data.message || "Failed to fetch config");

      const c = data.config;

      setSiteName(c.general?.siteName ?? "");
      setSiteUrl(c.general?.siteUrl ?? "");
      setTimezone(c.general?.timezone ?? "UTC");
      setMaintenanceMode(c.general?.maintenanceMode ?? false);
      setAutoBackup(c.general?.autoBackup ?? true);

      setSmtpHost(c.email?.smtpHost ?? "");
      setSmtpPort(String(c.email?.smtpPort ?? ""));
      setSmtpUsername(c.email?.smtpUsername ?? "");
      setSmtpPassword(c.email?.smtpPassword ?? "");
      setFromEmail(c.email?.fromEmail ?? "");
      setFromName(c.email?.fromName ?? "");
      setEmailNotifications(c.email?.emailNotificationsEnabled ?? true);

      setSessionTimeout(String(c.security?.sessionTimeoutMinutes ?? ""));
      setMaxLoginAttempts(String(c.security?.maxLoginAttempts ?? ""));
      setMinPasswordLength(String(c.security?.minimumPasswordLength ?? ""));
      setRequire2FA(c.security?.requireTwoFactorAuth ?? false);
      setAllowedIPs((c.security?.allowedIpAddresses ?? []).join("\n"));

      setNewUserRegistration(c.notifications?.newUserRegistration ?? false);
      setServiceRequestAlerts(c.notifications?.serviceRequestAlerts ?? false);
      setSystemErrors(c.notifications?.systemErrors ?? false);
      setSecurityAlerts(c.notifications?.securityAlerts ?? false);
      setSubscriptionRenewals(c.notifications?.subscriptionRenewals ?? false);

      setIsExisting(true);
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to load configuration.",
        type: "error",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  const buildPayload = () => ({
    general: { siteName, siteUrl, timezone, maintenanceMode, autoBackup },
    email: {
      smtpHost,
      smtpPort: smtpPort ? Number(smtpPort) : 587,
      smtpUsername,
      smtpPassword,
      fromEmail,
      fromName,
      emailNotificationsEnabled: emailNotifications,
    },
    security: {
      sessionTimeoutMinutes: sessionTimeout ? Number(sessionTimeout) : null,
      maxLoginAttempts: maxLoginAttempts ? Number(maxLoginAttempts) : null,
      minimumPasswordLength: minPasswordLength
        ? Number(minPasswordLength)
        : null,
      requireTwoFactorAuth: require2FA,
      allowedIpAddresses: allowedIPs
        ? allowedIPs
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    },
    notifications: {
      newUserRegistration,
      serviceRequestAlerts,
      systemErrors,
      securityAlerts,
      subscriptionRenewals,
    },
  });

  const handleSave = async (tab: TabType) => {
    if (!tabValid[tab]) return;
    try {
      setSavingTab(tab);
      const method = isExisting ? "PUT" : "POST";
      const res = await fetch(API_BASE, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save settings");
      setIsExisting(true);
      setToast({ message: "Settings saved successfully.", type: "success" });
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to save settings.",
        type: "error",
      });
    } finally {
      setSavingTab(null);
    }
  };

  const tabs: { label: string; value: TabType }[] = [
    { label: "General", value: "general" },
    { label: "Email", value: "email" },
    { label: "Security", value: "security" },
    { label: "Notifications", value: "notifications" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            System Configuration
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage system-wide settings and configurations
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">System Status</p>
              <p className="text-2xl font-bold text-green-600">Operational</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <svg
                className="w-7 h-7 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Database Health</p>
              <p className="text-2xl font-bold text-green-600">98%</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <svg
                className="w-7 h-7 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">API Status</p>
              <p className="text-2xl font-bold text-green-600">Online</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <svg
                className="w-7 h-7 text-purple-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
              </svg>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="overflow-x-auto scrollbar-none mb-6">
          <div className="flex bg-gray-100 rounded-full p-1 w-full gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 px-4 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Skeleton */}
        {fetchLoading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-3 bg-gray-100 rounded w-1/4 mb-2" />
                <div className="h-10 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* ── GENERAL TAB ── */}
        {!fetchLoading && activeTab === "general" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                General Settings
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Basic system configuration options
              </p>
              <div className="space-y-5">
                <Field label="Site Name *">
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="My App"
                    className={inputClass}
                  />
                </Field>
                <Field label="Site URL *">
                  <input
                    type="url"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    className={inputClass}
                  />
                </Field>
                <Field label="Timezone">
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={selectClass}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">
                      America/Los_Angeles
                    </option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </select>
                </Field>
                <ToggleRow
                  title="Maintenance Mode"
                  description="Disable access for regular users during maintenance"
                  enabled={maintenanceMode}
                  onChange={() => setMaintenanceMode(!maintenanceMode)}
                />
                <ToggleRow
                  title="Auto Backup"
                  description="Automatically backup system data daily"
                  enabled={autoBackup}
                  onChange={() => setAutoBackup(!autoBackup)}
                />
                <SaveButton
                  label="Save General Settings"
                  onClick={() => handleSave("general")}
                  loading={savingTab === "general"}
                  disabled={!tabValid.general}
                />
              </div>
            </div>
            <SystemActions />
          </div>
        )}

        {/* ── EMAIL TAB ── */}
        {!fetchLoading && activeTab === "email" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Email Configuration
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Configure email server and settings
              </p>
              <div className="space-y-5">
                <Field label="SMTP Host *">
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.example.com"
                    className={inputClass}
                  />
                </Field>
                <Field label="SMTP Port *">
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className={inputClass}
                  />
                </Field>
                <Field label="SMTP Username *">
                  <input
                    type="text"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                    placeholder="your@email.com"
                    className={inputClass}
                  />
                </Field>
                <Field label="SMTP Password *">
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </Field>
                <Field label="From Email Address *">
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="From Name *">
                  <input
                    type="text"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <ToggleRow
                  title="Email Notifications"
                  description="Send email notifications to users"
                  enabled={emailNotifications}
                  onChange={() => setEmailNotifications(!emailNotifications)}
                />
                <div className="flex flex-wrap gap-3">
                  <SaveButton
                    label="Save Email Settings"
                    onClick={() => handleSave("email")}
                    loading={savingTab === "email"}
                    disabled={!tabValid.email}
                  />
                  <button
                    onClick={handleTestEmail}
                    disabled={testEmailLoading || !tabValid.email}
                    className={`inline-flex items-center gap-2 border font-semibold px-6 py-3 rounded-xl transition-colors text-sm
    ${
      testEmailLoading || !tabValid.email
        ? "border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50"
        : "border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
    }`}
                  >
                    {testEmailLoading ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                    {testEmailLoading ? "Sending..." : "Send Test Email"}
                  </button>
                </div>
              </div>
            </div>
            <SystemActions />
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {!fetchLoading && activeTab === "security" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Security Settings
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Configure security and authentication options
              </p>
              <div className="space-y-5">
                <Field label="Session Timeout (minutes) *">
                  <input
                    type="number"
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    placeholder="30"
                    className={inputClass}
                  />
                </Field>
                <Field label="Max Login Attempts *">
                  <input
                    type="number"
                    value={maxLoginAttempts}
                    onChange={(e) => setMaxLoginAttempts(e.target.value)}
                    placeholder="5"
                    className={inputClass}
                  />
                </Field>
                <Field label="Minimum Password Length *">
                  <input
                    type="number"
                    value={minPasswordLength}
                    onChange={(e) => setMinPasswordLength(e.target.value)}
                    placeholder="8"
                    className={inputClass}
                  />
                </Field>
                <ToggleRow
                  title="Require Two-Factor Authentication"
                  description="Force all users to enable 2FA on their accounts"
                  enabled={require2FA}
                  onChange={() => setRequire2FA(!require2FA)}
                />
                <Field label="Allowed IP Addresses (one per line)">
                  <textarea
                    value={allowedIPs}
                    onChange={(e) => setAllowedIPs(e.target.value)}
                    placeholder="Leave empty to allow all IPs"
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </Field>
                <SaveButton
                  label="Save Security Settings"
                  onClick={() => handleSave("security")}
                  loading={savingTab === "security"}
                  disabled={!tabValid.security}
                />
              </div>
            </div>
            <SystemActions />
          </div>
        )}

        {/* ── NOTIFICATIONS TAB ── */}
        {!fetchLoading && activeTab === "notifications" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Notification Settings
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Configure system notification preferences
              </p>
              <div className="space-y-3">
                <ToggleRow
                  title="New User Registration"
                  description="Notify admins when new users register"
                  enabled={newUserRegistration}
                  onChange={() => setNewUserRegistration(!newUserRegistration)}
                />
                <ToggleRow
                  title="Service Request Alerts"
                  description="Notify admins of new service requests"
                  enabled={serviceRequestAlerts}
                  onChange={() =>
                    setServiceRequestAlerts(!serviceRequestAlerts)
                  }
                />
                <ToggleRow
                  title="System Errors"
                  description="Notify admins of critical system errors"
                  enabled={systemErrors}
                  onChange={() => setSystemErrors(!systemErrors)}
                />
                <ToggleRow
                  title="Security Alerts"
                  description="Notify of suspicious activity or security threats"
                  enabled={securityAlerts}
                  onChange={() => setSecurityAlerts(!securityAlerts)}
                />
                <ToggleRow
                  title="Subscription Renewals"
                  description="Notify users before subscription renewal"
                  enabled={subscriptionRenewals}
                  onChange={() =>
                    setSubscriptionRenewals(!subscriptionRenewals)
                  }
                />
                <div className="pt-2">
                  <SaveButton
                    label="Save Notification Settings"
                    onClick={() => handleSave("notifications")}
                    loading={savingTab === "notifications"}
                    disabled={!tabValid.notifications}
                  />
                </div>
              </div>
            </div>
            <SystemActions />
          </div>
        )}
      </div>
    </div>
  );
}
