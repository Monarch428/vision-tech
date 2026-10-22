import { useCallback, useEffect, useMemo, useState } from "react";
import { getDevices } from "../services/user/rmm.service";
import type { Device } from "../services/user/rmm.service";
import {
  getFileBackups,
  startFileBackup,
  setFileBackupSchedule,
  deleteFileBackup,
  downloadFileBackup,
} from "../services/user/fileBackup.service";
import type { FileBackup, FileBackupOverview } from "../services/user/fileBackup.service";
import { getErrorMessage } from "../utils/errors";

// Self-Help card: back up Documents / Desktop / Pictures from the customer's own
// Windows computer through the RMM agent, to cloud storage within the plan quota.

const formatSize = (bytes: number) => {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const isWindows = (d: Device) => /windows/i.test(d.platform || "");

const DriveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="#16a34a" strokeWidth="1.8" />
    <path d="M2 10h20" stroke="#16a34a" strokeWidth="1.8" />
    <circle cx="7" cy="15" r="1" fill="#16a34a" />
    <circle cx="11" cy="15" r="1" fill="#16a34a" />
  </svg>
);

const Spinner = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
  </svg>
);

const STATUS_LABEL: Record<FileBackup["status"], string> = {
  pending: "Waiting for the device…",
  running: "Backing up…",
  completed: "Completed",
  failed: "Failed",
};

