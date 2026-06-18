import { useEffect, useMemo, useState } from "react";
import {
  Search, CheckCircle, AlertCircle, AlertTriangle, Info,
  Activity, Download, ChevronDown, X, User, Calendar, FileText,
} from "lucide-react";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import { getSystemLogs } from "../../services/admin/systemLogs.service";

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

function ViewLogModal({ log, onClose }: { log: SystemLog; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 9999, backgroundColor: "rgba(0,0,0,0.45)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
          <p className="text-xs text-gray-400 mt-0.5">{formatTimestamp(log.timestamp)}</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${typeStyle[log.type]}`}>
            {typeIcon[log.type]}{log.type}
          </span>
        </div>
        <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
          {[
            { icon: <Activity size={13} className="text-gray-400" />, label: "Action", value: log.action },
            { icon: <User size={13} className="text-gray-400" />, label: "User", value: log.user },
            { icon: <Calendar size={13} className="text-gray-400" />, label: "Time", value: formatTimestamp(log.timestamp) },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 text-sm">
              {row.icon}
              <span className="text-gray-400 w-14 flex-shrink-0">{row.label}</span>
              <span className="text-gray-700 font-medium break-all">{row.value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={13} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</p>
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

export default function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All Types" | LogType>("All Types");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [viewingLog, setViewingLog] = useState<SystemLog | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { fetchLogs(); }, []);
  useEffect(() => { setPage(0); }, [search, typeFilter]);

  const timelineIconStyle: Record<LogType, string> = {
    success: "bg-green-50",
    info: "bg-blue-50",
    warning: "bg-yellow-50",
    error: "bg-red-50",
  };

  const timelineEvents: TimelineEvent[] = useMemo(
    () =>
      [...logs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)
        .map((l) => ({
          id: l._id,
          type: l.type,
          title: l.action.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" "),
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
      const res = await getSystemLogs({
        page: 1,
        limit: 500,
        search,
        type: typeFilter === "All Types" ? "all" : typeFilter,
      });
      setLogs(
        (res.data.logs || []).map((log: any) => ({
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
      setError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const rows = [
      ["Timestamp", "Type", "Action", "User", "Details"],
      ...logs.map((l) => [formatTimestamp(l.timestamp), l.type, l.action, l.user, l.details]),
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
      const matchSearch =
        (l.action || "").toLowerCase().includes(q) ||
        (l.user || "").toLowerCase().includes(q) ||
        (l.details || "").toLowerCase().includes(q);
      const matchType = typeFilter === "All Types" || l.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [logs, search, typeFilter]);

  const paginatedFiltered = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const stats = [
    { label: "Total Logs", value: counts.total, color: "text-blue-500", bg: "bg-blue-50", icon: <Activity className="text-blue-500" size={22} /> },
    { label: "Errors", value: counts.error, color: "text-red-500", bg: "bg-red-50", icon: <AlertCircle className="text-red-500" size={22} /> },
    { label: "Warnings", value: counts.warning, color: "text-yellow-500", bg: "bg-yellow-50", icon: <AlertTriangle className="text-yellow-500" size={22} /> },
    { label: "Success", value: counts.success, color: "text-green-600", bg: "bg-green-50", icon: <CheckCircle className="text-green-600" size={22} /> },
  ];

  const typeOptions: ("All Types" | LogType)[] = ["All Types", "success", "info", "warning", "error"];

  const TABLE_HEADERS = [
    { label: "Timestamp" },
    { label: "Type" },
    { label: "Action" },
    { label: "User" },
    { label: "Details" },
    { label: "IP Address" },
  ];

  return (
    <>
      {viewingLog && <ViewLogModal log={viewingLog} onClose={() => setViewingLog(null)} />}

      {typeDropdownOpen && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 100 }}
          onClick={() => setTypeDropdownOpen(false)}
        />
      )}

      <div className="w-full min-h-screen bg-gray-50">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">System Logs</h1>
            <p className="text-sm sm:text-md text-gray-700 mt-1">Monitor system activity and events</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-700 bg-white rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex-shrink-0"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export Logs</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white border border-gray-700 rounded-xl p-3 sm:p-5 shadow-sm flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs sm:text-md text-gray-700 mb-1">{s.label}</p>
                <p className={`text-2xl sm:text-4xl font-bold ${s.color}`}>{s.value}</p>
              </div>
              <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                {s.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 p-3 sm:p-4 bg-white border border-gray-700 border-b-0 rounded-t-xl">
          <div className="flex items-center gap-2 flex-1 border border-gray-700 rounded-lg px-3 py-2 bg-gray-100 focus-within:border-gray-400 focus-within:bg-white transition-all">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search logs by action, user, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-xs sm:text-sm text-gray-700 placeholder-gray-700 min-w-0"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="relative sm:w-44" style={{ zIndex: 200 }}>
            <button
              type="button"
              onClick={() => setTypeDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 border border-gray-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-600 bg-gray-100 hover:bg-white hover:border-gray-300 transition-all"
            >
              <span className="capitalize">{typeFilter}</span>
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform ${typeDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {typeDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 w-full bg-white border border-gray-700 rounded-xl shadow-lg overflow-hidden">
                {typeOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setTypeFilter(opt); setTypeDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors capitalize ${
                      typeFilter === opt
                        ? "bg-gray-50 text-gray-900 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {opt}
                    {typeFilter === opt && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l3.5 3.5L12 3.5" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile Cards (below sm) ── */}
        <div className="sm:hidden bg-white border border-gray-700 border-t-0 rounded-b-xl divide-y divide-gray-100">
          {loading && (
            <div className="py-16 text-center text-gray-400 text-sm">Loading system logs...</div>
          )}
          {error && !loading && (
            <div className="py-16 text-center text-red-500 text-sm">{error}</div>
          )}
          {!loading && !error && (
            <>
              {paginatedFiltered.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">No logs found.</div>
              ) : (
                paginatedFiltered.map((l) => (
                  <div
                    key={l._id}
                    className="p-4 space-y-2 active:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setViewingLog(l)}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{l.action}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {formatTimestamp(l.timestamp)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize flex-shrink-0 ${typeStyle[l.type]}`}
                      >
                        {typeIcon[l.type]}{l.type}
                      </span>
                    </div>

                    {/* User + IP */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="truncate">{l.user}</span>
                      <span className="text-gray-300">·</span>
                      <span className="font-mono text-gray-400 flex-shrink-0">{l.ipAddress}</span>
                    </div>

                    {/* Details */}
                    <p className="text-xs text-gray-400 line-clamp-2">{l.details}</p>

                    {/* Tap hint */}
                    <p className="text-[10px] text-gray-300">Tap to view details</p>
                  </div>
                ))
              )}

              {/* Mobile Pagination */}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                  <span>
                    {page * rowsPerPage + 1}–
                    {Math.min((page + 1) * rowsPerPage, filtered.length)} of{" "}
                    {filtered.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      ‹ Prev
                    </button>
                    <button
                      disabled={(page + 1) * rowsPerPage >= filtered.length}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Desktop MUI Table (sm and above) ── */}
        <Paper
          elevation={0}
          className="hidden sm:block"
          sx={{
            width: "100%",
            overflow: "hidden",
            borderRadius: "0 0 12px 12px",
            border: "1px solid #374151",
            borderTop: "none",
          }}
        >
          {loading && (
            <div className="py-16 text-center text-gray-400 text-sm">Loading system logs...</div>
          )}
          {error && !loading && (
            <div className="py-16 text-center text-red-500 text-sm">{error}</div>
          )}

          {!loading && !error && (
            <>
              <TableContainer sx={{ maxHeight: 560 }}>
                <Table stickyHeader aria-label="system logs table">
                  <TableHead>
                    <TableRow>
                      {TABLE_HEADERS.map((h) => (
                        <TableCell
                          key={h.label}
                          sx={{
                            backgroundColor: "#ffffff",
                            fontWeight: 700,
                            fontSize: "0.625rem",
                            color: "#000000",
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            borderBottom: "1px solid #374151",
                            py: 1.75,
                            px: 2,
                            fontFamily: "inherit",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          align="center"
                          sx={{ py: 8, border: "none", fontFamily: "inherit" }}
                        >
                          <p className="text-gray-400 text-sm">No logs found.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedFiltered.map((l) => (
                        <TableRow
                          key={l._id}
                          hover
                          onClick={() => setViewingLog(l)}
                          sx={{
                            "&:hover": { backgroundColor: "#f9fafb", cursor: "pointer" },
                            "& td": {
                              borderBottom: "1px solid #374151",
                              py: 1.5,
                              px: 2,
                              fontFamily: "inherit",
                            },
                          }}
                        >
                          <TableCell>
                            <span className="text-gray-500 text-xs font-mono whitespace-nowrap">
                              {formatTimestamp(l.timestamp)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${typeStyle[l.type]}`}
                            >
                              {typeIcon[l.type]}{l.type}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-gray-800 text-xs">{l.action}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-500 text-xs truncate max-w-[180px] block">{l.user}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-500 text-xs line-clamp-1 block">{l.details}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-500 text-xs font-mono">{l.ipAddress}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[10, 20, 50, 100]}
                component="div"
                count={filtered.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_: unknown, newPage: number) => setPage(newPage)}
                onRowsPerPageChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0);
                }}
                sx={{
                  borderTop: "1px solid #374151",
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  fontFamily: "inherit",
                  "& .MuiTablePagination-select": { fontSize: "0.875rem", fontFamily: "inherit" },
                  "& .MuiTablePagination-displayedRows": { fontSize: "0.875rem", fontFamily: "inherit" },
                  "& .MuiTablePagination-selectLabel": { fontSize: "0.875rem", fontFamily: "inherit" },
                  "& .MuiIconButton-root": {
                    color: "#6b7280",
                    "&:hover": { backgroundColor: "#f9fafb" },
                    "&.Mui-disabled": { opacity: 0.4 },
                  },
                }}
              />
            </>
          )}
        </Paper>

        {/* Recent Activity Timeline */}
        <div className="bg-white border border-gray-700 rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Recent Activity Timeline</h2>
            <p className="text-xs sm:text-md text-gray-700 mt-0.5">
              Visual representation of recent system events
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {timelineEvents.map((event, idx) => (
              <div
                key={event.id}
                className="flex items-start gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors relative"
              >
                {idx < timelineEvents.length - 1 && (
                  <div className="absolute left-[35px] sm:left-[43px] top-[60px] bottom-0 w-0.5 bg-gray-100" />
                )}
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${timelineIconStyle[event.type]}`}
                >
                  {typeIcon[event.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{event.title}</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5 line-clamp-2">
                    {event.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {event.user}
                    <span className="mx-1.5">·</span>
                    {event.ipAddress}
                  </p>
                  {/* Timestamp on mobile goes below */}
                  <p className="text-[10px] text-gray-400 font-mono mt-1 sm:hidden">
                    {formatTimestamp(event.timestamp)}
                  </p>
                </div>
                {/* Timestamp on desktop stays to the right */}
                <p className="hidden sm:block text-xs text-gray-400 font-mono flex-shrink-0 pt-0.5">
                  {formatTimestamp(event.timestamp)}
                </p>
              </div>
            ))}
            {timelineEvents.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">No recent activity.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}