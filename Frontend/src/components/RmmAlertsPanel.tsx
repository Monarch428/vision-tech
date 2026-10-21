import { useEffect, useState } from "react";
import { acknowledgeAlert, getAlerts } from "../services/user/rmm.service";
import type { RmmAlert } from "../services/user/rmm.service";

const SEVERITY_STYLES: Record<RmmAlert["severity"], string> = {
  error: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

const REFRESH_MS = 60_000;

function since(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// Open monitoring alerts. Customers see their own devices; staff see every
// customer and can acknowledge. Alerts close on their own when the problem clears.
export default function RmmAlertsPanel({ isStaff }: { isStaff: boolean }) {
  const [alerts, setAlerts] = useState<RmmAlert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getAlerts("open")
        .then((list) => !cancelled && setAlerts(list))
        .catch(() => undefined)
        .finally(() => !cancelled && setLoaded(true));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAlert(id);
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
      return;
    }
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledgedAt: new Date().toISOString() } : a)));
  };

  if (!loaded) return null;

  if (!alerts.length) {
    return (
      <div className="mt-6 bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-xl">
        No open alerts. All monitored devices look healthy.
      </div>
    );
  }

  const visible = expanded ? alerts : alerts.slice(0, 5);

  return (
    <div className="mt-6 bg-white border border-gray-300 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-md font-bold text-gray-900">
          Alerts <span className="text-red-600">({alerts.length})</span>
        </p>
        <p className="text-xs text-gray-500">Updates every minute · closes automatically when fixed</p>
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((alert) => (
          <li key={alert.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between border border-gray-200 rounded-xl px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${SEVERITY_STYLES[alert.severity]}`}>
                  {alert.severity}
                </span>
                <span className="text-sm font-semibold text-gray-900 truncate">{alert.hostname}</span>
                {isStaff && alert.customer && (
                  <span className="text-xs text-gray-500 truncate">{alert.customer.email}</span>
                )}
              </div>
              <p className="text-sm text-gray-700 mt-0.5">{alert.title}</p>
              <p className="text-xs text-gray-400">Since {since(alert.openedAt)}</p>
            </div>
            {isStaff &&
              (alert.acknowledgedAt ? (
                <span className="text-xs text-gray-500 shrink-0">Acknowledged</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAcknowledge(alert.id)}
                  className="shrink-0 h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Acknowledge
                </button>
              ))}
          </li>
        ))}
      </ul>

      {alerts.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-semibold text-gray-600 hover:text-gray-800"
        >
          {expanded ? "Show fewer" : `Show all ${alerts.length} alerts`}
        </button>
      )}
    </div>
  );
}