export default function FileBackupCard() {
  const [overview, setOverview] = useState<FileBackupOverview | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [linked, setLinked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState("");
  const [folders, setFolders] = useState<string[]>(["Documents", "Desktop"]);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await getFileBackups();
    setOverview(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFileBackups(), getDevices()])
      .then(([data, deviceList]) => {
        if (cancelled) return;
        setOverview(data);
        setLinked(deviceList.linked);
        const windows = deviceList.devices.filter(isWindows);
        setDevices(windows);
        if (windows.length === 1) {
          setAgentId(windows[0].deviceId);
          const saved = data.schedules.find((s) => s.agentId === windows[0].deviceId);
          if (saved?.folders.length) setFolders(saved.folders);
        }
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, "Couldn't load your backups.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(
    () => overview?.backups.filter((b) => b.status === "pending" || b.status === "running") ?? [],
    [overview]
  );

  // Follow backups in progress until the device finishes.
  useEffect(() => {
    if (!active.length) return;
    const id = setInterval(() => refresh().catch(() => undefined), 5000);
    return () => clearInterval(id);
  }, [active.length, refresh]);

  const schedule = overview?.schedules.find((s) => s.agentId === agentId) ?? null;
  const selectedDevice = devices.find((d) => d.deviceId === agentId) ?? null;

  // Choosing a device ticks the folders of its weekly schedule, if it has one.
  const selectDevice = (id: string) => {
    setAgentId(id);
    const saved = overview?.schedules.find((s) => s.agentId === id);
    if (saved?.folders.length) setFolders(saved.folders);
  };

  const toggleFolder = (name: string) =>
    setFolders((list) => (list.includes(name) ? list.filter((f) => f !== name) : [...list, name]));

  const handleStart = async () => {
    setError(null);
    setNotice(null);
    if (!agentId) return setError("Select the computer to back up.");
    if (!folders.length) return setError("Choose at least one folder.");
    try {
      setBusy(true);
      await startFileBackup(agentId, folders);
      await refresh();
      setNotice("Backup started. It runs in the background on your computer — you can leave this page.");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't start the backup."));
    } finally {
      setBusy(false);
    }
  };

  const handleSchedule = async (enabled: boolean) => {
    setError(null);
    if (!agentId) return setError("Select the computer first.");
    if (!folders.length) return setError("Choose at least one folder.");
    try {
      setBusy(true);
      await setFileBackupSchedule(agentId, folders, enabled);
      await refresh();
      setNotice(enabled ? "Weekly automatic backup is on." : "Weekly automatic backup is off.");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the schedule."));
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (backup: FileBackup) => {
    setError(null);
    try {
      setBusyId(backup.id);
      await downloadFileBackup(backup);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download the backup."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (backup: FileBackup) => {
    if (!window.confirm("Delete this backup? This can't be undone.")) return;
    setError(null);
    try {
      setBusyId(backup.id);
      await deleteFileBackup(backup.id);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't delete the backup."));
    } finally {
      setBusyId(null);
    }
  };

  const usage = overview?.usage;
  const usedPercent = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const deviceBusy = active.some((b) => b.agentId === agentId);

  return (
    <div className="bg-white border border-gray-300 rounded-xl p-3.5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-green-50 p-1.5 rounded-lg shrink-0">
          <DriveIcon />
        </div>
        <h3 className="text-sm font-bold text-gray-900 leading-tight">File Backup</h3>
      </div>

      <p className="text-md text-gray-600 leading-snug">Back up your important files to secure cloud storage</p>

      <div className="bg-orange-50 rounded-lg p-2.5">
        <p className="text-[14px] leading-snug text-orange-700">
          Copies your Documents, Desktop and Pictures from your Windows computer through the monitoring agent.
          Your computer must be on. Files that are open or only in OneDrive's cloud are skipped. The newest{" "}
          {overview?.keepPerDevice ?? 2} backups of each computer are kept.
        </p>
      </div>

      {usage && (
        <div>
          <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
            <span>Storage ({usage.plan} plan)</span>
            <span>
              {formatSize(usage.used)} of {formatSize(usage.limit)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${usedPercent >= 90 ? "bg-red-500" : "bg-green-500"}`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[12px] text-gray-500">Loading…</p>
      ) : !linked || !devices.length ? (
        <p className="text-[12px] text-gray-600">
          No Windows computer is being monitored yet. Add your computer on the RMM page first.
        </p>
      ) : (
        <>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Computer to back up</label>
            <select
              value={agentId}
              onChange={(e) => selectDevice(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700"
            >
              {devices.length > 1 && <option value="">Select your computer…</option>}
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.hostname}
                  {d.status !== "online" ? " (offline)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-1">Folders</p>
            <div className="flex flex-wrap gap-3">
              {(overview?.folders ?? ["Documents", "Desktop", "Pictures"]).map((name) => (
                <label key={name} className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={folders.includes(name)}
                    onChange={() => toggleFolder(name)}
                    className="accent-green-600"
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(schedule?.enabled)}
              disabled={busy || !agentId}
              onChange={(e) => handleSchedule(e.target.checked)}
              className="accent-green-600"
            />
            Back up this computer automatically every week
          </label>

          <button
            onClick={handleStart}
            disabled={busy || deviceBusy || !agentId || selectedDevice?.status !== "online"}
            className="w-full flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold text-xs py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {busy || deviceBusy ? <Spinner /> : null}
            {deviceBusy ? "Backup in progress…" : busy ? "Starting…" : "Back Up Now"}
          </button>
          {selectedDevice && selectedDevice.status !== "online" && (
            <p className="text-[11px] text-gray-500 -mt-2">This computer is offline. Turn it on to back it up.</p>
          )}
        </>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
          <p className="text-[12px] text-red-700 leading-snug">{error}</p>
        </div>
      )}
      {notice && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
          <p className="text-[12px] text-blue-700 leading-snug">{notice}</p>
        </div>
      )}

      {!!overview?.backups.length && (
        <div className="border-t border-gray-300 pt-2.5 flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Your Backups</p>
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            {overview.backups.map((b) => (
              <div key={b.id} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-gray-800 truncate">
                      {b.hostname} · {b.folders.join(", ")}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(b.createdAt).toLocaleString()}
                      {b.trigger === "schedule" ? " · automatic" : ""}
                      {b.status === "completed" ? ` · ${formatSize(b.size)}` : ""}
                      {b.status === "completed" && b.fileCount != null ? ` · ${b.fileCount} files` : ""}
                      {b.skippedCount ? ` · ${b.skippedCount} skipped` : ""}
                    </p>
                  </div>
                  {b.status === "completed" ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDownload(b)}
                        disabled={busyId === b.id}
                        className="text-[11px] font-semibold text-green-700 hover:text-green-800 disabled:opacity-50"
                      >
                        {busyId === b.id ? "…" : "Download"}
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        disabled={busyId === b.id}
                        className="text-[11px] font-semibold text-gray-500 hover:text-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ) : b.status === "failed" ? (
                    <button
                      onClick={() => handleDelete(b)}
                      disabled={busyId === b.id}
                      className="shrink-0 text-[11px] font-semibold text-gray-500 hover:text-red-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="shrink-0 flex items-center gap-1 text-[11px] text-blue-600">
                      <Spinner />
                      {STATUS_LABEL[b.status]}
                    </span>
                  )}
                </div>
                {b.status === "running" && b.size > 0 && (
                  <p className="text-[10px] text-blue-600 mt-0.5">{formatSize(b.size)} uploaded</p>
                )}
                {b.status === "failed" && b.error && <p className="text-[10px] text-red-600 mt-0.5">{b.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
