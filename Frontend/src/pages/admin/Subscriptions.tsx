import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  Users,
  TrendingUp,
  PauseCircle,
  Search,
  Pause,
  Play,
} from "lucide-react";

import {
  getAllSubscriptions,
  updateSubscriptionStatus,
} from "../../services/admin/subscriptions.service";

interface BackendSubscription {
  _id: string;
  sub_id: string;
  user?: { _id: string; name: string; email: string };
  plan?: { _id: string; name: string; price: number; billingCycle: string };
  amount: number;
  status: "active" | "paused" | "cancelled" | "expired";
  startDate: string;
  nextRenewalDate: string;
  cancelledAt?: string | null;
  pausedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Subscription {
  _id: string;
  id: string;
  user: string;
  email: string;
  plan: string;
  amount: number;
  status: "active" | "paused" | "cancelled" | "expired";
  startDate: string;
  nextRenewal: string;
}

const statusStyle: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-600",
  expired: "bg-gray-100 text-gray-600",
};

const formatDate = (date?: string | null) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Subscriptions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getAllSubscriptions();

      const mapped: Subscription[] = (res.data.data || []).map(
        (item: BackendSubscription) => ({
          _id: item._id,
          id: item.sub_id,
          user: item.user?.name || "N/A",
          email: item.user?.email || "N/A",
          plan: item.plan?.name || "free",
          amount: item.amount || 0,
          status: item.status,
          startDate: formatDate(item.startDate),
          nextRenewal:
            item.status === "paused"
              ? "On Hold"
              : item.status === "cancelled"
                ? "—"
                : formatDate(item.nextRenewalDate),
        }),
      );
      setSubs(mapped);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return subs.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        s.user.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.plan.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "All Status" ||
        s.status === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [subs, search, statusFilter]);

  const totalRevenue = subs
    .filter((s) => s.status === "active")
    .reduce((acc, s) => acc + s.amount, 0)
    .toFixed(2);
  const activeCount = subs.filter((s) => s.status === "active").length;
  const pausedCount = subs.filter(
    (s) => s.status === "paused" || s.status === "cancelled",
  ).length;

  const togglePause = async (
    _id: string,
    currentStatus: Subscription["status"],
  ) => {
    try {
      const newStatus: Subscription["status"] =
        currentStatus === "active" ? "paused" : "active";

      await updateSubscriptionStatus(_id, newStatus);

      setSubs((prev) =>
        prev.map((s) =>
          s._id === _id
            ? {
                ...s,
                status: newStatus,
                nextRenewal: newStatus === "paused" ? "On Hold" : s.nextRenewal,
              }
            : s,
        ),
      );
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update subscription");
    }
  };

  const stats = [
    {
      label: "Total Revenue",
      value: `$${totalRevenue}`,
      color: "text-green-600",
      bg: "bg-green-100",
      icon: <DollarSign className="text-green-600" size={22} />,
    },
    {
      label: "Active Subscriptions",
      value: activeCount,
      color: "text-blue-600",
      bg: "bg-blue-100",
      icon: <Users className="text-blue-600" size={22} />,
    },
    {
      label: "Monthly Growth",
      value: "+12%",
      color: "text-purple-600",
      bg: "bg-purple-100",
      icon: <TrendingUp className="text-purple-600" size={22} />,
    },
    {
      label: "Paused/Cancelled",
      value: pausedCount,
      color: "text-orange-600",
      bg: "bg-orange-100",
      icon: <PauseCircle className="text-orange-600" size={22} />,
    },
  ];

  return (
    <>
      <div className="w-full min-h-screen bg-slate-50 p-3 sm:p-5 lg:p-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">
            Subscription Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor and manage user subscriptions
          </p>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-slate-500 leading-tight truncate">
                  {s.label}
                </p>
                <p className={`text-lg sm:text-2xl font-bold mt-1 ${s.color}`}>
                  {s.value}
                </p>
              </div>
              <div
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0 ml-2`}
              >
                {s.icon}
              </div>
            </div>
          ))}
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm w-full overflow-hidden">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 p-3 sm:p-4 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-1 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus-within:border-green-400 focus-within:bg-white transition-all">
              <Search size={14} className="text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by user, email, ID, or plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-xs sm:text-sm text-slate-700 placeholder-slate-300 min-w-0"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-600 bg-slate-50 outline-none cursor-pointer focus:border-green-400 sm:w-36"
            >
              {["All Status", "Active", "Paused", "Cancelled", "Expired"].map(
                (o) => (
                  <option key={o}>{o}</option>
                ),
              )}
            </select>
          </div>

          {loading && (
            <div className="py-16 text-center text-slate-400 text-sm">
              Loading subscriptions...
            </div>
          )}
          {error && !loading && (
            <div className="py-16 text-center text-red-500 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* ── Scrollable Table (hidden on mobile) ── */}
              {/* 
                KEY FIX: wrap table in a horizontally-scrollable container.
                The table itself uses min-width so columns never compress below
                their readable size, and the outer div handles the overflow.
                This works perfectly at every zoom level (80%, 90%, 100%, 125%).
              */}
              <div className="hidden sm:block w-full overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: "720px" }}>
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {[
                        { label: "Sub ID", w: "w-[105px]" },
                        { label: "User", w: "min-w-[160px]" },
                        { label: "Plan", w: "w-[70px]" },
                        { label: "Amount", w: "w-[80px]" },
                        { label: "Status", w: "w-[85px]" },
                        { label: "Start Date", w: "w-[100px]" },
                        { label: "Next Renewal", w: "w-[110px]" },
                        { label: "Actions", w: "w-[120px]" },
                      ].map((h) => (
                        <th
                          key={h.label}
                          className={`text-left px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide ${h.w}`}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr
                        key={s._id}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-3 py-3 font-semibold text-slate-800 text-xs">
                          {s.id}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-800 text-xs truncate max-w-[180px]">
                            {s.user}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                            {s.email}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-slate-600 text-xs capitalize">
                          {s.plan}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800 text-xs">
                          ${s.amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusStyle[s.status]}`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {s.startDate}
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {s.nextRenewal}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 flex-nowrap">
                            {s.status !== "cancelled" && (
                              <button
                                type="button"
                                onClick={() => togglePause(s._id, s.status)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium border border-slate-200 rounded-md hover:bg-slate-100 transition-all whitespace-nowrap"
                              >
                                {s.status === "active" ? (
                                  <>
                                    <Pause size={10} /> Pause
                                  </>
                                ) : (
                                  <>
                                    <Play size={10} /> Resume
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile Cards (< sm) ── */}
              <div className="sm:hidden divide-y divide-slate-100">
                {filtered.map((s) => (
                  <div key={s._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                          {s.id}
                        </p>
                        <p className="font-semibold text-slate-800 text-sm truncate">
                          {s.user}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {s.email}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize flex-shrink-0 ${statusStyle[s.status]}`}
                      >
                        {s.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <p className="text-slate-400">Plan</p>
                        <p className="font-medium text-slate-700 capitalize">
                          {s.plan}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Amount</p>
                        <p className="font-semibold text-slate-800">
                          ${s.amount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Start Date</p>
                        <p className="text-slate-600">{s.startDate}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Next Renewal</p>
                        <p className="text-slate-600">{s.nextRenewal}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      {s.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => togglePause(s._id, s.status)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                        >
                          {s.status === "active" ? (
                            <>
                              <Pause size={11} /> Pause
                            </>
                          ) : (
                            <>
                              <Play size={11} /> Resume
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="py-16 text-center text-slate-400 text-sm">
                  No subscriptions found.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
