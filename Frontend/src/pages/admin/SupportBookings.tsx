import { useState, useMemo, useEffect } from "react";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import {
  getAllSupportBookings,
  assignSupportBooking,
  getAgentsForBooking,
} from "../../services/admin/supportBookings.service";

// ── Types ─────────────────────────────────────────────────────────────────
type Status = "in-progress" | "open" | "resolved" | "closed";

interface SupportBooking {
  _id: string;
  ticketNumber: number;
  ticket_no?: string;
  user: { name: string; email: string } | null;
  description: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: Status;
  createdAt: string;
  duration?: string;
  supportType?: string;
  scheduledAt?: string;
  assigned_user_id?: { _id: string; name: string } | null;
}

interface Agent {
  _id: string;
  name: string;
  email?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Priority Badge ────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: "bg-red-50 text-red-600 border border-red-200",
    medium: "bg-orange-50 text-orange-500 border border-orange-200",
    low: "bg-gray-100 text-gray-500 border border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[priority] || styles.low}`}>
      {priority}
    </span>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    "in-progress": "bg-blue-50 text-blue-600 border border-blue-200",
    open: "bg-yellow-50 text-yellow-600 border border-yellow-200",
    resolved: "bg-green-50 text-green-600 border border-green-200",
    closed: "bg-gray-100 text-gray-500 border border-gray-200",
  };
  const labels: Record<Status, string> = {
    "in-progress": "in-progress",
    open: "open",
    resolved: "resolved",
    closed: "closed",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 min-w-[130px] bg-white border border-gray-700 rounded-2xl px-5 py-4">
      <p className="text-md text-gray-700 font-medium mb-1.5">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ── Assign Wizard Modal ───────────────────────────────────────────────────
const STATUS_OPTIONS: { label: string; value: Status }[] = [
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in-progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

function AssignWizard({
  booking,
  onClose,
  onAssigned,
}: {
  booking: SupportBooking;
  onClose: () => void;
  onAssigned: (bookingId: string, agentName: string, newStatus: Status) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Status>(booking.status);
  const [step, setStep] = useState<"select" | "confirm" | "done">("select");
  const [assigning, setAssigning] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    getAgentsForBooking()
      .then((res) => {
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : [];
        setAgents(list);
      })
      .catch(() => console.error("Failed to fetch agents"))
      .finally(() => setLoadingAgents(false));
  }, []);

  const agent = agents.find((a) => a._id === selectedAgent);
  const ticketLabel = booking.ticket_no || booking.ticketNumber;

  const handleAssign = async () => {
    if (!selectedAgent) return;
    setAssigning(true);
    try {
      const res = await assignSupportBooking(booking._id, {
        assigned_user_id: selectedAgent,
        status: selectedStatus,
      });
      if (!res.data.success) { alert("Assignment failed"); return; }
      setStep("done");
      onAssigned(booking._id, agent?.name || "", selectedStatus);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Server error");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-50 text-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Assign Booking</p>
              <p className="text-xs text-gray-400 leading-tight">#{ticketLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === "select" && (
          <div className="px-5 py-4 space-y-4">
            <div className="bg-gray-50 rounded-xl px-3.5 py-3 text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700 text-sm truncate">{booking.description || "No description"}</p>
              <p>Category: <span className="capitalize">{booking.category}</span> · Priority: <span className="capitalize">{booking.priority}</span></p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Assign to</label>
              {loadingAgents ? (
                <p className="text-xs text-gray-400 py-2">Loading users...</p>
              ) : agents.length === 0 ? (
                <p className="text-xs text-red-400 py-2">No users found.</p>
              ) : (
                <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer">
                  <option value="" disabled>Select a user..</option>
                  {agents.map((a) => (<option key={a._id} value={a._id}>{a.name}</option>))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as Status)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer">
                {STATUS_OPTIONS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            </div>
            <button disabled={!selectedAgent} onClick={() => setStep("confirm")}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${selectedAgent ? "bg-green-500 hover:bg-green-600 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
              Continue
            </button>
          </div>
        )}

        {step === "confirm" && agent && (
          <div className="px-5 py-4 space-y-4">
            <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Booking</span><span className="font-semibold">#{ticketLabel}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Assign to</span><span className="font-semibold">{agent.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-semibold capitalize">{selectedStatus}</span></div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              This booking will be assigned to <strong className="text-gray-700">{agent.name}</strong>. They will be notified immediately.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStep("select")} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Back</button>
              <button onClick={handleAssign} disabled={assigning}
                className="flex-[2] py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                {assigning && (<svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>)}
                {assigning ? "Assigning…" : "Assign Booking"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && agent && (
          <div className="px-5 py-8 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div>
              <p className="font-bold text-gray-800">Booking Assigned!</p>
              <p className="text-xs text-gray-400 mt-1">#{ticketLabel} has been assigned to <strong className="text-gray-600">{agent.name}</strong>.</p>
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
type TabFilter = "all" | Status;

export default function SupportBookings() {
  const [bookings, setBookings] = useState<SupportBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedBooking, setSelectedBooking] = useState<SupportBooking | null>(null);

  useEffect(() => {
    getAllSupportBookings()
      .then((res) => {
        if (res.data.success) setBookings(res.data.data);
        else setError(res.data.message || "Failed to load bookings");
      })
      .catch((err: any) => setError(err?.response?.data?.message || "Server error. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const handleAssigned = (bookingId: string, agentName: string, newStatus: Status) => {
    setBookings((prev) =>
      prev.map((b) =>
        b._id === bookingId
          ? { ...b, status: newStatus, assigned_user_id: { _id: "", name: agentName } }
          : b
      )
    );
  };

  // ── Counts ──────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all: bookings.length,
    open: bookings.filter((b) => b.status === "open").length,
    "in-progress": bookings.filter((b) => b.status === "in-progress").length,
    resolved: bookings.filter((b) => b.status === "resolved").length,
    closed: bookings.filter((b) => b.status === "closed").length,
    high: bookings.filter((b) => b.priority === "high").length,
  }), [bookings]);

  // ── Filtered list ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = bookings;
    if (activeTab !== "all") list = list.filter((b) => b.status === activeTab);
    if (typeFilter !== "all") list = list.filter((b) => (b.supportType || b.category) === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.user?.name?.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q) ||
          b.supportType?.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q) ||
          String(b.ticketNumber).includes(q) ||
          b.ticket_no?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, bookings, activeTab, typeFilter]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const TABS: { label: string; value: TabFilter }[] = [
    { label: `All (${counts.all})`, value: "all" },
    { label: `Open (${counts.open})`, value: "open" },
    { label: `In Progress (${counts["in-progress"]})`, value: "in-progress" },
    { label: `Resolved (${counts.resolved})`, value: "resolved" },
    { label: `Closed (${counts.closed})`, value: "closed" },
  ];

  const columns = ["S.No", "User", "Reason", "Status", "Assigned To", "Action"];

  const AssignBtn = ({ booking }: { booking: SupportBooking }) => (
    <button
      onClick={() => setSelectedBooking(booking)}
      className="text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5 whitespace-nowrap"
    >
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      {booking.assigned_user_id ? "Reassign" : "Assign"}
    </button>
  );

  if (loading) return <p className="p-6 text-sm text-gray-400">Loading bookings...</p>;
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;

  return (
    <>
      {selectedBooking && (
        <AssignWizard
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onAssigned={handleAssigned}
        />
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Support Bookings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track all Support booking.</p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="flex flex-wrap gap-3 mb-5">
          <StatCard label="Open Requests" value={counts.open} color="text-yellow-500" />
          <StatCard label="In Progress" value={counts["in-progress"]} color="text-blue-500" />
          <StatCard label="Resolved" value={counts.resolved} color="text-green-500" />
          <StatCard label="Closed" value={counts.closed} color="text-gray-500" />
        </div>

        {/* ── Status Tabs ── */}
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); setPage(0); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${activeTab === tab.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Search + Type Filter ── */}
        <div className="flex flex-col sm:flex-row gap-3 p-3 sm:p-5 bg-white border border-gray-700 border-b-0 rounded-t-2xl">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path d="m21 21-4.35-4.35" strokeWidth="2" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, description, ticket no..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-100 border border-gray-700 text-md text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* ── Mobile Cards ── */}
        <div className="sm:hidden bg-white border border-gray-700 border-t-0 rounded-b-2xl divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No bookings found.</div>
          ) : (
            <>
              {paginated.map((b) => (
                <div key={b._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        #{b.ticket_no || b.ticketNumber}
                      </p>
                      <p className="font-semibold text-gray-800 text-sm truncate">{b.user?.name || "Unknown"}</p>
                      <p className="text-xs text-gray-400 truncate">{b.user?.email || ""}</p>
                    </div>
                    <AssignBtn booking={b} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <p className="text-gray-400">Subject</p>
                      <p className="font-medium text-gray-700 truncate">{b.description || "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Status</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-400">Assigned To</p>
                      <p className="font-medium text-gray-700">{b.assigned_user_id?.name || "—"}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length > rowsPerPage && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                  <span>{page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, filtered.length)} of {filtered.length}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">‹ Prev</button>
                    <button disabled={(page + 1) * rowsPerPage >= filtered.length} onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">Next ›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Desktop MUI Table ── */}
        <Paper elevation={0} className="hidden sm:block" sx={{ width: "100%", overflow: "hidden", borderRadius: "0 0 16px 16px", border: "1px solid #374151", borderTop: "none" }}>
          <TableContainer sx={{ maxHeight: 560 }}>
            <Table stickyHeader aria-label="support bookings table">
              <TableHead>
                <TableRow>
                  {columns.map((h) => (
                    <TableCell key={h} sx={{ backgroundColor: "#ffffff", fontWeight: 600, fontSize: "0.875rem", color: "#6b7280", borderBottom: "1px solid #374151", py: 1.75, px: 2.5, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 8, border: "none", fontFamily: "inherit" }}>
                      <p className="text-gray-400 text-sm">No bookings found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((b) => (
                    <TableRow key={b._id} hover sx={{ "&:hover": { backgroundColor: "rgba(249,250,251,0.8)" }, "& td": { borderBottom: "1px solid #374151", py: 1.5, px: 2.5, fontFamily: "inherit" } }}>
                      <TableCell>
                        <span className="text-sm font-semibold text-gray-500">#{b.ticket_no || b.ticketNumber}</span>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-gray-800 text-sm leading-tight">{b.user?.name || "Unknown"}</p>
                        <p className="text-xs text-gray-400 leading-tight">{b.user?.email || ""}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-700">{b.description || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell>
                        {b.assigned_user_id?.name
                          ? <span className="text-sm text-gray-700">{b.assigned_user_id.name}</span>
                          : <span className="text-sm text-gray-400">Unassigned</span>}
                      </TableCell>
                      <TableCell>
                        <AssignBtn booking={b} />
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
            onRowsPerPageChange={(e: React.ChangeEvent<HTMLInputElement>) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            sx={{
              borderTop: "1px solid #374151",
              fontSize: "0.875rem",
              color: "#64748b",
              fontFamily: "inherit",
              "& .MuiTablePagination-select": { fontSize: "0.875rem", fontFamily: "inherit" },
              "& .MuiTablePagination-displayedRows": { fontSize: "0.875rem", fontFamily: "inherit" },
              "& .MuiTablePagination-selectLabel": { fontSize: "0.875rem", fontFamily: "inherit" },
              "& .MuiIconButton-root": { color: "#64748b", "&:hover": { backgroundColor: "#f8fafc" }, "&.Mui-disabled": { opacity: 0.4 } },
            }}
          />
        </Paper>
      </div>
    </>
  );
}