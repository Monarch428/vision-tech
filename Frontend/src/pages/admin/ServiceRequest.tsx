import { useState, useMemo, useEffect } from "react";
import {
  getAllServiceRequests,
  getSupportAgents,
  assignTicket as assignTicketService,
} from "../../services/admin/serviceRequest.service";

type Priority = "high" | "medium" | "low";
type Status = "in-progress" | "open" | "resolved" | "closed";
type TabFilter = "all" | Status;

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
}

const statusStyles: Record<Status, string> = {
  "in-progress": "bg-blue-50 text-blue-700 border border-blue-200",
  open: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  resolved: "bg-green-50 text-green-700 border border-green-200",
  closed: "bg-gray-100 text-gray-500 border border-gray-200",
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

// ── Decode role from JWT ──────────────────────────────────────────────────
function getRoleFromToken(): string {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || "";
  } catch {
    return "";
  }
}

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
  onAssigned: (ticketId: string, agentId: string, newStatus: Status) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Status | "">(
    ticket?.status || "",
  );
  const [step, setStep] = useState<"select" | "confirm" | "done">("select");
  const [assigning, setAssigning] = useState(false);
  const [agents, setAgents] = useState<{ _id: string; name: string }[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await getSupportAgents();
        if (res.data.success) setAgents(res.data.data);
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
      onAssigned(ticket._id, selectedAgent, selectedStatus as Status);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Server error");
    } finally {
      setAssigning(false);
    }
  };

  const ticketLabel = ticket.ticket_no || ticket.ticketNumber;

  const STATUS_OPTIONS: { label: string; value: Status }[] = [
    { label: "Open", value: "open" },
    { label: "In Progress", value: "in-progress" },
    { label: "Resolved", value: "resolved" },
    { label: "Closed", value: "closed" },
  ];

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
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">
                Assign Ticket
              </p>
              <p className="text-xs text-gray-400 leading-tight">
                #{ticketLabel}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
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
                Category: <span className="capitalize">{ticket.category}</span>{" "}
                · Priority:{" "}
                <span className="capitalize">{ticket.priority}</span>
              </p>
            </div>

            {/* Agent select */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Assign to user
              </label>
              {loadingAgents ? (
                <p className="text-xs text-gray-400 py-2">Loading agents...</p>
              ) : (
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
                >
                  <option value="" disabled>
                    Select a user..
                  </option>
                  {agents.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Status select */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as Status)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
              >
                <option value="" disabled>
                  Select a status..
                </option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
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
                  <span className="font-semibold capitalize">
                    {selectedStatus}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              This ticket will be assigned to{" "}
              <strong className="text-gray-700">{agent.name}</strong>. They will
              be notified immediately.
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
                  <svg
                    className="animate-spin w-4 h-4"
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
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
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
              <svg
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
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
  const [selectedTicket, setSelectedTicket] = useState<ServiceRequest | null>(
    null,
  );

  const isAdmin = getRoleFromToken() === "admin";

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await getAllServiceRequests();
      if (!res.data.success) {
        setError(res.data.message || "Failed to load");
        return;
      }
      setRequests(res.data.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Server error. Please try again.",
      );
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

  const tabLabel = (tab: { label: string; value: TabFilter }) => {
    if (tab.value === "all") return `All (${requests.length})`;
    return `${tab.label} (${tabCounts[tab.value as Status] ?? 0})`;
  };

  const handleAssigned = (
    ticketId: string,
    _agentId: string,
    newStatus: Status,
  ) => {
    setRequests((prev) =>
      prev.map((r) => (r._id === ticketId ? { ...r, status: newStatus } : r)),
    );
  };

  if (loading)
    return <p className="p-6 text-sm text-gray-400">Loading requests...</p>;
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

      <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Service Requests
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage and track all service requests
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
            {[
              {
                label: "Open Requests",
                value: counts.open,
                color: "text-yellow-600",
              },
              {
                label: "In Progress",
                value: counts.inProgress,
                color: "text-blue-600",
              },
              {
                label: "Resolved",
                value: counts.resolved,
                color: "text-green-600",
              },
              {
                label: "Closed",
                value: counts.closed,
                color: "text-gray-500",
              },
              {
                label: "High Priority",
                value: counts.high,
                color: "text-red-600",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-gray-200 rounded-2xl p-4"
              >
                <p className="text-xs sm:text-sm text-gray-500 mb-2">
                  {stat.label}
                </p>
                <p
                  className={`text-2xl sm:text-3xl font-semibold ${stat.color}`}
                >
                  {stat.value}
                </p>
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

          {/* Table Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-100 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full sm:w-40 px-3 py-2 rounded-xl bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none cursor-pointer"
              >
                {CATEGORIES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {[
                      "Request ID",
                      "User",
                      "Subject",
                      "Type",
                      "Priority",
                      "Status",
                      ...(isAdmin ? ["Action"] : []),
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-gray-500 pb-3 pr-4"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? 7 : 6}
                        className="text-center text-sm text-gray-400 py-8"
                      >
                        No results found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((req) => (
                      <tr
                        key={req._id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 pr-4 text-sm font-semibold text-gray-800">
                          #{req.ticketNumber}
                        </td>
                        <td className="py-3 pr-4 text-md font-bold text-gray-700">
                          {req.user?.name || "Unknown"}
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-700 max-w-[200px] truncate">
                          {req.description}
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-600 capitalize">
                          {req.category}
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-600">
                          {req.priority}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${statusStyles[req.status]}`}
                          >
                            {req.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3">
                            <button
                              onClick={() => setSelectedTicket(req)}
                              className="text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <svg
                                width="12"
                                height="12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                              Assign
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}