import { useEffect, useRef, useState, type JSX } from "react";
import {
  getSupportTickets,
  createSupportRequest,
  type Ticket,
  type Priority,
  type Status,
} from "../../services/user/support.service";
import {
  getMySubscription,
  type SupportUsage,
} from "../../services/user/dashboard.service";

// Only two views now: the ticket list, and a single "Support Request" form
// (this form covers both filing a ticket and, optionally, scheduling a
// one-on-one session — those used to be two separate tabs/buttons).
type Tab = "my-tickets" | "support-request";

const statusStyles: Record<Status, string> = {
  "in-progress": "bg-blue-50 text-blue-600 border border-blue-200",
  open: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  resolved: "bg-green-50 text-green-600 border border-green-200",
  closed: "bg-gray-100 text-gray-500 border border-gray-200",
};

const priorityStyles: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 border border-gray-200",
  medium: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  high: "bg-red-50 text-red-600 border border-red-200",
};

const categoryIcons: Record<string, JSX.Element> = {
  technical: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  billing: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" strokeLinecap="round" />
    </svg>
  ),
  antivirus: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  rmm: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 16v5" strokeLinecap="round" />
    </svg>
  ),
  general: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// The ticket detail view is defensive about extra fields the API may or may
// not return (priority, category, attachments, activity log, etc.) since the
// shared Ticket type only guarantees the fields already used elsewhere.
interface TicketActivity {
  message?: string;
  note?: string;
  author?: string;
  by?: string;
  createdAt?: string;
  timestamp?: string;
  status?: string;
}

interface TicketDetail extends Omit<Ticket, "priority" | "category"> {
  priority?: string;
  category?: string;
  updatedAt?: string;
  resolvedAt?: string;
  assignedTo?: string;
  attachments?: (string | { name?: string; url?: string })[];
  updates?: TicketActivity[];
  comments?: TicketActivity[];
  history?: TicketActivity[];
}

const INDIA_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-14", "2026-01-26", "2026-03-03",
  "2026-04-02", "2026-04-03", "2026-04-14", "2026-05-01",
  "2026-05-31", "2026-06-27", "2026-07-17", "2026-08-15",
  "2026-08-25", "2026-09-25", "2026-10-02", "2026-10-20",
  "2026-10-21", "2026-10-22", "2026-11-04", "2026-12-25",
]);

