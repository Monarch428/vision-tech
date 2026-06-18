import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanTask {
  id: string;
  name: string;
  startDate: string;
  status: string; // "✅ Completed" | "🔄 Running" | "⏳ Pending" | "❌ Failed"
}

interface MachineInfo {
  name: string;
  ip: string;
  os: string;
  lastSeen: string;
  securityStatus: number; // 1=secure, 2=infected, 3=at risk
}

interface ScanReportData {
  success: boolean;
  machine: MachineInfo;
  scans: ScanTask[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  if (!dateStr) return "Unknown";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function securityLabel(status: number): { label: string; color: string } {
  if (status === 1) return { label: "Active", color: "#16a34a" };
  if (status === 2) return { label: "Infected", color: "#dc2626" };
  return { label: "At Risk", color: "#d97706" };
}

function taskStatusBadge(status: string): { bg: string; text: string; dot: string } {
  if (status.includes("Completed"))
    return { bg: "#dcfce7", text: "#15803d", dot: "#16a34a" };
  if (status.includes("Running"))
    return { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" };
  if (status.includes("Pending"))
    return { bg: "#fef9c3", text: "#92400e", dot: "#d97706" };
  return { bg: "#fee2e2", text: "#b91c1c", dot: "#dc2626" };
}

function stripEmoji(str: string): string {
  return str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✅🔄⏳❌]/gu, "").trim();
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ShieldCheckIcon = ({ color = "#16a34a", size = 22 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.5C16.5 22.15 20 17.25 20 12V6l-8-4z"
      stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={`${color}18`} />
    <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClockIcon = ({ color = "#3b82f6", size = 22 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" fill={`${color}18`} />
    <path d="M12 7v5l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AlertIcon = ({ color = "#d97706", size = 22 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke={color} strokeWidth="1.8" fill={`${color}18`} />
    <path d="M12 9v4M12 17h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MonitorIcon = ({ color = "#6b7280", size = 18 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="3" width="20" height="14" rx="2" stroke={color} strokeWidth="1.8" />
    <path d="M8 21h8M12 17v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const SpinnerIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
    style={{ animation: "spin 1s linear infinite" }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
  </svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, valueColor,
}: {
  label: string; value: string; icon: React.ReactNode; valueColor?: string;
}) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16,
      padding: "18px 20px", display: "flex", alignItems: "center",
      justifyContent: "space-between", flex: 1, minWidth: 0,
    }}>
      <div>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 4, fontWeight: 500 }}>{label}</p>
        <p style={{ color: valueColor || "#111827", fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </p>
      </div>
      <div style={{
        background: "#f9fafb", borderRadius: 12, width: 46, height: 46,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
    </div>
  );
}

function ServiceRow({ task }: { task: ScanTask }) {
  const badge = taskStatusBadge(task.status);
  const cleanStatus = stripEmoji(task.status);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", background: "#f9fafb",
      borderRadius: 12, marginBottom: 10,
    }}>
      <div style={{
        background: "#dcfce7", borderRadius: 10, width: 38, height: 38,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <ShieldCheckIcon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, color: "#111827", fontSize: 14, marginBottom: 2 }}>{task.name}</p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          {task.startDate ? `Started: ${new Date(task.startDate).toLocaleString()}` : "—"}
        </p>
      </div>
      <span style={{
        background: badge.bg, color: badge.text, fontSize: 12, fontWeight: 600,
        padding: "5px 12px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6,
        whiteSpace: "nowrap",
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%", background: badge.dot,
          display: "inline-block",
        }} />
        {cleanStatus}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScanReport() {
  const [data, setData] = useState<ScanReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"status" | "schedule" | "machine">("status");

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch("/api/selfhelp/scan-report", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to load report");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12 }}>
        <SpinnerIcon size={32} />
        <p style={{ color: "#6b7280", fontSize: 14 }}>Fetching scan report...</p>
      </div>
    );
  }

  // ── Error state ──
  if (error || !data?.success) {
    return (
      <div style={{
        background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 16,
        padding: 24, textAlign: "center",
      }}>
        <AlertIcon color="#dc2626" size={32} />
        <p style={{ color: "#b91c1c", fontWeight: 600, marginTop: 10 }}>Failed to load report</p>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>{error}</p>
      </div>
    );
  }

  const { machine, scans } = data;
  const secStatus = securityLabel(machine.securityStatus);
  const completedScans = scans.filter(s => s.status.includes("Completed")).length;
  const lastScan = scans.find(s => s.startDate);

  const TABS = [
    { key: "status", label: "Status" },
    { key: "schedule", label: "Scan History" },
    { key: "machine", label: "Machine Info" },
  ] as const;

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", margin: 0 }}>
          Antivirus Report
        </h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
          Powered by Bitdefender GravityZone
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard
          label="Protection Status"
          value={secStatus.label}
          valueColor={secStatus.color}
          icon={<ShieldCheckIcon color={secStatus.color} />}
        />
        <StatCard
          label="Last Scan"
          value={lastScan ? timeAgo(lastScan.startDate) : "Never"}
          icon={<ClockIcon />}
        />
        <StatCard
          label="Scans Completed"
          value={String(completedScans)}
          icon={<AlertIcon color="#d97706" />}
        />
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: "flex", gap: 6, background: "#f3f4f6", borderRadius: 12,
        padding: 5, marginBottom: 20, width: "fit-content",
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13, transition: "all 0.15s",
              background: activeTab === tab.key ? "#fff" : "transparent",
              color: activeTab === tab.key ? "#111827" : "#6b7280",
              boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Panels ── */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: 20, padding: "20px 20px 12px",
      }}>

        {/* Status Tab */}
        {activeTab === "status" && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
              Service Status
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 18 }}>
              Track your antivirus services
            </p>
            {scans.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 13 }}>No scan tasks found.</p>
            ) : (
              scans.map(task => <ServiceRow key={task.id} task={task} />)
            )}
          </>
        )}

        {/* Scan History Tab */}
        {activeTab === "schedule" && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
              Scan History
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 18 }}>
              All scan tasks from Bitdefender
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  {["Task Name", "Start Date", "Status"].map(h => (
                    <th key={h} style={{
                      textAlign: "left", padding: "8px 10px", color: "#9ca3af",
                      fontWeight: 600, fontSize: 12,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scans.map(task => {
                  const badge = taskStatusBadge(task.status);
                  return (
                    <tr key={task.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                      <td style={{ padding: "10px 10px", color: "#374151", fontWeight: 500 }}>
                        {task.name}
                      </td>
                      <td style={{ padding: "10px 10px", color: "#6b7280" }}>
                        {task.startDate ? new Date(task.startDate).toLocaleString() : "—"}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{
                          background: badge.bg, color: badge.text, fontSize: 11,
                          fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                        }}>
                          {stripEmoji(task.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {/* Machine Info Tab */}
        {activeTab === "machine" && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
              Machine Information
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 18 }}>
              Details of the protected endpoint
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Hostname", value: machine.name || "—" },
                { label: "IP Address", value: machine.ip || "—" },
                { label: "Operating System", value: machine.os || "—" },
                { label: "Last Seen", value: machine.lastSeen ? new Date(machine.lastSeen).toLocaleString() : "—" },
                {
                  label: "Security Status",
                  value: secStatus.label,
                  valueColor: secStatus.color,
                },
              ].map(row => (
                <div key={row.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 14px", background: "#f9fafb", borderRadius: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <MonitorIcon />
                    <span style={{ color: "#6b7280", fontSize: 13 }}>{row.label}</span>
                  </div>
                  <span style={{
                    fontWeight: 600, fontSize: 13,
                    color: (row as any).valueColor || "#111827",
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* CSS keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}