import { useEffect, useRef, useState } from "react";

type Tab = "my-tickets" | "book-support" | "new-request";
type Priority = "low" | "medium" | "high";
type Status = "in progress" | "open" | "resolved" | "closed";

const token = localStorage.getItem("token");

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

const statusStyles: Record<Status, string> = {
  "in progress": "bg-blue-50 text-blue-600 border border-blue-200",
  open: "bg-green-50 text-green-600 border border-green-200",
  resolved: "bg-gray-100 text-gray-500 border border-gray-200",
  closed: "bg-red-50 text-red-500 border border-red-200",
};

const STATUS_OPTIONS: { label: string; value: Status }[] = [
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const priorityStyles: Record<Priority, string> = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-yellow-50 text-yellow-600",
  high: "bg-red-50 text-red-500",
};

// ── India Public Holidays 2026 ─────────────────────────────────────────────
const INDIA_HOLIDAYS = new Set([
  "2026-01-01", // New Year's Day
  "2026-01-14", // Makar Sankranti / Pongal
  "2026-01-26", // Republic Day
  "2026-03-03", // Holi
  "2026-04-02", // Ram Navami
  "2026-04-03", // Good Friday
  "2026-04-14", // Dr. Ambedkar Jayanti / Tamil New Year
  "2026-05-01", // Labour Day / Maharashtra Day
  "2026-05-31", // Buddha Purnima
  "2026-06-27", // Eid ul-Adha (approx)
  "2026-07-17", // Muharram (approx)
  "2026-08-15", // Independence Day
  "2026-08-25", // Janmashtami (approx)
  "2026-09-25", // Dussehra (approx)
  "2026-10-02", // Gandhi Jayanti
  "2026-10-20", // Diwali / Naraka Chaturdashi (approx)
  "2026-10-21", // Diwali - Lakshmi Puja (approx)
  "2026-10-22", // Diwali - Bhai Dooj (approx)
  "2026-11-04", // Guru Nanak Jayanti (approx)
  "2026-12-25", // Christmas
]);

function isDisabledDate(dateStr: string): boolean {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay();
  if (day === 0 || day === 6) return true;
  if (INDIA_HOLIDAYS.has(dateStr)) return true;
  return false;
}

