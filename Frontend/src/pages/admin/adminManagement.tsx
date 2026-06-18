import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Chart,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { getAllUsers } from "../../services/admin/userManagement.service";
import { getAllSubscriptions } from "../../services/admin/subscriptions.service";
import { getAllServiceRequests } from "../../services/admin/serviceRequest.service.ts";
import { getSystemLogs } from "../../services/admin/systemLogs.service";

Chart.register(
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler
);

interface SupportRequest {
  _id: string;
  user: { _id: string; name: string; email: string };
  ticketNumber: number;
  assigned_user_id: { _id: string; name: string } | null;
  duration: number;
  category: string;
  priority: string;
  status: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SupportBooking {
  _id: string;
  user: { _id: string; name: string; email: string };
  ticket_no: number;
  assigned_user_id: { _id: string; name: string } | null;
  duration: 30 | 60 | 120;
  category: "technical_issue" | "billing" | "antivirus" | "rmm" | "general";
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const lineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: "index" } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    y: { grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 11 } }, min: 0 },
  },
};

const barOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: "index" } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    y: { grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 11 } }, min: 0 },
  },
};

const priorityClass = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case "high": return "bg-red-100 text-red-800";
    case "medium": return "bg-orange-100 text-orange-800";
    case "low": return "bg-green-100 text-green-700";
    default: return "bg-gray-100 text-gray-600";
  }
};

