import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

interface Subscription {
  _id: string;
  sub_id: string;
  user: string;
  planName: "free" | "pro" | "enterprise";
  status: "active" | "paused" | "expired" | "cancelled";
  startDate: string;
  endDate: string | null;
  nextRenewalDate: string | null;
}

interface Invoice {
  _id: string;
  invoiceNumber?: string;
  amount: number;
  status: "success" | "failed" | "pending";
  paymentMethod: string;
  paidAt: string;
  user?: {
    _id: string;
    name: string;
    email: string;
  };
  subscription?: {
    _id: string;
    status?: string;
    plan?: {
      _id?: string;
      name?: string;
      price?: number;
      billingCycle?: string;
    };
  };
}

const PLANS = [
  {
    name: "free" as const,
    label: "Free",
    price: 0,
    display: "$0",
    period: "forever",
    color: "from-slate-400 to-slate-500",
    features: [
      "1 Device monitoring",
      "Basic support",
      "Self-help tools",
      "Community access",
    ],
  },
  {
    name: "pro" as const,
    label: "Pro",
    price: 49.99,
    display: "$49.99",
    period: "/month",
    color: "from-emerald-400 to-green-500",
    features: [
      "5 Devices monitoring",
      "Priority support – 10 hrs",
      "Antivirus services",
      "RMM included",
    ],
  },
  {
    name: "enterprise" as const,
    label: "Enterprise",
    price: 149.99,
    display: "$149.99",
    period: "/month",
    color: "from-violet-500 to-purple-600",
    features: [
      "Unlimited devices",
      "24/7 dedicated support",
      "Full antivirus suite",
      "Advanced RMM",
      "Custom integrations",
    ],
  },
];

const CheckIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

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
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium ${
        type === "success" ? "bg-gray-900 text-white" : "bg-red-500 text-white"
      }`}
    >
      {type === "success" ? (
        <CheckIcon size={15} />
      ) : (
        <svg
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <svg
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function UsageBar({
  label,
  used,
  total,
  unit,
  color,
}: {
  label: string;
  used: number;
  total: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min((used / total) * 100, 100);
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm text-gray-600 font-medium">{label}</span>
        <span className="text-sm text-gray-500">
          {used} / {total} {unit}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subLoading, setSubLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") =>
    setToast({ message, type });

  const isCancelled = sub?.status === "cancelled";
  const isWithinCancelledPeriod =
    sub?.status === "cancelled" && sub?.nextRenewalDate
      ? new Date() < new Date(sub.nextRenewalDate)
      : false;

  const displayStatus = subLoading
    ? "—"
    : isWithinCancelledPeriod
      ? "Deactivated"
      : sub?.status
        ? sub.status.charAt(0).toUpperCase() + sub.status.slice(1)
        : "None";

  const planStatusCardBg = isWithinCancelledPeriod
    ? "bg-red-50 text-red-600"
    : isCancelled
      ? "bg-amber-50 text-amber-600"
      : "bg-blue-50 text-blue-500";

  const subscriptionBadgeClass = isWithinCancelledPeriod
    ? "bg-red-100 text-red-700"
    : isCancelled
      ? "bg-amber-100 text-amber-700"
      : sub?.status === "active"
        ? "bg-green-100 text-green-700"
        : "bg-gray-100 text-gray-500";

  const daysRemaining = (date: string | null) => {
    if (!date) return 0;
    return Math.max(
      0,
      Math.ceil(
        (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
  };

  const getNextBilling = () => {
    if (!sub?.startDate || sub.planName === "free") return "N/A";
    if (sub.nextRenewalDate) {
      return new Date(sub.nextRenewalDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    const start = new Date(sub.startDate);
    const next = new Date(start);
    const now = new Date();
    while (next <= now) next.setMonth(next.getMonth() + 1);
    return next.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const fetchSub = useCallback(async () => {
    try {
      setSubLoading(true);
      const res = await fetch(`${API}/user-subscriptions/my`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (res.status === 404) {
        setSub(null);
        return;
      }
      if (json.success) setSub(json.data);
      else showToast(json.message || "Could not load subscription", "error");
    } catch {
      showToast("Failed to connect to server", "error");
    } finally {
      setSubLoading(false);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      const res = await fetch(`${API}/payments/my`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setInvoices(json.data);
    } catch {
      // silent
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSub();
    fetchInvoices();
  }, [fetchSub, fetchInvoices]);

  const currentPlan = PLANS.find((p) => p.name === sub?.planName) || PLANS[0];

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Overview of your account and services
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Current Plan",
              value: subLoading ? "—" : currentPlan.label,
              bg: "bg-green-50 text-green-600",
              icon: (
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              ),
            },
            {
              label: "Plan Status",
              value: displayStatus,
              bg: planStatusCardBg,
              icon: (
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              ),
            },
            {
              label: "Total Invoices",
              value: invoicesLoading ? "—" : String(invoices.length),
              bg: "bg-purple-50 text-purple-500",
              icon: (
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <rect x="1" y="4" width="22" height="16" rx="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              ),
            },
            {
              label: "Next Billing",
              value: subLoading
                ? "—"
                : isCancelled
                  ? "Cancelled"
                  : getNextBilling(),
              bg: "bg-orange-50 text-orange-500",
              icon: (
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              ),
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">
                  {s.label}
                </p>
                <p className="text-xl font-bold text-gray-900 leading-tight">
                  {s.value}
                </p>
              </div>
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}
              >
                {s.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-base font-bold text-gray-900">Quick Actions</h2>
          <p className="text-xs text-gray-400 mb-4 mt-0.5">
            Common tasks you can perform
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                title: "Manage Subscription",
                desc: "View and modify your plan",
                action: () => navigate("/user/billingsubscriptions"),
                bg: "bg-purple-50 text-purple-500",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                ),
              },
              {
                title: "Book Support",
                desc: "Schedule one-on-one support",
                action: () => navigate("/user/support"),
                bg: "bg-blue-50 text-blue-500",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                  </svg>
                ),
              },
              {
                title: "Run Antivirus Scan",
                desc: "Start a full system scan",
                action: () => navigate("/user/antivirus"),
                bg: "bg-green-50 text-green-500",
                icon: (
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
              },
            ].map((a) => (
              <button
                key={a.title}
                onClick={a.action}
                className="flex items-center gap-3 p-4 border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-200 transition-all text-left w-full group"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.bg}`}
                >
                  {a.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                    {a.title}
                  </p>
                  <p className="text-xs text-gray-400">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Subscription + Recent Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Subscription Summary */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-base font-bold text-gray-900">Subscription</h2>
            <p className="text-xs text-gray-400 mb-4 mt-0.5">
              Your current plan and usage
            </p>
            {subLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-2 bg-gray-100 rounded" />
                <div className="h-2 bg-gray-100 rounded w-3/4" />
              </div>
            ) : (
              <>
                {isCancelled && sub?.nextRenewalDate && (
                  <div className="flex items-center gap-3 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      className="text-amber-600 flex-shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p className="text-xs text-amber-700 font-medium">
                      Deactivates in{" "}
                      <strong>
                        {daysRemaining(sub.nextRenewalDate)} days
                      </strong>{" "}
                      ·{" "}
                      {new Date(sub.nextRenewalDate).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-lg font-bold text-gray-900">
                      {currentPlan.label} Plan
                    </p>
                    <p className="text-xs text-gray-400">
                      {sub?.startDate
                        ? `Since ${new Date(sub.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                        : "No active subscription"}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${subscriptionBadgeClass}`}
                  >
                    {displayStatus}
                  </span>
                </div>
                <div className="space-y-3 mb-4">
                  <UsageBar
                    label="Support hours used"
                    used={3}
                    total={10}
                    unit="hours"
                    color="bg-gray-900"
                  />
                  <UsageBar
                    label="Devices monitored"
                    used={2}
                    total={5}
                    unit="devices"
                    color="bg-gray-900"
                  />
                </div>
              </>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-base font-bold text-gray-900">
              Recent Payments
            </h2>
            <p className="text-xs text-gray-400 mb-4 mt-0.5">
              Your latest transactions
            </p>
            {invoicesLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-xl" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">
                No payments yet
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.slice(0, 4).map((inv) => (
                  <div
                    key={inv._id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 flex-shrink-0">
                      <CheckIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {currentPlan.label} Plan
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(inv.paidAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      ${inv.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
