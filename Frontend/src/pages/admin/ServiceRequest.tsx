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
  getAllServiceRequests,
  getAgentsForBooking,
  assignTicket as assignTicketService,
} from "../../services/admin/serviceRequest.service";

type Priority = "high" | "medium" | "low";
type Status = "in-progress" | "open" | "resolved" | "closed";
type TabFilter = "all" | Status;

interface Agent {
  _id: string;
  name: string;
  email?: string;
}

interface ServiceRequest {
  _id: string;
  ticketNumber: number;
  ticket_no?: string;
  user: { name: string; email: string } | null;
  description: string;
  category: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  assigned_user_id?: { _id: string; name: string } | null;
}

const statusStyles: Record<Status, string> = {
  "in-progress": "bg-blue-50 text-blue-700 border border-blue-200",
  open: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  resolved: "bg-green-50 text-green-700 border border-green-200",
  closed: "bg-gray-100 text-gray-500 border border-gray-200",
};

const priorityStyles: Record<Priority, string> = {
  high: "bg-red-50 text-red-600 border border-red-200",
  medium: "bg-orange-50 text-orange-600 border border-orange-200",
  low: "bg-gray-50 text-gray-500 border border-gray-200",
};

const TABS: { label: string; value: TabFilter }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in-progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const CATEGORIES = [
  "All Types",
  "general",
  "technical",
  "billing",
  "antivirus",
  "rmm",
];

const STATUS_OPTIONS: { label: string; value: Status }[] = [
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in-progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

function getEmailFromToken(): string {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.email || "";
  } catch {
    return "";
  }
}