const statusClass = (status: string) => {
  switch (status?.toLowerCase()) {
    case "open": return "bg-blue-100 text-blue-800";
    case "in_progress": return "bg-yellow-100 text-yellow-800";
    case "resolved": return "bg-green-100 text-green-700";
    case "closed": return "bg-gray-100 text-gray-500";
    default: return "bg-gray-100 text-gray-500";
  }
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [recentRequests, setRecentRequests] = useState<SupportRequest[]>([]);
  const [recentSupportBookings, setRecentSupportBookings] = useState<SupportBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalClients, setTotalClients] = useState<number | null>(null);
  const [totalSubscription, setTotalSubscription] = useState<number | null>(null);
  const [currentMonthClientCount, setCurrentMonthClientCount] = useState<number | null>(null);
  const [subPercentage, setSubPercentage] = useState<number | null>(null);
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const [criticalRequests, setCriticalRequests] = useState<number | null>(null);
  const [monthlyClientData, setMonthlyClientData] = useState<number[]>(Array(12).fill(0));
  const [monthlySubData, setMonthlySubData] = useState<number[]>(Array(12).fill(0));
  const [recentLogs, setRecentLogs] = useState<
  { _id: string; type: "success" | "info" | "warning" | "error"; action: string; details: string; timestamp: string } []
    > ([]);

  const lineData: ChartData<"line"> = {
    labels: months,
    datasets: [
      {
        label: "Total Clients",
        data: monthlyClientData,
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#6366f1",
        borderWidth: 2,
      },
    ],
  };

  const barData: ChartData<"bar"> = {
    labels: months,
    datasets: [
      {
        label: "Total Clients",
        data: monthlyClientData,
        backgroundColor: "#c7d2fe",
        borderRadius: 3,
        barPercentage: 0.7,
      },
      {
        label: "Active Subscriptions",
        data: monthlySubData,
        backgroundColor: "#22c55e",
        borderRadius: 3,
        barPercentage: 0.7,
      },
    ],
  };

  const logIconStyle = (type: string) => {
    switch (type) {
      case "success": return { icon: "✓", iconBg: "bg-green-100 text-green-700" };
      case "warning": return { icon: "⚠", iconBg: "bg-yellow-100 text-yellow-700" };
      case "error": return { icon: "✕", iconBg: "bg-red-100 text-red-600" };
      default: return { icon: "○", iconBg: "bg-blue-100 text-blue-600" };
    }
  };

  const formatTimeAgo = (d: string) => {
    const diffMs = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} day ago`;
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await getSystemLogs({ page: 1, limit: 5, search: "", type: "all" });
        const logs = (res.data.logs || [])
          .map((log: any) => ({
            _id: log._id,
            type: log.type || "info",
            action: log.action || "UNKNOWN_ACTION",
            details: log.details || "",
            timestamp: log.loggedAt || log.createdAt || new Date().toISOString(),
          }))
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5);
        setRecentLogs(logs);
      } catch (err) {
        console.error("Failed to fetch system logs:", err);
      }
    };
    fetchLogs();
  }, []);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/support-requests/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setRecentRequests(data.data.slice(0, 5));
      } catch (err) {
        console.error("Failed to fetch support requests:", err);
      }
    };
    fetchRequests();
  }, []);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/support-booking/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setRecentSupportBookings(data.data.slice(0, 5));
      } catch (err) {
        console.error("Failed to fetch support bookings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await getAllUsers();
        setTotalClients(res.data.count);
        setCurrentMonthClientCount(res.data.currentMonthCount);
        const users: { createdAt: string }[] = res.data.data;
        const counts = Array(12).fill(0);
        users.forEach((u) => {
          const month = new Date(u.createdAt).getMonth();
          counts[month]++;
        });
        for (let i = 1; i < 12; i++) counts[i] += counts[i - 1];
        setMonthlyClientData(counts);
      } catch (err) {
        console.error("Failed to fetch clients:", err);
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const res = await getAllSubscriptions();
        const activeSubs =
          (res.data.data || []).filter((sub: any) => sub.status === "active");
        const activeSubCount = Number(res.data.activeSubscriptions || activeSubs.length);
        setTotalSubscription(activeSubCount);
        setSubPercentage(Number(res.data.subscriptionPercentage || 0));
        const counts = Array(12).fill(0);
        activeSubs.forEach((sub: any) => {
          const month = new Date(sub.createdAt).getMonth();
          counts[month]++;
        });
        for (let i = 1; i < 12; i++) counts[i] += counts[i - 1];
        setMonthlySubData(counts);
      } catch (err) {
        console.error("Failed to fetch subscriptions:", err);
      }
    };
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    const fetchRequestCount = async () => {
      try {
        const res = await getAllServiceRequests();
        setRequestCount(res.data.data.length);
        setCriticalRequests(res.data.criticalRequest);
      } catch (err) {
        console.error("Failed to fetch service requests:", err);
      }
    };
    fetchRequestCount();
  }, []);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-md text-gray-700 mt-0.5">
            Unified overview of all clients, services, and infrastructure
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/users")}
          className="bg-green-600 hover:bg-green-700 transition-colors text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          View All Clients
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Total Clients",
            value: totalClients !== null ? String(totalClients) : "—",
            sub: currentMonthClientCount !== null ? `+${currentMonthClientCount} this month` : "Loading...",
            subColor: "text-green-600",
            iconBg: "bg-violet-100",
            iconColor: "text-violet-600",
            icon: (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ),
          },
          {
            label: "Active Subscriptions",
            value: totalSubscription !== null ? String(totalSubscription) : "—",
            sub: subPercentage !== null ? `${subPercentage}% of users` : "Loading...",
            subColor: "text-green-600",
            iconBg: "bg-green-100",
            iconColor: "text-green-600",
            icon: (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            ),
          },
          {
            label: "Open Service Requests",
            value: requestCount !== null ? String(requestCount) : "—",
            sub: criticalRequests !== null ? `${criticalRequests} urgent` : "Loading...",
            subColor: "text-orange-500",
            iconBg: "bg-orange-100",
            iconColor: "text-orange-500",
            icon: (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            ),
          },
          {
            label: "Monitored Devices",
            value: "342",
            sub: "98.2% uptime",
            subColor: "text-blue-500",
            iconBg: "bg-blue-100",
            iconColor: "text-blue-500",
            icon: (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            ),
          },
        ].map((card) => (
          <div key={card.label} className="bg-gray-50 rounded-xl p-4 border border-gray-700">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg} ${card.iconColor}`}>
              {card.icon}
            </div>
            <p className="text-md text-gray-700 mb-1">{card.label}</p>
            <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
            <p className={`text-xs mt-1 ${card.subColor}`}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-700 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Total Clients</h2>
              <p className="text-md text-gray-700 mt-0.5">Month-over-month growth</p>
            </div>
            <span className="flex items-center gap-1 text-md font-medium bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
              ↗ {totalClients ?? 0} total
            </span>
          </div>
          <div style={{ height: 200 }}>
            <Line data={lineData} options={lineOptions} />
          </div>
        </div>

        <div className="bg-white border border-gray-700 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Active Subscriptions</h2>
              <p className="text-md text-gray-700 mt-0.5">Compared with total clients per month</p>
            </div>
            <span className="flex items-center gap-1 text-md font-medium bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
              ↗ {subPercentage ?? "—"}% of users
            </span>
          </div>
          <div className="flex gap-4 mb-3">
            <span className="flex items-center gap-1.5 text-md text-gray-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-200 inline-block" />
              Total Clients
            </span>
            <span className="flex items-center gap-1.5 text-md text-gray-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
              Active Subscriptions
            </span>
          </div>
          <div style={{ height: 180 }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Admin Capabilities */}
      <div>
        <p className="text-md font-semibold text-gray-700 uppercase tracking-widest mb-3">
          Admin Capabilities
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[
            {
              title: "Unified Client Portal",
              desc: "View all clients, subscriptions, and associated services from a single dashboard.",
              iconBg: "bg-violet-50", iconColor: "text-violet-500",
              action: () => navigate("/admin/users"),
              icon: (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
            },
            {
              title: "Subscriptions & Billing",
              desc: "Monitor payment history, plan renewals, and financial performance.",
              iconBg: "bg-green-50", iconColor: "text-green-500",
              action: () => navigate("/admin/subscriptions"),
              icon: (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              ),
            },
            {
              title: "Service Fulfillment",
              desc: "Manage support bookings, installations, and active service tickets.",
              iconBg: "bg-orange-50", iconColor: "text-orange-500",
              action: () => navigate("/user/support"),
              icon: (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              ),
            },
            {
              title: "External Access",
              desc: "Quick-access links to external portals and secure technician credentials.",
              iconBg: "bg-blue-50", iconColor: "text-blue-500",
              action: () => navigate("/admin/external"),
              icon: (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              ),
            },
            {
              title: "Data Management",
              desc: "Upload and download diagnostic logs and client data exports.",
              iconBg: "bg-pink-50", iconColor: "text-pink-500",
              action: () => navigate("/admin/dataManagement"),
              icon: (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              ),
            },
            {
              title: "Infrastructure Oversight",
              desc: "Centralized RMM monitoring — device health, alerts, and status.",
              iconBg: "bg-teal-50", iconColor: "text-teal-500",
              action: () => navigate("/admin/infrastructure"),
              icon: (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              ),
            },
          ].map((cap) => (
            <button
              key={cap.title}
              onClick={cap.action}
              className="flex items-start gap-3 p-4 bg-white border border-gray-700 rounded-2xl hover:border-gray-200 hover:bg-gray-50 transition-all text-left group"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cap.iconBg} ${cap.iconColor}`}>
                {cap.icon}
              </div>
              <div>
                <p className="text-md font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                  {cap.title}
                </p>
                <p className="text-md text-gray-700 mt-0.5 leading-relaxed">{cap.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Needs Attention + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-700 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <svg width="16" height="16" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-900">Needs Attention</h2>
              </div>
              <p className="text-xs text-gray-400">Items requiring immediate review</p>
            </div>
            <button className="text-xs font-medium text-green-600 hover:underline">View all</button>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { name: "BrightStar Solutions", sub: "Payment overdue – 8 days", pill: "Overdue", pillClass: "bg-red-100 text-red-800" },
              { name: "WS-HQ-014 (DataStream)", sub: "Device offline – 34 min", pill: "Alert", pillClass: "bg-orange-100 text-orange-800" },
              { name: "TechNova Inc", sub: "Support ticket pending 48h", pill: "Pending", pillClass: "bg-yellow-100 text-yellow-800" },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${item.pillClass}`}>
                  {item.pill}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-700 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
              <p className="text-xs text-gray-400 mt-0.5">Latest events across all clients and services</p>
            </div>
            <button
              onClick={() => navigate("/admin/Systemlogs")}
              className="text-xs font-medium text-green-600 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentLogs.length === 0 ? (
              <p className="text-md text-gray-400 py-4 text-center">No recent activity.</p>
            ) : (
              recentLogs.map((log) => {
                const style = logIconStyle(log.type);
                return (
                  <div key={log._id} className="flex items-start gap-3 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${style.iconBg}`}>
                      {style.icon}
                    </div>
                    <div>
                      <p className="text-sm text-gray-800 leading-snug">{log.details || log.action}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatTimeAgo(log.timestamp)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Service Requests */}
      <div className="bg-white border border-gray-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent Service Requests</h2>
            <p className="text-md text-gray-700 mt-0.5">Last 5 service requests from users</p>
          </div>
          <button
            onClick={() => navigate("/admin/serviceRequest")}
            className="text-xs font-medium text-green-600 hover:underline"
          >
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-700">
                {["User Name", "Ticket", "Category", "Priority", "Assigned To", "Status"].map((col) => (
                  <th key={col} className="text-left pb-3 text-xs uppercase tracking-wide text-gray-700 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-md text-gray-700">Loading...</td></tr>
              ) : recentRequests.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-md text-gray-700">No requests found.</td></tr>
              ) : (
                recentRequests.map((request) => (
                  <tr key={request._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="py-3.5 text-md font-medium text-gray-900">{request.user?.name || "—"}</td>
                    <td className="py-3.5 text-md text-gray-400">#{request.ticketNumber}</td>
                    <td className="py-3.5 text-md text-gray-500 capitalize">{request.category}</td>
                    <td className="py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${priorityClass(request.priority)}`}>
                        {request.priority}
                      </span>
                    </td>
                    <td className="py-3.5 text-sm text-gray-400">{request.assigned_user_id?.name || "Unassigned"}</td>
                    <td className="py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusClass(request.status)}`}>
                        {request.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Support Bookings */}
      <div className="bg-white border border-gray-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent Support Bookings</h2>
            <p className="text-md text-gray-700 mt-0.5">Last 5 support bookings from users</p>
          </div>
          <button
            onClick={() => navigate("/user/support")}
            className="text-xs font-medium text-green-600 hover:underline"
          >
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-700">
                {["User Name", "Date", "Duration", "Reason", "Assigned To", "Status"].map((col) => (
                  <th key={col} className="text-left pb-3 text-xs uppercase tracking-wide text-gray-700 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-md text-gray-400">Loading...</td></tr>
              ) : recentSupportBookings.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-md text-gray-400">No bookings found.</td></tr>
              ) : (
                recentSupportBookings.map((booking) => (
                  <tr key={booking._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="py-3.5 text-md font-medium text-gray-900">{booking.user?.name || "—"}</td>
                    <td className="py-3.5 text-md text-gray-400">
                      {new Date(booking.createdAt).toLocaleDateString("en-GB").replace(/\//g, "-")}
                    </td>
                    <td className="py-3.5 text-md text-gray-500">{booking.duration} min</td>
                    <td className="py-3.5 text-md text-gray-500 max-w-[160px] truncate">{booking.description}</td>
                    <td className="py-3.5 text-md text-gray-400">{booking.assigned_user_id?.name || "Unassigned"}</td>
                    <td className="py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusClass(booking.status)}`}>
                        {booking.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}