function isDisabledDate(dateStr: string): boolean {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay();
  return day === 0 || day === 6 || INDIA_HOLIDAYS.has(dateStr);
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function DatePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(4);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = new Date(viewYear, viewMonth).toLocaleString("default", { month: "long", year: "numeric" });
  const toStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const handleDay = (d: number) => {
    const str = toStr(viewYear, viewMonth, d);
    const dateObj = new Date(str + "T00:00:00");
    if (dateObj < today || isDisabledDate(str)) return;
    onChange(str);
    setOpen(false);
  };

  const prevMonth = () => viewMonth === 0 ? (setViewMonth(11), setViewYear((y) => y - 1)) : setViewMonth((m) => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0), setViewYear((y) => y + 1)) : setViewMonth((m) => m + 1);

  const displayValue = value
    ? (() => { const d = new Date(value + "T00:00:00"); return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`; })()
    : "Select date";

  const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 pl-9 pr-3 py-2.5 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 text-left relative transition-shadow"
      >
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" />
        </svg>
        <span className={value ? "text-gray-800" : "text-gray-400"}>{displayValue}</span>
        <svg className={`ml-auto w-3 h-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className={`absolute z-50 mt-1 transition-all duration-200 origin-top ${open ? "opacity-100 scale-y-100" : "opacity-0 scale-y-95 pointer-events-none"}`}>
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64 sm:w-72">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-xs sm:text-sm font-semibold text-gray-800">{monthName}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
              <div key={d} className={`text-center text-[9px] sm:text-[10px] font-semibold py-0.5 ${i === 0 || i === 6 ? "text-red-400" : "text-gray-400"}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
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
                  title={isHoliday ? "Public Holiday" : isWeekend ? "Weekend" : undefined}
                  className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-md text-[11px] sm:text-xs font-medium transition-colors
                    ${isSelected ? "bg-green-500 text-white" : ""}
                    ${!isDisabled && !isSelected ? "hover:bg-green-50 text-gray-700" : ""}
                    ${isDisabled && !isSelected ? "text-gray-300 cursor-not-allowed" : ""}
                    ${isToday && !isSelected ? "ring-1 ring-green-400 ring-offset-1" : ""}
                    ${isHoliday && !isSelected ? "line-through text-red-300" : ""}
                    ${isWeekend && !isSelected && !isHoliday ? "text-red-300" : ""}
                  `}
                >{d}</button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-x-3 gap-y-1 text-[9px] sm:text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-300 inline-block" />Holiday/Weekend</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ticket detail modal ─────────────────────────────────────────────────────
// Shows everything we have on a ticket: status/priority/category, the
// original description, attachments if any, and an activity/history trail
// if the API returned one (under updates / comments / history — whichever
// is present). Header now shows the request's position in the list
// ("Request #N") instead of the raw ticket id.
function TicketDetailModal({
  ticket,
  requestNumber,
  onClose,
}: {
  ticket: TicketDetail;
  requestNumber: number;
  onClose: () => void;
}) {
  const activity: TicketActivity[] = ticket.updates || ticket.comments || ticket.history || [];

  const attachmentName = (a: string | { name?: string; url?: string }) =>
    typeof a === "string" ? a : a.name || a.url || "Attachment";
  const attachmentHref = (a: string | { name?: string; url?: string }) =>
    typeof a === "string" ? a : a.url || "#";

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg lg:max-w-xl flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-[fadeIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4 flex-shrink-0 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-600 tracking-wide uppercase">Request #{requestNumber}</p>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mt-1 truncate pr-4">
              {ticket.description || "No description"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <svg width="16" height="16" fill="none" stroke="#374151" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-4 space-y-5">
          {/* Status / priority / category */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${statusStyles[ticket.status as Status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
              {ticket.status}
            </span>
            {ticket.priority && (
              <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold capitalize ${priorityStyles[ticket.priority] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                {ticket.priority} priority
              </span>
            )}
            {ticket.category && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600 font-semibold capitalize">
                {categoryIcons[ticket.category] || categoryIcons.general}
                {ticket.category}
              </span>
            )}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Created</p>
              <p className="text-gray-800 font-semibold">{formatDateTime(ticket.createdAt as unknown as string)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Last updated</p>
              <p className="text-gray-800 font-semibold">{formatDateTime(ticket.updatedAt || (ticket.createdAt as unknown as string))}</p>
            </div>
            {ticket.resolvedAt && (
              <div>
                <p className="text-[11px] text-gray-400 font-medium">Resolved</p>
                <p className="text-gray-800 font-semibold">{formatDateTime(ticket.resolvedAt)}</p>
              </div>
            )}
            {ticket.assignedTo && (
              <div>
                <p className="text-[11px] text-gray-400 font-medium">Assigned to</p>
                <p className="text-gray-800 font-semibold">{ticket.assignedTo}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="text-[11px] text-gray-400 font-medium">Description</p>
              <p className="text-gray-800 font-semibold whitespace-pre-wrap break-words">{ticket.description || "No description provided."}</p>
            </div>
          </div>

          {/* Attachments */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Attachments</p>
              <div className="flex flex-col gap-1.5">
                {ticket.attachments.map((a, i) => (
                  <a
                    key={i}
                    href={attachmentHref(a)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline break-all"
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0">
                      <path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L10.13 17.1a2 2 0 0 1-2.83-2.83l8.49-8.49" />
                    </svg>
                    {attachmentName(a)}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Activity trail, if the API returned one */}
          {activity.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Activity</p>
              <div className="flex flex-col gap-3">
                {activity.map((a, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-gray-700">{a.message || a.note || a.status}</p>
                      <p className="text-[11px] text-gray-400">
                        {a.author || a.by ? `${a.author || a.by} · ` : ""}
                        {formatDateTime(a.createdAt || a.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MyTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    getSupportTickets()
      .then((data) => setTickets(data))
      .catch((err: any) => setError(err.response?.data?.message || "Failed to load tickets"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 sm:h-24 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-500">{error}</p>;

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-14 sm:py-20">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
          <svg width="20" height="20" fill="none" stroke="#22c55e" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 12h6M9 16h6M9 8h6M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600">No requests yet</p>
        <p className="text-sm text-gray-400 mt-0.5">Anything you submit will show up here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-md sm:text-lg font-semibold text-gray-800">Support Tickets</h2>
        <p className="text-sm sm:text-md text-gray-700">
          Track your support requests and resolutions 
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {tickets.map((ticket: any, index: number) => (
          <button
            key={ticket._id}
            onClick={() => setSelectedIndex(index)}
            className="text-left border border-gray-300 rounded-xl p-4 bg-white hover:border-green-300 hover:bg-green-50/30 transition-colors cursor-pointer"
          >
            {/* Mobile layout */}
            <div className="flex sm:hidden flex-col gap-1.5">
              <p className="font-semibold text-gray-800 text-md truncate">
                {ticket.description || "No description"}
              </p>
              <p className="text-xs sm:text-md text-gray-700">
                Request {index + 1} &nbsp;·&nbsp; Created: {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })}
              </p>
              <div className="flex gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyles[ticket.status as Status] || ""}`}>
                  {ticket.status}
                </span>
              </div>
            </div>
            {/* Larger-device layout — unchanged from the original design */}
            <div className="hidden sm:flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-800 text-lg">
                    {ticket.description || "No description"}
                  </span>
                  <span className={`text-md px-2 py-0.5 rounded-full border ${statusStyles[ticket.status as Status] || ""}`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="text-md text-gray-700">
                  Request {index + 1} &nbsp;·&nbsp; Created: {new Date(ticket.createdAt).toLocaleDateString()}
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {selectedIndex !== null && (
        <TicketDetailModal
          ticket={tickets[selectedIndex] as TicketDetail}
          requestNumber={selectedIndex + 1}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </div>
  );
}

// ── Support Request form ────────────────────────────────────────────────────
// Replaces the old separate "Book Support" and "New Request" tabs with one
// form. Filing the ticket (subject/priority/category/description/attachments)
// is always required; scheduling a one-on-one call is an optional add-on
// within the same form.
function SupportRequestForm() {
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [wantsCall, setWantsCall] = useState(false);
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState<number | "">("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFiles(Array.from(e.dataTransfer.files));
  };

  const isValid =
    !!subject &&
    !!priority &&
    !!category &&
    !!description &&
    description.length <= 2000 &&
    (!wantsCall || (!!date && !!duration));

  const handleSubmit = async () => {
    if (!isValid) {
      alert("Please fill in all required fields before submitting.");
      return;
    }
    try {
      setSubmitting(true);
      await createSupportRequest({
        subject,
        description,
        priority: priority as Priority,
        category,
        attachments: [],
        duration: wantsCall ? Number(duration) : 0,
      });
      setSubmitted(true);
      setSubject(""); setPriority(""); setCategory(""); setDescription(""); setFiles([]);
      setWantsCall(false); setDate(""); setDuration("");
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || "Server error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-800">Support Request</h2>
        <p className="text-sm sm:text-md text-gray-500">Tell us what's going on — optionally book a call with our team.</p>
      </div>
      {submitted && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Request submitted successfully!{wantsCall ? " Your session request has been sent too." : ""}
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of your issue"
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
            >
              <option value="" disabled>Select priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
            >
              <option value="" disabled>Select category</option>
              <option value="technical">Technical</option>
              <option value="billing">Billing</option>
              <option value="antivirus">Antivirus</option>
              <option value="rmm">RMM</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-gray-700">Description</label>
            <span className={`text-xs ${description.length > 1800 ? "text-red-500" : "text-gray-400"}`}>
              {description.length}/2000
            </span>
          </div>
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
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Attachments</label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
            {files.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {files.map((f, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600">
                    {f.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Drag & drop or browse files</p>
            )}
          </div>
        </div>

        {/* Optional: schedule a live one-on-one session as part of the same request */}
        <div className={`rounded-xl border p-4 transition-colors ${wantsCall ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={wantsCall}
              onChange={(e) => setWantsCall(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-400"
            />
            <span className="text-sm font-semibold text-gray-700">Also book a one-on-one support call</span>
          </label>

          {wantsCall && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Date</label>
                <DatePicker value={date} onChange={setDate} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select duration</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full sm:w-auto sm:self-end sm:px-10 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </div>
  );
}

// ── Support usage badge ─────────────────────────────────────────────────────
// Compact indicator shown next to the tabs: minutes used vs. plan allowance
// for the current billing cycle. Enterprise plans just show "Unlimited".
function SupportUsageBadge() {
  const [usage, setUsage] = useState<SupportUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMySubscription()
      .then((sub) => setUsage(sub.supportUsage ?? null))
      .catch(() => setUsage(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !usage) return null;

  const isUnlimited = usage.allowedMinutes === "Unlimited";

  if (isUnlimited) {
    return (
      <span className="hidden sm:inline text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">
        Unlimited support minutes
      </span>
    );
  }

  const allowed = usage.allowedMinutes as number;
  const used = usage.usedMinutes;
  const pct = allowed > 0 ? Math.min(100, (used / allowed) * 100) : 100;
  const low = allowed > 0 && used / allowed >= 0.85;

  return (
    <div className="hidden sm:flex flex-col gap-1 min-w-[160px]">
      <span className={`text-xs font-medium ${low ? "text-red-500" : "text-gray-500"}`}>
        {used} / {allowed} min used
      </span>
      <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${low ? "bg-red-400" : "bg-green-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Support() {
  const [activeTab, setActiveTab] = useState<Tab>("my-tickets");

  const tabs: { id: Tab; label: string }[] = [
    { id: "my-tickets", label: "My Tickets" },
    { id: "support-request", label: "Support Request" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mb-4">
        <h1 className="text-xl md:text-3xl font-bold text-gray-900">Support Services</h1>
        <p className="text-gray-700 mt-1 text-md sm:text-md">Get help from our expert support team</p>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <SupportUsageBadge />
          <button
            onClick={() => setActiveTab("support-request")}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
          >
            <span className="text-base leading-none">+</span>
            Support Request
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-300 p-6 shadow-sm">
        {activeTab === "my-tickets" && <MyTickets />}
        {activeTab === "support-request" && <SupportRequestForm />}
      </div>
    </div>
  );
}
