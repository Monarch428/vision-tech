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
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";

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

export default function Subscriptions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const container =
      document.querySelector("main") ||
      document.querySelector("[class*='overflow-y']") ||
      document.documentElement;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);

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

  const TABLE_HEADERS = [
    "Sub ID",
    "User",
    "Plan",
    "Amount",
    "Status",
    "Start Date",
    "Next Renewal",
    "Actions",
  ];

  const paginatedFiltered = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  return (
    <>
      <div className="w-full min-h-screen bg-slate-50">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">
            Subscription Management
          </h1>
          <p className="text-md sm:text-md text-gray-700 mt-0.5">
            Monitor and manage user subscriptions
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white border border-gray-700 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-700 leading-tight truncate">
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 p-3 sm:p-4 bg-white border border-gray-700 border-b-0 rounded-t-xl">
          <div className="flex items-center gap-2 flex-1 border border-gray-700 rounded-lg px-3 py-2 bg-gray-100 focus-within:border-green-400 focus-within:bg-white transition-all">
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by user, email, ID, or plan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-xs sm:text-sm text-slate-700 placeholder-gray-700 min-w-0"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-600 bg-gray-100 outline-none cursor-pointer focus:border-green-400 sm:w-36"
          >
            {["All Status", "Active", "Paused", "Cancelled", "Expired"].map(
              (o) => <option key={o}>{o}</option>,
            )}
          </select>
        </div>

        {/* ── Mobile Cards (sm and below) ── */}
        <div className="sm:hidden bg-white border border-gray-700 border-t-0 rounded-b-xl divide-y divide-slate-100">
          {loading && (
            <div className="py-16 text-center text-slate-400 text-sm">
              Loading subscriptions...
            </div>
          )}
          {error && !loading && (
            <div className="py-16 text-center text-red-500 text-sm">{error}</div>
          )}
          {!loading && !error && (
            <>
              {paginatedFiltered.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">
                  No subscriptions found.
                </div>
              ) : (
                paginatedFiltered.map((s) => (
                  <div key={s._id} className="p-4 space-y-3">
                    {/* Top row: info + status */}
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

                    {/* Detail grid */}
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

                    {/* Action */}
                    {s.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => togglePause(s._id, s.status)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                      >
                        {s.status === "active" ? (
                          <><Pause size={11} /> Pause</>
                        ) : (
                          <><Play size={11} /> Resume</>
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}

              {/* Mobile Pagination */}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    {page * rowsPerPage + 1}–
                    {Math.min((page + 1) * rowsPerPage, filtered.length)} of{" "}
                    {filtered.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                      ‹ Prev
                    </button>
                    <button
                      disabled={(page + 1) * rowsPerPage >= filtered.length}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
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
            <div className="py-16 text-center text-slate-400 text-sm">
              Loading subscriptions...
            </div>
          )}
          {error && !loading && (
            <div className="py-16 text-center text-red-500 text-sm">{error}</div>
          )}

          {!loading && !error && (
            <>
              <TableContainer sx={{ maxHeight: 560 }}>
                <Table stickyHeader aria-label="subscriptions table">
                  <TableHead>
                    <TableRow>
                      {TABLE_HEADERS.map((h) => (
                        <TableCell
                          key={h}
                          sx={{
                            backgroundColor: "#ffffff",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: "#6b7280",
                            letterSpacing: "0.05em",
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
                    {paginatedFiltered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          align="center"
                          sx={{ py: 8, border: "none", fontFamily: "inherit" }}
                        >
                          <p className="text-slate-400 text-sm">
                            No subscriptions found.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedFiltered.map((s) => (
                        <TableRow
                          key={s._id}
                          hover
                          sx={{
                            "&:hover": {
                              backgroundColor: "rgba(249,250,251,0.8)",
                            },
                            "& td": {
                              borderBottom: "1px solid #374151",
                              py: 1.5,
                              px: 2.5,
                              fontFamily: "inherit",
                            },
                          }}
                        >
                          <TableCell>
                            <span className="font-semibold text-slate-800 text-xs">
                              {s.id}
                            </span>
                          </TableCell>
                          <TableCell>
                            <p className="font-semibold text-slate-800 text-xs truncate max-w-[180px]">
                              {s.user}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {s.email}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="text-slate-600 text-xs capitalize">
                              {s.plan}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-slate-800 text-xs">
                              ${s.amount.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusStyle[s.status]}`}
                            >
                              {s.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-slate-500 text-xs whitespace-nowrap">
                              {s.startDate}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-slate-500 text-xs whitespace-nowrap">
                              {s.nextRenewal}
                            </span>
                          </TableCell>
                          <TableCell>
                            {s.status !== "cancelled" && (
                              <button
                                type="button"
                                onClick={() => togglePause(s._id, s.status)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium border border-slate-200 rounded-md hover:bg-slate-100 transition-all whitespace-nowrap"
                              >
                                {s.status === "active" ? (
                                  <><Pause size={10} /> Pause</>
                                ) : (
                                  <><Play size={10} /> Resume</>
                                )}
                              </button>
                            )}
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
                onPageChange={(_: unknown, newPage: number) =>
                  setPage(newPage)
                }
                onRowsPerPageChange={(
                  e: React.ChangeEvent<HTMLInputElement>,
                ) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0);
                }}
                sx={{
                  borderTop: "1px solid #374151",
                  fontSize: "0.875rem",
                  color: "#64748b",
                  fontFamily: "inherit",
                  "& .MuiTablePagination-select": {
                    fontSize: "0.875rem",
                    fontFamily: "inherit",
                  },
                  "& .MuiTablePagination-displayedRows": {
                    fontSize: "0.875rem",
                    fontFamily: "inherit",
                  },
                  "& .MuiTablePagination-selectLabel": {
                    fontSize: "0.875rem",
                    fontFamily: "inherit",
                  },
                  "& .MuiIconButton-root": {
                    color: "#64748b",
                    "&:hover": { backgroundColor: "#f8fafc" },
                    "&.Mui-disabled": { opacity: 0.4 },
                  },
                }}
              />
            </>
          )}
        </Paper>
      </div>
    </>
  );
}