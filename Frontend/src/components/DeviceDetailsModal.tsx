import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { isAxiosError } from "axios";
import { getDeviceDetails, runDeviceAction } from "../services/user/rmm.service";
import type { DeviceAction, DeviceDetails } from "../services/user/rmm.service";

const errorText = (error: unknown, fallback: string) =>
  (isAxiosError(error) ? error.response?.data?.message : undefined) || fallback;

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

const ACTION_CONFIRM: Record<DeviceAction["key"], string> = {
  restart: "Restart this computer? Windows shows a 60-second warning, then restarts. Unsaved work may be lost.",
  "disk-cleanup":
    "Clean up the disk? This deletes temporary files, the Windows Update download cache, user temp files older than 7 days, and EMPTIES THE RECYCLE BIN. This can't be undone.",
  "antivirus-scan": "Start a Bitdefender quick scan on this computer?",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-100 pt-4">
      <h3 className="text-sm font-bold text-gray-900 mb-2">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-0.5">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right break-all">{value ?? "—"}</span>
    </div>
  );
}

// Device details with safe, pre-defined remote actions. Everything shown and
// every action is authorised by the API for the device's owner (or staff).
export default function DeviceDetailsModal({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const [details, setDetails] = useState<DeviceDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [softwareQuery, setSoftwareQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getDeviceDetails(deviceId)
      .then((d) => !cancelled && setDetails(d))
      .catch((e) => !cancelled && setLoadError(errorText(e, "Couldn't load device details.")));
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  const software = useMemo(() => {
    const q = softwareQuery.trim().toLowerCase();
    const list = details?.software ?? [];
    return q ? list.filter((s) => `${s.name} ${s.publisher}`.toLowerCase().includes(q)) : list;
  }, [details, softwareQuery]);

  const handleAction = async (action: DeviceAction) => {
    if (!window.confirm(ACTION_CONFIRM[action.key])) return;
    setBusyAction(action.key);
    setMessage(null);
    try {
      const result = await runDeviceAction(deviceId, action.key);
      setMessage({ text: result.message, error: false });
      setDetails(await getDeviceDetails(deviceId));
    } catch (e) {
      setMessage({ text: errorText(e, "The action could not be started."), error: true });
    } finally {
      setBusyAction(null);
    }
  };

  const d = details?.device;
  const online = d?.status === "online";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{d?.hostname ?? "Device"}</h2>
            {d && (
              <p className="text-xs text-gray-500">
                <span className={online ? "text-green-600 font-semibold" : "text-gray-500 font-semibold"}>{d.status}</span>
                {" · "}Last seen {formatDate(d.lastSeen)}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">
            ×
          </button>
        </div>

        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {!details && !loadError && <p className="text-sm text-gray-500">Loading device details…</p>}

        {details && d && (
          <div className="flex flex-col gap-4">
            <Section title="Actions">
              {details.availableActions.length === 0 ? (
                <p className="text-sm text-gray-500">No remote actions are available for this device.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {details.availableActions.map((action) => {
                    const waiting = action.availableInSeconds > 0;
                    const disabled = !online || waiting || busyAction !== null;
                    return (
                      <div key={action.key} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                          <p className="text-xs text-gray-500">{action.description}</p>
                          {waiting && (
                            <p className="text-xs text-amber-700">Available again in {Math.ceil(action.availableInSeconds / 60)} min</p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleAction(action)}
                          title={!online ? "The device must be online" : undefined}
                          className="shrink-0 h-9 px-4 rounded-xl bg-green-500 text-white text-sm font-semibold disabled:opacity-50"
                        >
                          {busyAction === action.key ? "Sending…" : "Run"}
                        </button>
                      </div>
                    );
                  })}
                  {!online && <p className="text-xs text-gray-500">Actions are available while the device is online.</p>}
                </div>
              )}
              {details.remoteDesktopUrl && (
                <a
                  href={details.remoteDesktopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-sm font-semibold text-blue-600 underline underline-offset-2"
                >
                  Remote desktop (opens Tactical RMM — staff login required)
                </a>
              )}
              {message && <p className={`mt-2 text-sm ${message.error ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
            </Section>

            <Section title="Overview">
              <Row label="Operating system" value={d.os} />
              <Row label="Model" value={d.makeModel} />
              <Row label="Processor" value={d.cpuModel} />
              <Row label="Memory" value={d.totalRamGb ? `${d.totalRamGb} GB` : null} />
              <Row label="Serial number" value={d.serialNumber} />
              <Row label="Signed-in user" value={d.loggedInUser} />
              <Row label="Last restart" value={formatDate(d.bootTime)} />
              <Row label="Needs restart" value={d.needsReboot ? "Yes" : "No"} />
              <Row label="IP addresses" value={[d.localIps, d.publicIp].filter(Boolean).join(" · ") || null} />
              <Row label="Metrics updated" value={formatDate(d.metricsUpdatedAt)} />
            </Section>

            <Section title="Disks">
              {d.disks.length === 0 ? (
                <p className="text-sm text-gray-500">No disk information reported.</p>
              ) : (
                d.disks.map((disk) => (
                  <div key={disk.device} className="mb-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{disk.device}</span>
                      <span>{disk.free} free of {disk.total} ({disk.percent}% used)</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${disk.percent >= 90 ? "bg-red-500" : disk.percent >= 75 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${disk.percent}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </Section>

            <Section title="Health checks">
              {details.checks.length === 0 ? (
                <p className="text-sm text-gray-500">No health checks are configured for this device.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {details.checks.map((c) => (
                    <li key={c.checkId} className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-700">{c.title}</span>
                      <span className={c.status === "failing" ? "text-red-600 font-semibold" : c.status === "passing" ? "text-green-600" : "text-gray-500"}>
                        {c.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {d.platform === "windows" && (
              <Section title={`Pending Windows updates (${details.pendingUpdates?.length ?? 0})`}>
                {!details.pendingUpdates?.length ? (
                  <p className="text-sm text-gray-500">Up to date.</p>
                ) : (
                  <ul className="list-disc pl-5 text-sm text-gray-700">
                    {details.pendingUpdates.slice(0, 15).map((u) => (
                      <li key={`${u.kb}-${u.title}`}>{u.title}</li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            <Section title={`Installed software (${details.software.length})`}>
              <input
                type="search"
                value={softwareQuery}
                onChange={(e) => setSoftwareQuery(e.target.value)}
                placeholder="Search software"
                className="w-full h-9 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm mb-2"
              />
              <ul className="max-h-48 overflow-y-auto text-sm divide-y divide-gray-100">
                {software.map((s) => (
                  <li key={`${s.name}-${s.version}`} className="py-1 flex justify-between gap-3">
                    <span className="text-gray-800">{s.name}</span>
                    <span className="text-gray-400 shrink-0">{s.version}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Recent activity">
              {details.alerts.length === 0 && details.actions.length === 0 ? (
                <p className="text-sm text-gray-500">No recent alerts or actions.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {details.actions.map((a) => (
                    <li key={`action-${a.createdAt}`} className="text-gray-700">
                      {formatDate(a.createdAt)} · {a.action} by {a.requestedBy} ·{" "}
                      <span className={a.status === "failed" ? "text-red-600" : "text-green-700"}>{a.status}</span>
                    </li>
                  ))}
                  {details.alerts.map((a) => (
                    <li key={a.id} className="text-gray-700">
                      {formatDate(a.openedAt)} · {a.title} ·{" "}
                      <span className={a.status === "open" ? "text-red-600" : "text-gray-500"}>{a.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
