import { useEffect, useMemo, useState } from "react";
import {
  Search,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Activity,
  Download,
  ChevronDown,
  X,
  User,
  Calendar,
  FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type LogType = "success" | "info" | "warning" | "error";

interface SystemLog {
  _id: string;
  timestamp: string;
  type: LogType;
  action: string;
  user: string;
  details: string;
  ipAddress: string;
}

interface TimelineEvent {
  id: string;
  type: LogType;
  title: string;
  description: string;
  user: string;
  ipAddress: string;
  timestamp: string;
}

// ─── Style Maps ──────────────────────────────────────────────────────────────
const typeStyle: Record<LogType, string> = {
  success: "bg-green-100 text-green-700",
  info: "bg-blue-100 text-blue-600",
  warning: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-600",
};

const typeIcon: Record<LogType, React.ReactNode> = {
  success: <CheckCircle size={11} />,
  info: <Info size={11} />,
  warning: <AlertTriangle size={11} />,
  error: <AlertCircle size={11} />,
};

const formatTimestamp = (d: string) => {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// ─── View Modal ───────────────────────────────────────────────────────────────
function ViewLogModal({
  log,
  onClose,
}: {
  log: SystemLog;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 9999, backgroundColor: "rgba(0,0,0,0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">Log Details</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatTimestamp(log.timestamp)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${typeStyle[log.type]}`}
          >
            {typeIcon[log.type]}
            {log.type}
          </span>
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
          {[
            {
              icon: <Activity size={13} className="text-gray-400" />,
              label: "Action",
              value: log.action,
            },
            {
              icon: <User size={13} className="text-gray-400" />,
              label: "User",
              value: log.user,
            },
            {
              icon: <Calendar size={13} className="text-gray-400" />,
              label: "Time",
              value: formatTimestamp(log.timestamp),
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 text-sm"
            >
              {row.icon}
              <span className="text-gray-400 w-14 flex-shrink-0">
                {row.label}
              </span>
              <span className="text-gray-700 font-medium">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={13} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Details
            </p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{log.details}</p>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All Types" | LogType>(
    "All Types",
  );
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [viewingLog, setViewingLog] = useState<SystemLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const timelineIconStyle: Record<LogType, string> = {
    success: "bg-green-50",
    info: "bg-blue-50",
    warning: "bg-yellow-50",
    error: "bg-red-50",
  };

  const timelineEvents: TimelineEvent[] = useMemo(
    () =>
      [...logs]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 5)
        .map((l) => ({
          id: l._id,
          type: l.type,
          title: l.action
            .split("_")
            .map((w) => w[0] + w.slice(1).toLowerCase())
            .join(" "),
          description: l.details,
          user: l.user,
          ipAddress: l.ipAddress,
          timestamp: l.timestamp,
        })),
    [logs],
  );

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        `http://localhost:3000/api/system-logs?page=1&limit=500&search=${search}&type=${
          typeFilter === "All Types" ? "all" : typeFilter
        }`,
        {
          headers: { "Content-Type": "application/json" },
        },
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to fetch");

      setLogs(
        (data.logs || []).map((log: any) => ({
          _id: log._id,
          timestamp: log.loggedAt || log.createdAt || new Date().toISOString(),
          type: log.type || "info",
          action: log.action || "UNKNOWN_ACTION",
          user: log.userEmail || "System",
          details: log.details || "",
          ipAddress: log.ipAddress || "-",
        })),
      );
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const rows = [
      ["Timestamp", "Type", "Action", "User", "Details"],
      ...logs.map((l) => [
        formatTimestamp(l.timestamp),
        l.type,
        l.action,
        l.user,
        l.details,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "system-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(
    () => ({
      total: logs.length,
      error: logs.filter((l) => l.type === "error").length,
      warning: logs.filter((l) => l.type === "warning").length,
      success: logs.filter((l) => l.type === "success").length,
    }),
    [logs],
  );

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const q = search.toLowerCase();

      const action = l.action || "";
      const user = l.user || "";
      const details = l.details || "";

      const matchSearch =
        action.toLowerCase().includes(q) ||
        user.toLowerCase().includes(q) ||
        details.toLowerCase().includes(q);

      const matchType = typeFilter === "All Types" || l.type === typeFilter;

      return matchSearch && matchType;
    });
  }, [logs, search, typeFilter]);

  const stats = [
    {
      label: "Total Logs",
      value: counts.total,
      color: "text-blue-500",
      bg: "bg-blue-50",
      icon: <Activity className="text-blue-500" size={22} />,
    },
    {
      label: "Errors",
      value: counts.error,
      color: "text-red-500",
      bg: "bg-red-50",
      icon: <AlertCircle className="text-red-500" size={22} />,
    },
    {
      label: "Warnings",
      value: counts.warning,
      color: "text-yellow-500",
      bg: "bg-yellow-50",
      icon: <AlertTriangle className="text-yellow-500" size={22} />,
    },
    {
      label: "Success",
      value: counts.success,
      color: "text-green-600",
      bg: "bg-green-50",
      icon: <CheckCircle className="text-green-600" size={22} />,
    },
  ];

  const typeOptions: ("All Types" | LogType)[] = [
    "All Types",
    "success",
    "info",
    "warning",
    "error",
  ];

  return (
    <>
      {viewingLog && (
        <ViewLogModal log={viewingLog} onClose={() => setViewingLog(null)} />
      )}

      {/* Close dropdown on outside click */}
      {typeDropdownOpen && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 100 }}
          onClick={() => setTypeDropdownOpen(false)}
        />
      )}

      <div className="w-full min-h-screen bg-gray-50 p-3 sm:p-5 lg:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              System Logs
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Monitor system activity and events
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex-shrink-0"
          >
            <Download size={15} />
            Export Logs
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs sm:text-sm text-gray-500 mb-1">
                  {s.label}
                </p>
                <p className={`text-3xl sm:text-4xl font-bold ${s.color}`}>
                  {s.value}
                </p>
              </div>
              <div
                className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}
              >
                {s.icon}
              </div>
            </div>
          ))}
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-2 p-3 sm:p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 flex-1 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus-within:border-gray-400 focus-within:bg-white transition-all">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search logs by action, user, or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-xs sm:text-sm text-gray-700 placeholder-gray-300 min-w-0"
              />
            </div>

            {/* Custom dropdown to match Figma design */}
            <div className="relative sm:w-44" style={{ zIndex: 200 }}>
              <button
                type="button"
                onClick={() => setTypeDropdownOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-600 bg-gray-50 hover:bg-white hover:border-gray-300 transition-all"
              >
                <span className="capitalize">{typeFilter}</span>
                <ChevronDown
                  size={14}
                  className={`text-gray-400 transition-transform ${typeDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {typeDropdownOpen && (
                <div className="absolute top-full mt-1 left-0 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {typeOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setTypeFilter(opt);
                        setTypeDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors capitalize ${
                        typeFilter === opt
                          ? "bg-gray-50 text-gray-900 font-semibold"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt}
                      {typeFilter === opt && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                        >
                          <path
                            d="M2 7l3.5 3.5L12 3.5"
                            stroke="#1e293b"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loading && (
            <div className="py-16 text-center text-gray-400 text-sm">
              Loading system logs...
            </div>
          )}
          {error && !loading && (
            <div className="py-16 text-center text-red-500 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* ── Desktop Table ── */}
              <div className="hidden sm:block w-full overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: "700px" }}>
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[
                        { label: "Timestamp", w: "w-[160px]" },
                        { label: "Type", w: "w-[110px]" },
                        { label: "Action", w: "min-w-[180px]" },
                        { label: "User", w: "w-[180px]" },
                        { label: "Details", w: "min-w-[180px]" },
                        { label: "IP Address", w: "w-[180px]" },
                      ].map((h, i) => (
                        <th
                          key={i}
                          className={`text-left px-4 py-3 text-[10px] font-bold text-black-400 uppercase tracking-wider ${h.w}`}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr
                        key={l._id}
                        className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">
                          {formatTimestamp(l.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${typeStyle[l.type]}`}
                          >
                            {typeIcon[l.type]}
                            {l.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800 text-xs">
                          {l.action}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[180px]">
                          {l.user}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          <span className="line-clamp-1">{l.details}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono max-w-[180px]">
                          {l.ipAddress}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile Cards ── */}
              <div className="sm:hidden divide-y divide-gray-100">
                {filtered.map((l) => (
                  <div key={l._id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">
                          {l.action}
                        </p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          {formatTimestamp(l.timestamp)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize flex-shrink-0 ${typeStyle[l.type]}`}
                      >
                        {typeIcon[l.type]}
                        {l.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{l.user}</p>
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {l.details}
                    </p>
                  </div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="py-16 text-center text-gray-400 text-sm">
                  No logs found.
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">
              Recent Activity Timeline
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Visual representation of recent system events
            </p>
          </div>

          <div className="divide-y divide-gray-50">
            {timelineEvents.map((event, idx) => (
              <div
                key={event.id}
                className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors relative"
              >
                {/* Connector line */}
                {idx < timelineEvents.length - 1 && (
                  <div className="absolute left-[43px] top-[60px] bottom-0 w-0.5 bg-gray-100" />
                )}

                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${timelineIconStyle[event.type]}`}
                >
                  {typeIcon[event.type]}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    {event.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {event.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {event.user}
                    <span className="mx-1.5">•</span>
                    {event.ipAddress}
                  </p>
                </div>

                {/* Timestamp */}
                <p className="text-xs text-gray-400 font-mono flex-shrink-0 pt-0.5">
                  {formatTimestamp(event.timestamp)}
                </p>
              </div>
            ))}

            {timelineEvents.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
