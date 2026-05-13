import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface SupportRequest {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  };
  ticketNumber: number;
  assigned_user_id: {
    _id: string;
    name: string;
  } | null;
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

  user: {
    _id: string;
    name: string;
    email: string;
  };

  ticket_no: number;

  assigned_user_id: {
    _id: string;
    name: string;
  } | null;

  duration: 30 | 60 | 120;

  category: "technical_issue" | "billing" | "antivirus" | "rmm" | "general";

  priority: "low" | "medium" | "high";

  status: "open" | "in_progress" | "resolved" | "closed";

  description: string;

  createdBy: string;

  createdAt: string;

  updatedAt: string;
}

export default function AdminManagement() {
  const navigate = useNavigate();
  const [recentRequests, setRecentRequests] = useState<SupportRequest[]>([]);
  const [recentSupportBookings, setRecentSupportBookings] = useState<
    SupportBooking[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          "http://localhost:5000/api/support-requests/all",
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await res.json();
        if (data.success) setRecentRequests(data.data);
      } catch (err) {
        console.error("Failed to fetch support bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          "http://localhost:5000/api/support-booking/all",
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await res.json();
        if (data.success) setRecentSupportBookings(data.data);
      } catch (err) {
        console.error("Failed to fetch support bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupport();
  }, []);

  const priorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "text-red-700 bg-red-100";
      case "medium":
        return "text-yellow-700 bg-yellow-100";
      case "low":
        return "text-green-700 bg-green-100";
      default:
        return "text-gray-700 bg-gray-100";
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Overview of all users subscription and billing details
          </p>
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
                title: "Users List",
                desc: "View and modify user details",
                action: () => navigate("/admin/users"),
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
                title: "Subscriptions List",
                desc: "See all active subscriptions and manage them",
                action: () => navigate("/admin/subscriptions"),
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
                title: "Self help",
                desc: "Try all our services and troubleshoot on your own",
                action: () => navigate("/user/selfhelp"),
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

        {/* Recent Services Requests */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Recent Services Requests
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Latest service request from users
                </p>
              </div>
              <button className="text-sm font-medium text-green-600 hover:underline">
                View All
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {[
                      "User Name",
                      "Ticket Number",
                      "Request Type",
                      "Priority",
                      "Assigned To",
                      "Status"
                    ].map((col) => (
                      <th
                        key={col}
                        className="text-left pb-3 text-xs uppercase tracking-wide text-gray-400 font-semibold"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-sm text-gray-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : recentRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-sm text-gray-400"
                      >
                        No requests found.
                      </td>
                    </tr>
                  ) : (
                    recentRequests.map((request) => (
                      <tr
                        key={request._id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition"
                      >
                        <td className="py-4 text-sm font-medium text-gray-900">
                          {request.user?.name || "—"}
                        </td>
                        <td className="py-4 text-sm text-gray-500">
                          #{request.ticketNumber}
                        </td>
                        <td className="py-4 text-sm text-gray-500 capitalize">
                          {request.category}
                        </td>
                        <td className="py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${priorityColor(request.priority)}`}
                          >
                            {request.priority}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-gray-400">
                          {request.assigned_user_id?.name || "Unassigned"}
                        </td>
                        <td className="py-4 text-sm text-gray-400">
                          {request.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Support */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Recent Support Bookings
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Latest support bookings from users
                </p>
              </div>
              <button className="text-sm font-medium text-green-600 hover:underline">
                View All
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {[
                      "User Name",
                      "Date",
                      "Duration",
                      "Reasons",
                      "Assigned To",
                      "Status"
                    ].map((col) => (
                      <th
                        key={col}
                        className="text-left pb-3 text-xs uppercase tracking-wide text-gray-400 font-semibold"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-sm text-gray-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : recentSupportBookings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-sm text-gray-400"
                      >
                        No requests found.
                      </td>
                    </tr>
                  ) : (
                    recentSupportBookings.map((booking) => (
                      <tr
                        key={booking._id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition"
                      >
                        <td className="py-4 text-sm font-medium text-gray-900">
                          {booking.user?.name || "—"}
                        </td>
                        <td className="py-4 text-sm text-gray-500">
                          {new Date(booking.createdAt)
                            .toLocaleDateString("en-GB")
                            .replace(/\//g, "-")}
                        </td>
                        <td className="py-4 text-sm text-gray-500 capitalize">
                          {booking.duration}
                        </td>
                        <td className="py-4">
                          <span className="py-4 text-sm text-gray-500">
                            {booking.description}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-gray-400">
                          {booking.assigned_user_id?.name || "Unassigned"}
                        </td>
                        <td className="py-4 text-sm text-gray-400">
                          {booking.status}
                        </td>
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