// ── Custom Date Picker ─────────────────────────────────────────────────────
function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(4);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = new Date(viewYear, viewMonth).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const toStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const handleDay = (d: number) => {
    const str = toStr(viewYear, viewMonth, d);
    const dateObj = new Date(str + "T00:00:00");
    if (dateObj < today || isDisabledDate(str)) return;
    onChange(str);
    setOpen(false);
  };

  const prevMonth = () =>
    viewMonth === 0
      ? (setViewMonth(11), setViewYear((y) => y - 1))
      : setViewMonth((m) => m - 1);
  const nextMonth = () =>
    viewMonth === 11
      ? (setViewMonth(0), setViewYear((y) => y + 1))
      : setViewMonth((m) => m + 1);

  const displayValue = value
    ? (() => {
        const d = new Date(value + "T00:00:00");
        return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
      })()
    : "Select date";

  const todayStr = toStr(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 pl-9 pr-3 py-2 rounded-lg bg-gray-100 border border-transparent text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 text-left relative"
      >
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" />
        </svg>
        <span className={value ? "text-gray-800" : "text-gray-400"}>
          {displayValue}
        </span>
        <svg
          className={`ml-auto w-3 h-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className={`absolute z-50 mt-1 transition-all duration-200 origin-top ${open ? "opacity-100 scale-y-100" : "opacity-0 scale-y-95 pointer-events-none"}`}
      >
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-60">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={prevMonth}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
            >
              <svg
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-xs font-semibold text-gray-800">
              {monthName}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
            >
              <svg
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
              <div
                key={d}
                className={`text-center text-[9px] font-semibold py-0.5 ${i === 0 || i === 6 ? "text-red-400" : "text-gray-400"}`}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const str = toStr(viewYear, viewMonth, d);
              const dateObj = new Date(str + "T00:00:00");
              const isPast = dateObj < today;
              const isHoliday = INDIA_HOLIDAYS.has(str);
              const dayOfWeek = dateObj.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isDisabled = isPast || isHoliday || isWeekend;
              const isSelected = str === value;
              const isToday = str === todayStr;

              return (
                <button
                  key={d}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDay(d)}
                  title={
                    isHoliday
                      ? "Public Holiday"
                      : isWeekend
                        ? "Weekend"
                        : undefined
                  }
                  className={`w-7 h-7 mx-auto rounded-md text-[11px] font-medium transition-colors
                    ${isSelected ? "bg-green-500 text-white" : ""}
                    ${!isDisabled && !isSelected ? "hover:bg-green-50 text-gray-700" : ""}
                    ${isDisabled && !isSelected ? "text-gray-300 cursor-not-allowed" : ""}
                    ${isToday && !isSelected ? "ring-1 ring-green-400 ring-offset-1" : ""}
                    ${isHoliday && !isSelected ? "line-through text-red-300" : ""}
                    ${isWeekend && !isSelected && !isHoliday ? "text-red-300" : ""}
                  `}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-gray-100 flex gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-300 inline-block" />
              Holiday/Weekend
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Selected
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Assign Ticket Wizard Modal ─────────────────────────────────────────────
function AssignWizard({
  ticket,
  onClose,
  onAssigned,
}: {
  ticket: any;
  onClose: () => void;
  onAssigned: (ticketId: string, agentId: string) => void;
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
        const res = await fetch("http://localhost:5000/api/v1/users/userRole", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setAgents(data.data);
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
    if (!selectedAgent) return;
    setAssigning(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/support-booking/assign/${ticket._id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ assigned_user_id: selectedAgent, status: selectedStatus || undefined }),
        },
      );
      const data = await res.json();
      if (!data.success) {
        alert("Assignment failed");
        return;
      }
      setStep("done");
      onAssigned(ticket._id, selectedAgent);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch {
      alert("Server error");
    } finally {
      setAssigning(false);
    }
  };

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
                #{ticket.ticket_no}
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

        {/* Step: Select Agent */}
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
              disabled={!selectedAgent}
              onClick={() => setStep("confirm")}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedAgent
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && agent && (
          <div className="px-5 py-4 space-y-4">
            <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Ticket</span>
                <span className="font-semibold">#{ticket.ticket_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Assign to</span>
                <span className="font-semibold">{agent.name}</span>
              </div>
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

        {/* Step: Done */}
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
                #{ticket.ticket_no} has been assigned to{" "}
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

// ── Tab: My Tickets ────────────────────────────────────────────────────────
function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignTicket, setAssignTicket] = useState<any | null>(null);

  const userRole = getRoleFromToken();
  const isAdmin = userRole === "admin";

  useEffect(() => {
    const container =
      document.querySelector("main") ||
      document.querySelector("[class*='overflow-y']") ||
      document.documentElement;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5000/api/support-booking/", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.message || "Failed to load tickets");
          return;
        }
        setTickets(data.data);
      } catch {
        setError("Server error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const handleAssigned = (ticketId: string, agentId: string) => {
    console.log(`Ticket ${ticketId} assigned to agent ${agentId}`);
  };

  if (loading)
    return <p className="text-sm text-gray-400">Loading tickets...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (tickets.length === 0)
    return <p className="text-sm text-gray-400">No tickets found.</p>;

  return (
    <>
      {assignTicket && (
        <AssignWizard
          ticket={assignTicket}
          onClose={() => setAssignTicket(null)}
          onAssigned={handleAssigned}
        />
      )}
      <div>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-800">
            Support Tickets
          </h2>
          <p className="text-sm text-gray-500">
            Track your support requests and resolutions
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {tickets.map((ticket: any) => (
            <div
              key={ticket._id}
              className="border border-gray-200 rounded-xl p-4 bg-white flex items-start justify-between gap-4"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-800 text-sm">
                    {ticket.description || "No description"}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      statusStyles[ticket.status as Status] || ""
                    }`}
                  >
                    {ticket.status}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      priorityStyles[ticket.priority as Priority] || ""
                    }`}
                  >
                    {ticket.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Ticket #{ticket.ticket_no} &nbsp;·&nbsp; Created:{" "}
                  {new Date(ticket.createdAt).toLocaleDateString()}{" "}
                  &nbsp;·&nbsp; Category: {ticket.category}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 whitespace-nowrap">
                  View Details
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setAssignTicket(ticket)}
                    className="text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap flex items-center gap-1.5"
                  >
                    <svg
                      width="13"
                      height="13"
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
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Tab: Book Support ──────────────────────────────────────────────────────
function BookSupport() {
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!date || !duration || !reason) return;
    if (reason.length > 2000) {
      alert("Description exceeds 2000 characters");
      return;
    }
    try {
      setSubmitted(false);
      const res = await fetch("http://localhost:5000/api/support-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          duration: Number(duration),
          category: "general",
          priority: "medium",
          description: reason,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Something went wrong");
        return;
      }
      setSubmitted(true);
      setDate("");
      setDuration("");
      setReason("");
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      alert("Server error");
    }
  };

  const isValid = date && duration && reason && reason.length <= 2000;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-800">
          Book One-on-One Support
        </h2>
        <p className="text-sm text-gray-500">
          Schedule a support session with our experts
        </p>
      </div>
      {submitted && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
          ✓ Session booked successfully! You'll receive a confirmation shortly.
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Select Date
          </label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
          >
            <option value="" disabled>
              Select duration
            </option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Reason for Support
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Brief description of what you need help with..."
            rows={4}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path d="M12 8v4l3 3" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Book Session
        </button>
      </div>
    </div>
  );
}

// ── Tab: New Request ───────────────────────────────────────────────────────
function NewRequest() {
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const token = localStorage.getItem("token");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFiles(Array.from(e.dataTransfer.files));
  };

  const handleSubmit = async () => {
    if (!subject || !priority || !category || !description) {
      alert("All fields are required");
      return;
    }
    if (description.length > 2000) {
      alert("Description exceeds 2000 characters");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/support-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject,
          description,
          priority,
          category,
          attachments: [],
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Something went wrong");
        return;
      }
      setSubmitted(true);
      setSubject("");
      setPriority("");
      setCategory("");
      setDescription("");
      setFiles([]);
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      alert("Server error");
    }
  };

  const isValid =
    subject &&
    priority &&
    category &&
    description &&
    description.length <= 2000;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-800">
          Submit Help Request
        </h2>
        <p className="text-sm text-gray-500">Create a new support ticket</p>
      </div>
      {submitted && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
          ✓ Request submitted successfully! Ticket created.
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of your issue"
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none"
          >
            <option value="" disabled>
              Select priority
            </option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none"
          >
            <option value="" disabled>
              Select category
            </option>
            <option value="technical">Technical</option>
            <option value="billing">Billing</option>
            <option value="antivirus">Antivirus</option>
            <option value="rmm">RMM</option>
            <option value="general">General</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description..."
            rows={4}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Attachments
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-green-400"
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            {files.length > 0 ? (
              <p className="text-sm text-gray-600">
                {files.map((f) => f.name).join(", ")}
              </p>
            ) : (
              <p className="text-sm text-gray-400">
                Drag & drop or browse files
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl disabled:opacity-50"
        >
          Submit Request
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Support() {
  const [activeTab, setActiveTab] = useState<Tab>("my-tickets");

  const tabs: { id: Tab; label: string }[] = [
    { id: "my-tickets", label: "My Tickets" },
    { id: "book-support", label: "Book Support" },
    { id: "new-request", label: "New Request" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Support Services</h1>
          <p className="text-gray-500 mt-1">
            Get help from our expert support team
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          {activeTab === "my-tickets" && <MyTickets />}
          {activeTab === "book-support" && <BookSupport />}
          {activeTab === "new-request" && <NewRequest />}
        </div>
      </div>
    </div>
  );
}