// ── Assign Ticket Wizard Modal ────────────────────────────────────────────
function AssignWizard({
  ticket,
  onClose,
  onAssigned,
}: {
  ticket: ServiceRequest;
  onClose: () => void;
  onAssigned: (ticketId: string, agentId: string, agentName: string, newStatus: Status) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState(ticket.assigned_user_id?._id || "");
  const [selectedStatus, setSelectedStatus] = useState<Status | "">(
    ticket?.status || "",
  );
  const [step, setStep] = useState<"select" | "confirm" | "done">("select");
  const [assigning, setAssigning] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await getAgentsForBooking();
        // handle both { data: [...] } and { data: { data: [...] } } shapes
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
        setAgents(list);
      } catch {
        console.error("Failed to fetch agents");
      } finally {
        setLoadingAgents(false);
      }
    };
    fetchAgents();
  }, []);

  const agent = agents.find((a) => a._id === selectedAgent);

  const handleAssign = async () => {
    if (!selectedAgent || !selectedStatus) return;
    setAssigning(true);
    try {
      const userEmail = getEmailFromToken();
      const res = await assignTicketService(ticket._id, {
        assigned_user_id: selectedAgent,
        status: selectedStatus,
        assigned_by: userEmail,
      });
      if (!res.data.success) {
        alert("Assignment failed");
        return;
      }
      setStep("done");
      onAssigned(ticket._id, selectedAgent, agent?.name || "", selectedStatus as Status);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Server error");
    } finally {
      setAssigning(false);
    }
  };

  const ticketLabel = ticket.ticket_no || ticket.ticketNumber;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-50 text-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">
                {ticket.assigned_user_id ? "Reassign Ticket" : "Assign Ticket"}
              </p>
              <p className="text-xs text-gray-400 leading-tight">#{ticketLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Select step */}
        {step === "select" && (
          <div className="px-5 py-4 space-y-4">
            <div className="bg-gray-50 rounded-xl px-3.5 py-3 text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700 text-sm truncate">
                {ticket.description || "No description"}
              </p>
              <p>
                Category: <span className="capitalize">{ticket.category}</span> · Priority:{" "}
                <span className="capitalize">{ticket.priority}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Assign to user</label>
              {loadingAgents ? (
                <p className="text-xs text-gray-400 py-2">Loading agents...</p>
              ) : agents.length === 0 ? (
                <p className="text-xs text-red-400 py-2">No users found.</p>
              ) : (
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select a user..</option>
                  {agents.map((a) => (
                    <option key={a._id} value={a._id}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as Status)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
              >
                <option value="" disabled>Select a status..</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <button
              disabled={!selectedAgent || !selectedStatus}
              onClick={() => setStep("confirm")}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedAgent && selectedStatus
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Continue
            </button>
          </div>
        )}

        {/* Confirm step */}
        {step === "confirm" && agent && (
          <div className="px-5 py-4 space-y-4">
            <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Ticket</span>
                <span className="font-semibold">#{ticketLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Assign to</span>
                <span className="font-semibold">{agent.name}</span>
              </div>
              {selectedStatus && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="font-semibold capitalize">{selectedStatus}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              This ticket will be assigned to{" "}
              <strong className="text-gray-700">{agent.name}</strong>. They will be notified immediately.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("select")}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="flex-[2] py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {assigning && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {assigning ? "Assigning…" : "Assign Ticket"}
              </button>
            </div>
          </div>
        )}

        {/* Done step */}
        {step === "done" && agent && (
          <div className="px-5 py-8 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-800">Ticket Assigned!</p>
              <p className="text-xs text-gray-400 mt-1">
                #{ticketLabel} has been assigned to{" "}
                <strong className="text-gray-600">{agent.name}</strong>.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function ServiceRequests() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [selectedTicket, setSelectedTicket] = useState<ServiceRequest | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, typeFilter, activeTab]);

  const fetchRequests = async () => {
    try {
      const res = await getAllServiceRequests();
      if (!res.data.success) {
        setError(res.data.message || "Failed to load");
        return;
      }
      setRequests(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(
    () => ({
      open: requests.filter((r) => r.status === "open").length,
      inProgress: requests.filter((r) => r.status === "in-progress").length,
      resolved: requests.filter((r) => r.status === "resolved").length,
      closed: requests.filter((r) => r.status === "closed").length,
      high: requests.filter((r) => r.priority === "high").length,
    }),
    [requests],
  );

  const tabCounts = useMemo(
    () => ({
      open: requests.filter((r) => r.status === "open").length,
      "in-progress": requests.filter((r) => r.status === "in-progress").length,
      resolved: requests.filter((r) => r.status === "resolved").length,
      closed: requests.filter((r) => r.status === "closed").length,
    }),
    [requests],
  );

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const tabMatch = activeTab === "all" || r.status === activeTab;
      const searchMatch =
        !search ||
        r.description?.toLowerCase().includes(search.toLowerCase()) ||
        r.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        String(r.ticketNumber).includes(search);
      const typeMatch = typeFilter === "All Types" || r.category === typeFilter;
      return tabMatch && searchMatch && typeMatch;
    });
  }, [activeTab, search, typeFilter, requests]);

  const paginatedFiltered = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const tabLabel = (tab: { label: string; value: TabFilter }) => {
    if (tab.value === "all") return `All (${requests.length})`;
    return `${tab.label} (${tabCounts[tab.value as Status] ?? 0})`;
  };

  const handleAssigned = (
    ticketId: string,
    agentId: string,
    agentName: string,
    newStatus: Status,
  ) => {
    setRequests((prev) =>
      prev.map((r) =>
        r._id === ticketId
          ? { ...r, status: newStatus, assigned_user_id: { _id: agentId, name: agentName } }
          : r,
      ),
    );
  };

  const columns = [
    "Req ID",
    "User",
    "Request",
    "Type",
    "Priority",
    "Status",
    "Assigned To",
    "Action",
  ];

  const AssignBtn = ({ req }: { req: ServiceRequest }) => (
    <button
      onClick={() => setSelectedTicket(req)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors whitespace-nowrap"
    >
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      {req.assigned_user_id ? "Reassign" : "Assign"}
    </button>
  );

  if (loading) return <p className="p-6 text-sm text-gray-400">Loading requests...</p>;
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;

  return (
    <>
      {selectedTicket && (
        <AssignWizard
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onAssigned={handleAssigned}
        />
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
            Service Requests
          </h1>
          <p className="text-md text-gray-700 mt-1">
            Manage and track all service requests
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
          {[
            { label: "Open Requests", value: counts.open, color: "text-yellow-600" },
            { label: "In Progress", value: counts.inProgress, color: "text-blue-600" },
            { label: "Resolved", value: counts.resolved, color: "text-green-600" },
            { label: "Closed", value: counts.closed, color: "text-gray-500" },
            { label: "High Priority", value: counts.high, color: "text-red-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-700 rounded-2xl p-4">
              <p className="text-xs sm:text-sm text-gray-500 mb-2">{stat.label}</p>
              <p className={`text-2xl sm:text-3xl font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="overflow-x-auto scrollbar-none mb-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-full w-max min-w-full sm:w-fit sm:min-w-0">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 p-3 sm:p-5 bg-white border border-gray-700 border-b-0 rounded-t-2xl">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path d="m21 21-4.35-4.35" strokeWidth="2" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, description, ticket no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-100 border border-gray-700 text-sm text-gray-700 placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-40 px-3 py-2 rounded-xl bg-gray-100 border border-gray-700 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none cursor-pointer"
          >
            {CATEGORIES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* ── Mobile Cards (below sm) ── */}
        <div className="sm:hidden bg-white border border-gray-700 border-t-0 rounded-b-2xl divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No results found.
            </div>
          ) : (
            <>
              {paginatedFiltered.map((req) => (
                <div key={req._id} className="p-4 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        #{req.ticketNumber}
                      </p>
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {req.user?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {req.user?.email || ""}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center flex-shrink-0 ${statusStyles[req.status]}`}
                    >
                      {req.status}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {req.description}
                  </p>

                  {/* Detail grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <p className="text-gray-400">Category</p>
                      <p className="font-medium text-gray-700 capitalize">{req.category}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Priority</p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${priorityStyles[req.priority]}`}
                      >
                        {req.priority}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-400">Assigned To</p>
                      <p className="font-medium text-gray-700">
                        {req.assigned_user_id?.name || (
                          <span className="text-gray-400 font-normal">Unassigned</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Assign button */}
                  <AssignBtn req={req} />
                </div>
              ))}

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
            borderRadius: "0 0 16px 16px",
            border: "1px solid #374151",
            borderTop: "none",
          }}
        >
          <TableContainer sx={{ maxHeight: 560 }}>
            <Table stickyHeader aria-label="service requests table">
              <TableHead>
                <TableRow>
                  {columns.map((h) => (
                    <TableCell
                      key={h}
                      sx={{
                        backgroundColor: "#ffffff",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: "#6b7280",
                        borderBottom: "1px solid #374151",
                        py: 1.75,
                        px: 2.5,
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      align="center"
                      sx={{ py: 8, border: "none", fontFamily: "inherit" }}
                    >
                      <p className="text-gray-400 text-sm">No results found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedFiltered.map((req) => (
                    <TableRow
                      key={req._id}
                      hover
                      sx={{
                        "&:hover": { backgroundColor: "rgba(249,250,251,0.8)" },
                        "& td": {
                          borderBottom: "1px solid #374151",
                          py: 1.5,
                          px: 2.5,
                          fontFamily: "inherit",
                        },
                      }}
                    >
                      <TableCell>
                        <span className="font-semibold text-gray-800 text-sm">
                          #{req.ticketNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-gray-700 text-sm">
                          {req.user?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {req.user?.email || ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-700 block max-w-[200px] truncate">
                          {req.description}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600 capitalize">
                          {req.category}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${priorityStyles[req.priority]}`}
                        >
                          {req.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${statusStyles[req.status]}`}
                        >
                          {req.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {req.assigned_user_id?.name ? (
                          <span className="text-sm text-gray-700">{req.assigned_user_id.name}</span>
                        ) : (
                          <span className="text-sm text-gray-400">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <AssignBtn req={req} />
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
              color: "#64748b",
              fontFamily: "inherit",
              "& .MuiTablePagination-select": { fontSize: "0.875rem", fontFamily: "inherit" },
              "& .MuiTablePagination-displayedRows": { fontSize: "0.875rem", fontFamily: "inherit" },
              "& .MuiTablePagination-selectLabel": { fontSize: "0.875rem", fontFamily: "inherit" },
              "& .MuiIconButton-root": {
                color: "#64748b",
                "&:hover": { backgroundColor: "#f8fafc" },
                "&.Mui-disabled": { opacity: 0.4 },
              },
            }}
          />
        </Paper>
      </div>
    </>
  );
}