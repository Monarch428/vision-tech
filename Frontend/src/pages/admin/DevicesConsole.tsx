import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { getAuditLog, getConsole } from "../../services/user/rmm.service";
import type { AuditEntry, ConsoleData, ConsoleDevice, ConsoleFilters } from "../../services/user/rmm.service";
import RmmAlertsPanel from "../../components/RmmAlertsPanel";
import DeviceDetailsModal from "../../components/DeviceDetailsModal";

type Tab = "devices" | "alerts" | "activity";
const REFRESH_MS = 60_000;

const timeAgo = (iso: string | null) => {
  if (!iso) return "never";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

function StatCard({ label, value, tone = "text-gray-900" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="bg-white border border-gray-300 rounded-2xl px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

// Moving a device between customers happens in Tactical RMM (this API key can't
// edit agents); the portal follows the device's Site automatically.
function MoveDeviceDialog({ device, tacticalUrl, onClose }: { device: ConsoleDevice; tacticalUrl: string | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3">
        <h2 className="text-lg font-bold text-gray-900">Move {device.hostname}</h2>
        <p className="text-sm text-gray-600">
          Devices belong to the customer linked to their RMM Site. To give this device to another customer, change its Site in
          Tactical RMM:
        </p>
        <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
          <li>Open Tactical RMM and find <strong>{device.hostname}</strong> (currently in “{device.siteName}”).</li>
          <li>Right-click it → <strong>Edit</strong> → choose the new customer's Site → Save.</li>
          <li>Within about 2 minutes this console shows the new owner, and plan limits are re-checked.</li>
        </ol>
        <p className="text-xs text-gray-500">The new Site must be linked to the customer's account (User Management → Edit User).</p>
        <div className="flex gap-2 pt-1">
          {tacticalUrl && (
            <a
              href={tacticalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-10 rounded-xl bg-green-500 text-white text-sm font-semibold flex items-center justify-center"
            >
              Open Tactical RMM
            </a>
          )}
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAuditLog()
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setHasMore(list.length === 50);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = async () => {
    const last = entries[entries.length - 1];
    if (!last) return;
    const more = await getAuditLog(last.at);
    setEntries((prev) => [...prev, ...more]);
    setHasMore(more.length === 50);
  };

  if (loading) return <p className="text-sm text-gray-500 mt-4">Loading activity…</p>;
  if (!entries.length) return <p className="text-sm text-gray-500 mt-4">No RMM activity yet.</p>;

  return (
    <div className="mt-4 bg-white border border-gray-300 rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-4 py-2">When</th>
            <th className="px-4 py-2">Event</th>
            <th className="px-4 py-2">By</th>
            <th className="px-4 py-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-gray-100 align-top">
              <td className="px-4 py-2 whitespace-nowrap text-gray-600">{new Date(e.at).toLocaleString()}</td>
              <td className="px-4 py-2 whitespace-nowrap">
                <span className={e.type === "warning" || e.type === "error" ? "text-amber-700 font-semibold" : "text-gray-800"}>
                  {e.action.replace(/^RMM_/, "").replace(/_/g, " ").toLowerCase()}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-600">{e.by || "system"}</td>
              <td className="px-4 py-2 text-gray-700">{e.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button type="button" onClick={loadMore} className="w-full py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 border-t border-gray-100">
          Load more
        </button>
      )}
    </div>
  );
}

// Staff view of every monitored device across customers.
export default function DevicesConsole() {
  const [tab, setTab] = useState<Tab>("devices");
  const [filters, setFilters] = useState<ConsoleFilters>({ search: "", status: "", siteId: "", alerts: false, overLimit: false });
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ConsoleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [moving, setMoving] = useState<ConsoleDevice | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, search })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getConsole(filters)
        .then((d) => {
          if (cancelled) return;
          setData(d);
          setError(null);
        })
        .catch((e) => !cancelled && setError((isAxiosError(e) && e.response?.data?.message) || "Couldn't load devices."));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [filters]);

  const s = data?.summary;
  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-semibold rounded-xl ${tab === t ? "bg-green-500 text-white" : "text-gray-600 hover:bg-gray-100"}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
        <p className="text-md text-gray-700 mt-0.5">
          Every monitored device across customers{s?.lastSyncAt ? ` · synced ${timeAgo(s.lastSyncAt)}` : ""}
        </p>
      </div>

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Devices" value={s.total} />
          <StatCard label="Online" value={s.online} tone="text-green-600" />
          <StatCard label="Offline" value={s.offline} tone="text-gray-500" />
          <StatCard label="With alerts" value={s.withAlerts} tone="text-red-600" />
          <StatCard label="Over plan limit" value={s.overLimit} tone="text-amber-600" />
          <StatCard label="Unlinked sites" value={s.unlinkedSites} tone="text-amber-600" />
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" className={tabClass("devices")} onClick={() => setTab("devices")}>Devices</button>
        <button type="button" className={tabClass("alerts")} onClick={() => setTab("alerts")}>Alerts</button>
        <button type="button" className={tabClass("activity")} onClick={() => setTab("activity")}>Activity log</button>
      </div>

      {data?.sync.stale && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-xl">
          RMM sync is behind{data.sync.lastSuccessAt ? ` (last success ${timeAgo(data.sync.lastSuccessAt)})` : ""}. Data shown is cached.
          {data.sync.lastError && <span className="block text-xs mt-1">Last error: {data.sync.lastError}</span>}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {tab === "devices" && (
        <>
          <div className="flex flex-col lg:flex-row gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search device, customer or site"
              className="flex-1 h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as ConsoleFilters["status"] }))}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">Any status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
            <select
              value={filters.siteId}
              onChange={(e) => setFilters((f) => ({ ...f, siteId: e.target.value }))}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">All sites</option>
              {data?.sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}{site.linkedUser ? "" : " (not linked)"}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-700 px-2">
              <input type="checkbox" checked={filters.alerts} onChange={(e) => setFilters((f) => ({ ...f, alerts: e.target.checked }))} />
              With alerts
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700 px-2">
              <input type="checkbox" checked={filters.overLimit} onChange={(e) => setFilters((f) => ({ ...f, overLimit: e.target.checked }))} />
              Over limit
            </label>
          </div>

          <div className="bg-white border border-gray-300 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2">Device</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Disk</th>
                  <th className="px-4 py-2">Alerts</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>
                ) : data.devices.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No devices match these filters.</td></tr>
                ) : (
                  data.devices.map((d) => (
                    <tr key={d.id} className="border-t border-gray-100">
                      <td className="px-4 py-2">
                        <p className="font-semibold text-gray-900">{d.hostname}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[220px]">{d.os}</p>
                      </td>
                      <td className="px-4 py-2">
                        {d.customer ? (
                          <>
                            <p className="text-gray-900">{d.customer.name}</p>
                            <p className="text-xs text-gray-500">{d.customer.email} · <span className="capitalize">{d.customer.plan}</span></p>
                          </>
                        ) : (
                          <p className="text-amber-700 text-xs font-semibold">Not linked</p>
                        )}
                        <p className="text-xs text-gray-400">Site: {d.siteName}</p>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={d.status === "online" ? "text-green-600 font-semibold" : "text-gray-500 font-semibold"}>{d.status}</span>
                        <p className="text-xs text-gray-400">{timeAgo(d.lastSeen)}</p>
                      </td>
                      <td className="px-4 py-2">{d.storage === null ? "—" : `${d.storage}%`}</td>
                      <td className="px-4 py-2">
                        {d.openAlerts > 0 && <span className="text-red-600 font-semibold">{d.openAlerts}</span>}
                        {d.overLimit && (
                          <span className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            over limit
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-right">
                        <button type="button" onClick={() => setDetailsId(d.id)} className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 mr-1">
                          Details
                        </button>
                        <button type="button" onClick={() => setMoving(d)} className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                          Move
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "alerts" && <RmmAlertsPanel isStaff />}
      {tab === "activity" && <ActivityLog />}

      {detailsId && <DeviceDetailsModal deviceId={detailsId} onClose={() => setDetailsId(null)} />}
      {moving && <MoveDeviceDialog device={moving} tacticalUrl={data?.tacticalUrl ?? null} onClose={() => setMoving(null)} />}
    </div>
  );
}
