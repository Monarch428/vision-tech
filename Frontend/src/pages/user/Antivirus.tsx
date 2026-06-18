import { useEffect, useState, type JSX } from "react";
import {
  createAntivirusSchedule,
  getScanReport,
  type ScanReport,
} from "../../services/user/antivirus.service";

type TabType = "status" | "schedule" | "assistance";

const statusBadgeStyles: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  "in progress": "bg-blue-100 text-blue-700",
  scheduled: "bg-yellow-100 text-yellow-700",
};

const statusIcons: Record<string, JSX.Element> = {
  completed: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  "in progress": (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  ),
  scheduled: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
};

const commonIssues = [
  "Antivirus installation and setup",
  "Virus or malware removal",
  "Security software configuration",
  "System performance optimization",
  "Real-time protection issues",
  "Firewall setup and management",
];

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Antivirus() {
  const [activeTab, setActiveTab] = useState<TabType>("status");
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");

  // Schedule form state
  const [serviceType, setServiceType] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [numDevices, setNumDevices] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitError, setSubmitError] = useState("");

  const tabs: { label: string; value: TabType }[] = [
    { label: "Status", value: "status" },
    { label: "Schedule", value: "schedule" },
    { label: "Assistance", value: "assistance" },
  ];

  useEffect(() => {
    const container =
      document.querySelector("main") ||
      document.querySelector("[class*='overflow-y']") ||
      document.documentElement;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── GET: Fetch scan report ──
  useEffect(() => {
    (async () => {
      try {
        setReportLoading(true);
        const data = await getScanReport();
        setScanReport(data);
      } catch {
        setReportError("Failed to load scan report.");
      } finally {
        setReportLoading(false);
      }
    })();
  }, []);

  // ── POST: Create antivirus schedule ──
  const handleScheduleSubmit = async () => {
    setSubmitError("");
    setSubmitSuccess("");

    if (!serviceType || !preferredDate || !preferredTime || !numDevices) {
      setSubmitError("Please fill in all fields before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      await createAntivirusSchedule({
        serviceType,
        preferredDate,
        preferredTime,
        numberOfDevices: numDevices,
      });
      setSubmitSuccess("Service scheduled successfully!");
      setServiceType("");
      setPreferredDate("");
      setPreferredTime("");
      setNumDevices("");
    } catch {
      setSubmitError("Server error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derive service statuses from scan report ──
  const serviceStatuses = scanReport
    ? [
        {
          name: "Scan",
          detail: `Last scan: ${formatDate(scanReport.recentScan.scanDate)}`,
          status: scanReport.recentScan.isClean ? ("completed" as const) : ("in progress" as const),
        },
        {
          name: "Update",
          detail: `Last update: ${formatDate(scanReport.machine.lastUpdate)}`,
          status: "in progress" as const,
        },
        {
          name: "Installation",
          detail: `Agent v${scanReport.machine.agentVersion}`,
          status: "scheduled" as const,
        },
      ]
    : [];

  // ── Derived values ──
  const protectionActive = scanReport?.machine.securityStatus === 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Antivirus & Security</h1>
        <p className="text-md text-gray-700 mt-1">Protect your devices with professional antivirus services</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Protection Status */}
        <div className="bg-white rounded-2xl border border-gray-400 p-4 flex items-center justify-between">
          <div>
            <p className="text-md text-gray-700 mb-1">Protection Status</p>
            <p className={`text-2xl font-bold ${protectionActive ? "text-green-600" : "text-red-500"}`}>
              {reportLoading ? "—" : protectionActive ? "Active" : "Inactive"}
            </p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        {/* Last Full Scan */}
        <div className="bg-white rounded-2xl border border-gray-400 p-4 flex items-center justify-between">
          <div>
            <p className="text-md text-gray-700 mb-1">Last Full Scan</p>
            <p className="text-xl font-bold text-gray-900">
              {reportLoading ? "—" : scanReport ? formatRelativeTime(scanReport.recentScan.scanDate) : "N/A"}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Threats Blocked */}
        <div className="bg-white rounded-2xl border border-gray-400 p-4 flex items-center justify-between">
          <div>
            <p className="text-md text-gray-700 mb-1">Threats Blocked</p>
            <p className="text-2xl font-bold text-gray-900">
              {reportLoading ? "—" : (scanReport?.stats.threatsBlocked ?? 0)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <svg className="w-7 h-7 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-gray-100 rounded-full p-1 mb-6 w-full sm:w-fit gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 rounded-full text-md sm:text-md font-semibold transition-all ${
              activeTab === tab.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── STATUS TAB ── */}
      {activeTab === "status" && (
        <div className="space-y-4">
          {reportError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {reportError}
            </div>
          )}

          {/* Service Status */}
          <div className="bg-white rounded-2xl border border-gray-400 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Service Status</h2>
            <p className="text-md text-gray-700 mb-5">Track your antivirus services</p>
            <div className="space-y-3">
              {reportLoading ? (
                <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
              ) : (
                serviceStatuses.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between border border-gray-100 rounded-2xl px-4 py-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-green-50 rounded-xl p-2 shrink-0">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900">{svc.name}</p>
                        <p className="text-md text-gray-700 truncate">{svc.detail}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${statusBadgeStyles[svc.status]}`}>
                      {statusIcons[svc.status]}
                      {svc.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Scan Results */}
          <div className="bg-white rounded-2xl border border-gray-400 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Recent Scan Results</h2>
            <p className="text-sm text-gray-500 mb-5">
              {scanReport
                ? `Last full system scan — ${formatDate(scanReport.recentScan.scanDate)}`
                : "Last full system scan"}
            </p>

            {reportLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading scan data...</p>
            ) : scanReport ? (
              <div className="space-y-4">

                {/* Files scanned */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Files scanned</span>
                    <span className="font-bold text-gray-900">
                      {(scanReport.recentScan.filesScanned ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-2" />
                </div>

                {/* Threats detected */}
                <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
                  <span className="text-gray-600">Threats detected</span>
                  <span className={`font-bold ${scanReport.recentScan.threatsDetected > 0 ? "text-red-600" : "text-green-600"}`}>
                    {scanReport.recentScan.threatsDetected}
                  </span>
                </div>
                
                {/* Clean / threat banner */}
                <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 mt-2 ${scanReport.recentScan.isClean ? "bg-green-50" : "bg-red-50"}`}>
                  <svg
                    className={`w-5 h-5 flex-shrink-0 ${scanReport.recentScan.isClean ? "text-green-600" : "text-red-600"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-sm font-semibold ${scanReport.recentScan.isClean ? "text-green-700" : "text-red-700"}`}>
                    {scanReport.recentScan.isClean
                      ? "Your system is clean and secure"
                      : `${scanReport.recentScan.threatsDetected} threat(s) detected — action required`}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No scan data available.</p>
            )}
          </div>
        </div>
      )}

      {/* ── SCHEDULE TAB ── */}
      {activeTab === "schedule" && (
        <div className="bg-white rounded-2xl border border-gray-400 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Schedule Antivirus Service</h2>
          <p className="text-md text-gray-700 mb-6">Book installation, setup, or maintenance</p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Service Type</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 text-md text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
              >
                <option value="" disabled>Select service type</option>
                <option value="installation">Installation</option>
                <option value="setup">Setup</option>
                <option value="maintenance">Maintenance</option>
                <option value="scan">Full Scan</option>
              </select>
            </div>

            <div>
              <label className="block text-md font-bold text-gray-900 mb-2">Preferred Date</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-xl bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-md font-bold text-gray-900 mb-2">Preferred Time</label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
              >
                <option value="">Select time</option>
                <option value="09:00">09:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="14:00">02:00 PM</option>
                <option value="15:00">03:00 PM</option>
                <option value="16:00">04:00 PM</option>
              </select>
            </div>

            <div>
              <label className="block text-md font-bold text-gray-900 mb-2">Number of Devices</label>
              <select
                value={numDevices}
                onChange={(e) => setNumDevices(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
              >
                <option value="">Select devices</option>
                <option value="1">1 Device</option>
                <option value="2">2 Devices</option>
                <option value="3">3 Devices</option>
                <option value="5">5 Devices</option>
                <option value="10">10+ Devices</option>
              </select>
            </div>

            {submitSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {submitSuccess}
              </div>
            )}
            {submitError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {submitError}
              </div>
            )}

            <button
              onClick={handleScheduleSubmit}
              disabled={submitting}
              className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              {submitting ? "Scheduling..." : "Schedule Service"}
            </button>
          </div>
        </div>
      )}

      {/* ── ASSISTANCE TAB ── */}
      {activeTab === "assistance" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-400 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Security Assistance</h2>
            <p className="text-md text-gray-700 mb-5">Get help from our security experts</p>

            <div className="bg-blue-50 rounded-2xl p-5 mb-6">
              <h3 className="text-base font-bold text-blue-800 mb-2">Need immediate help?</h3>
              <p className="text-sm text-blue-700 mb-4">
                Our security team is available to assist you with antivirus installation, configuration, and troubleshooting.
              </p>
              <button className="border border-blue-600 text-blue-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-colors">
                Request Security Assistance
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-gray-900 mb-4">Common Issues We Can Help With:</h3>
              <ul className="space-y-3">
                {commonIssues.map((issue) => (
                  <li key={issue} className="flex items-center gap-3 text-md text-gray-700">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-400 p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">Response Time</h3>
            <div className="space-y-3">
              {[
                { label: "High Priority:", value: "Within 2 hours" },
                { label: "Medium Priority:", value: "Within 24 hours" },
                { label: "Low Priority:", value: "Within 48 hours" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <span className="text-md text-gray-700">{row.label}</span>
                  <span className="font-bold text-gray-900">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}