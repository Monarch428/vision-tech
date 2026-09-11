import { useEffect, useMemo, useState } from "react";
import { getDevices, generateInstaller } from "../../services/user/rmm.service";
import type { Device, GenerateInstallerPayload } from "../../services/user/rmm.service";
import { currentUserRole } from "../../services/admin/userManagement.service";
import {
  listCompanyEndpoints,
  getCurrentUser,
  type CompanyEndpoint,
} from "../../services/user/selfhelp.service";

// ─── Icons ────────────────────────────────────────────────────────────────────

const MonitorIcon = ({ color = "#374151", size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <rect x="2" y="3" width="20" height="14" rx="2" strokeLinejoin="round" />
    <path d="M8 21h8M12 17v4" strokeLinecap="round" />
  </svg>
);

const CheckCircleIcon = ({ color = "#16a34a", size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AlertTriangleIcon = ({ color = "#ea580c", size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v5" strokeLinecap="round" />
    <circle cx="12" cy="16" r="0.9" fill={color} stroke="none" />
  </svg>
);

const ActivityIcon = ({ color = "#16a34a", size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <path d="M2 12h4l2 8 4-16 2 8h8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LaptopIcon = ({ color = "#16a34a", size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <rect x="4" y="4" width="16" height="10" rx="1.5" strokeLinejoin="round" />
    <path d="M2 18h20l-1.5-3h-17L2 18z" strokeLinejoin="round" />
  </svg>
);

const DesktopIcon = ({ color = "#16a34a", size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <rect x="3" y="4" width="18" height="12" rx="1.5" strokeLinejoin="round" />
    <path d="M8 20h8M12 16v4" strokeLinecap="round" />
  </svg>
);

const CpuIcon = ({ color = "#6b7280", size = 14 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
    <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" strokeLinecap="round" />
  </svg>
);

const MemoryIcon = ({ color = "#6b7280", size = 14 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <rect x="3" y="6" width="18" height="12" rx="1.5" />
    <path d="M7 6v12M11 6v12M15 6v12" strokeLinecap="round" />
  </svg>
);

const StorageIcon = ({ color = "#6b7280", size = 14 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="7" cy="12" r="1" fill={color} stroke="none" />
    <circle cx="11" cy="12" r="1" fill={color} stroke="none" />
  </svg>
);

const HeartPulseIcon = ({ color = "#6b7280", size = 14 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <path d="M2 12h4l2 6 4-12 2 6h8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const XIcon = ({ color = "#6b7280", size = 18 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
  </svg>
);

const TrashIcon = ({ color = "#9ca3af", size = 16 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <path d="M3 6h18" strokeLinecap="round" />
    <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" strokeLinecap="round" />
  </svg>
);

const CopyIcon = ({ color = "currentColor", size = 14 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <rect x="9" y="9" width="12" height="12" rx="2" strokeLinejoin="round" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SpinnerIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="animate-spin"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
  </svg>
);

// ─── Toggle switch (visual only — Tactical devices aren't controlled via this app) ──

function Toggle({
  checked,
  disabled,
  title,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0" title={title}>
      {label && <span className="text-xs sm:text-sm font-medium text-gray-800 whitespace-nowrap">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
          checked ? "bg-gray-900" : "bg-gray-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function usageColor(value: number) {
  if (value >= 85) return "bg-red-500";
  if (value >= 60) return "bg-orange-500";
  return "bg-green-500";
}

function computeHealth(cpu: number, memory: number, storage: number) {
  const cpuScore = 100 - cpu;
  const memScore = 100 - memory;
  const storageScore = 100 - storage;
  return Math.round((cpuScore + memScore + storageScore) / 3);
}

function inferDeviceType(_platform?: string): "Laptop" | "Desktop" {
  return "Desktop";
}

// Loose normalization for cross-referencing a GravityZone endpoint name
// against a Tactical RMM device's hostname/name — trims, lowercases, and
// drops a trailing domain suffix (e.g. "DESKTOP-3FH844G.corp.local" →
// "desktop-3fh844g") so minor formatting differences between the two
// agents' reported names don't break the match.
function normalizeDeviceName(value?: string | null): string {
  if (!value) return "";
  return value.trim().toLowerCase().split(".")[0];
}

// Detailed, OS-specific steps for running the generated installer command
// on the target device.
function getRunInstructions(plat: GenerateInstallerPayload["plat"]): {
  terminalName: string;
  steps: string[];
} {
  if (plat === "windows") {
    return {
      terminalName: "Command Prompt (Admin)",
      steps: [
        'Search for "cmd", right-click Command Prompt, choose "Run as administrator".',
        "Copy the command below.",
        "Paste it into the black window and press Enter.",
        "Wait about a minute for it to finish — don't close the window.",
        "Done! The device shows up in your list here shortly after.",
      ],
    };
  }
  if (plat === "linux") {
    return {
      terminalName: "Terminal",
      steps: [
        "Open a terminal on the machine (directly or over SSH).",
        "Copy the command below.",
        "Paste it in and press Enter. It may ask for your password.",
        "Wait about a minute for it to finish.",
        "Done! The device shows up in your list here shortly after.",
      ],
    };
  }
  // darwin / macOS
  return {
    terminalName: "Terminal",
    steps: [
      'Press Cmd+Space, type "Terminal", press Enter to open it.',
      "Copy the command below.",
      "Paste it in and press Enter. It may ask for your password.",
      "Wait about a minute for it to finish.",
      "Done! The device shows up in your list here shortly after.",
    ],
  };
}

function StatBar({
  icon,
  label,
  value,
  barColorClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  barColorClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs sm:text-sm text-gray-700 mb-1.5">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="font-semibold text-gray-900">{value}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColorClass} transition-all duration-300`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function formatLastSeen(lastSeen?: string) {
  if (!lastSeen) return "Never";
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ─── DeviceCard ─────────────────────────────────────────────────────────────

function DeviceCard({ device }: { device: Device }) {
  const isOnline = device.status === "online";
  const deviceIconColor = isOnline ? "#16a34a" : "#9ca3af";
  const health = computeHealth(device.cpu, device.memory, device.storage);

  return (
    <div className="bg-white border border-gray-400 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${isOnline ? "bg-green-50" : "bg-gray-100"}`}>
            {device.type === "Laptop" ? (
              <LaptopIcon color={deviceIconColor} />
            ) : (
              <DesktopIcon color={deviceIconColor} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">{device.name}</h3>
              <span
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                  isOnline ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {isOnline && <CheckCircleIcon size={12} />}
                {device.status}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
              {device.type} • Last seen: {formatLastSeen(device.lastSeen)}
              {device.clientName ? ` • ${device.clientName}` : ""}
              {device.siteName ? ` / ${device.siteName}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:self-start">
          <Toggle
            label="Monitoring"
            checked={true}
            disabled
            title="Monitoring is managed by the Tactical RMM agent, not from this dashboard"
          />
          <button
            type="button"
            disabled
            title="Remove this device from Tactical RMM directly (uninstall the agent, or use the Tactical dashboard)"
            className="p-1.5 rounded-lg cursor-not-allowed shrink-0"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-4">
        <StatBar icon={<HeartPulseIcon />} label="Health" value={health} barColorClass="bg-gray-900" />
        <StatBar icon={<CpuIcon />} label="CPU" value={device.cpu} barColorClass={usageColor(device.cpu)} />
        <StatBar icon={<MemoryIcon />} label="Memory" value={device.memory} barColorClass={usageColor(device.memory)} />
        <StatBar icon={<StorageIcon />} label="Storage" value={device.storage} barColorClass={usageColor(device.storage)} />
      </div>
    </div>
  );
}

// ─── StatCard ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueColorClass,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  valueColorClass?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-400 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-gray-600 truncate">{label}</p>
        <p className={`text-xl sm:text-2xl font-bold mt-1 ${valueColorClass ?? "text-gray-900"}`}>{value}</p>
      </div>
      <div className="shrink-0">{icon}</div>
    </div>
  );
}

// ─── AddDeviceModal — now generates a real installer via the backend ────────

type ModalStep = "form" | "result";

function AddDeviceModal({ onClose, onDeviceLikelyAdded }: { onClose: () => void; onDeviceLikelyAdded: () => void }) {
  const [step, setStep] = useState<ModalStep>("form");

  const [plat, setPlat] = useState<GenerateInstallerPayload["plat"]>("windows");
  // Only ever adding everyday computers here, not servers — no need to ask.
  const agentType: GenerateInstallerPayload["agentType"] = "workstation";
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [arch, setArch] = useState<GenerateInstallerPayload["arch"]>("amd64");
  const [rdp, setRdp] = useState(true);
  const [ping, setPing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Client/Site are fixed for this deployment — configured once via
  // environment variables rather than typed in by whoever adds a device.
  const CLIENT_ID = import.meta.env.VITE_CLIENT_ID as string | undefined;
  const SITE_ID = import.meta.env.VITE_SITE_ID as string | undefined;

  const handleGenerate = async () => {
    if (!CLIENT_ID || !SITE_ID) {
      setError("This app isn't fully configured yet — contact support.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const data = await generateInstaller({
        clientId: CLIENT_ID,
        siteId: SITE_ID,
        plat,
        agentType,
        arch,
        rdp,
        ping,
      });
      setResult(data);
      setStep("result");
    } catch (err: any) {
      console.error("generateInstaller failed:", err);
      const backendMsg =
        err?.response?.data?.tacticalResponse ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to generate installer.";
      setError(typeof backendMsg === "string" ? backendMsg : JSON.stringify(backendMsg));
    } finally {
      setSubmitting(false);
    }
  };

  const installCommand: string | null =
    result?.cmd ?? result?.command ?? result?.installCommand ?? null;
  const downloadUrl: string | null =
    result?.url ?? result?.downloadUrl ?? result?.download_url ?? null;

  const handleCopy = async () => {
    if (!installCommand) return;
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add New Device</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <XIcon />
          </button>
        </div>

        {step === "form" && (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Pick the operating system and we'll generate a one-line install command
              for the new device.
            </p>

            <div className="flex flex-col gap-5">
              {/* Operating system */}
              <div>
                <label className="text-sm font-semibold text-gray-900 mb-2 block">
                  What operating system does it run?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["windows", "linux", "darwin"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlat(p)}
                      className={`text-center border rounded-xl py-3 text-sm font-medium transition-colors ${
                        plat === p
                          ? "border-gray-900 bg-gray-50 text-gray-900"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {p === "windows" ? "Windows" : p === "linux" ? "Linux" : "macOS"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced options — most people never need to touch these */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  {showAdvanced ? "Hide advanced options" : "Show advanced options"}
                </button>

                {showAdvanced && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">
                        Processor type
                      </label>
                      <div className="flex gap-4">
                        {(["amd64", "386"] as const).map((a) => (
                          <label key={a} className="flex items-center gap-1.5 text-sm text-gray-700">
                            <input type="radio" checked={arch === a} onChange={() => setArch(a)} />
                            {a === "amd64" ? "64-bit (most computers)" : "32-bit (older computers)"}
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-center gap-1.5 text-sm text-gray-700">
                      <input type="checkbox" checked={rdp} onChange={(e) => setRdp(e.target.checked)} />
                      Allow remote desktop access to this device
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-gray-700">
                      <input type="checkbox" checked={ping} onChange={(e) => setPing(e.target.checked)} />
                      Allow this device to respond to network pings
                    </label>
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                onClick={handleGenerate}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 mt-1"
              >
                {submitting && <SpinnerIcon />}
                {submitting ? "Generating..." : "Generate Install Command"}
              </button>
            </div>
          </>
        )}

        {step === "result" && (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Run this on the new device to add it — takes about a minute.
            </p>

            <p className="text-sm text-gray-800 font-semibold mb-3">Install command:</p>

            {installCommand ? (
              <div className="bg-gray-900 text-gray-100 text-[11px] sm:text-xs rounded-lg p-3 font-mono break-all mb-2">
                {installCommand}
              </div>
            ) : (
              <div className="bg-yellow-50 text-yellow-800 text-xs rounded-lg p-3 mb-2">
                No install command field found in the response. Raw response below — check
                which key actually holds the command and adjust the frontend mapping.
                <pre className="mt-2 whitespace-pre-wrap break-all text-[10px]">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}

            {(() => {
              const { terminalName, steps } = getRunInstructions(plat);
              return (
                <div className="mb-4 mt-4">
                  <p className="text-sm text-gray-800 font-semibold mb-1">
                    How to run it
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    You'll need: <span className="font-medium text-gray-700">{terminalName}</span>
                  </p>
                  <ol className="flex flex-col gap-2.5">
                    {steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-semibold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-snug">{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })()}

            <div className="flex gap-2 mb-4">
              {installCommand && (
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 text-gray-800 font-medium text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <CopyIcon />
                  {copied ? "Copied!" : "Copy Command"}
                </button>
              )}
              {downloadUrl && (
                
                  <a href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 text-gray-800 font-medium text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Download Agent
                </a>
              )}
            </div>

            <p className="text-[11px] text-gray-500 mb-4">
              This token is time-limited and grants install access — avoid sharing it outside
              this install. Once the command finishes running on the target device, it should
              appear in your device list within a minute.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStep("form");
                  setResult(null);
                }}
                className="flex-1 border border-gray-300 text-gray-800 font-medium text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Generate Another
              </button>
              <button
                onClick={() => {
                  onDeviceLikelyAdded();
                  onClose();
                }}
                className="flex-1 bg-gray-900 text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DeviceIpFilter ───────────────────────────────────────────────────────
// Replaces the old text-based Client Name / Site Name / Hostname filters.
//
// Tactical RMM's /devices response has no IP field, so the IP data comes
// from GravityZone instead (listCompanyEndpoints — same as the Self-Help
// antivirus tool uses). We match GravityZone endpoints to the user's IP,
// then cross-reference by (normalized) name/hostname to find which
// Tactical devices those correspond to.

function DeviceIpFilter({
  loading,
  matchedDevices,
  selectedDeviceId,
  onSelectedDeviceIdChange,
  endpointIpByDeviceId,
}: {
  loading: boolean;
  matchedDevices: Device[];
  selectedDeviceId: string;
  onSelectedDeviceIdChange: (v: string) => void;
  endpointIpByDeviceId: Map<string, string>;
}) {
  return (
    <div className="mt-6 bg-white border border-gray-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
      <div>
        <p className="text-md font-bold text-gray-900">Device</p>
        <p className="text-sm text-gray-500">
          {loading
            ? "Loading devices…"
            : `${matchedDevices.length} device${matchedDevices.length === 1 ? "" : "s"} match your IP address`}
        </p>
      </div>
      <select
        value={selectedDeviceId}
        onChange={(e) => onSelectedDeviceIdChange(e.target.value)}
        disabled={loading || !matchedDevices.length}
        className="w-full sm:w-72 px-4 py-2.5 rounded-xl bg-gray-100 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 appearance-none cursor-pointer"
      >
        {loading && <option value="">Loading devices…</option>}

        {!loading && !matchedDevices.length && (
          <option value="">No matching device found for your IP</option>
        )}

        {!loading && matchedDevices.length > 0 && (
          <option value="">All matching devices</option>
        )}

        {matchedDevices.map((d) => {
          const ip = endpointIpByDeviceId.get(d._id);
          return (
            <option key={d._id} value={d._id}>
              {d.hostname ?? d.name} {ip ? `(${ip})` : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function RMM() {
  const [rmmEnabled] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    currentUserRole()
      .then((res) => setRole(res.data.data.role))
      .catch(() => setRole(null));
  }, []);
  // "support" is the elevated/system role in this app's User schema
  // (enum: ['admin', 'user', 'support']) — there is no separate "system" role.
  // Stat cards / RMM banner are admin-only — everyone else (including
  // support) just sees the IP-matched device list below.
  const isAdminRole = role === "admin";

  // ── IP data source: GravityZone company endpoints (Tactical devices carry no IP) ──
  const [companyEndpoints, setCompanyEndpoints] = useState<CompanyEndpoint[]>([]);
  const [userIps, setUserIps] = useState<string[]>([]);
  const [ipDataLoading, setIpDataLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [endpoints, currentUser] = await Promise.all([
          listCompanyEndpoints().catch(() => []),
          getCurrentUser().catch(() => null),
        ]);
        setCompanyEndpoints(endpoints);
        setUserIps(currentUser?.ipAddresses ?? []);
      } finally {
        setIpDataLoading(false);
      }
    })();
  }, []);

  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const [devicesError, setDevicesError] = useState<string | null>(null);

  const loadDevices = async () => {
    try {
      const data = await getDevices();
      setDevices(
        data.map((d) => ({
          ...d,
          type: d.type ?? inferDeviceType(d.platform),
        }))
      );
      setDevicesError(null);
    } catch (err: any) {
      console.error("Failed to load devices:", err);
      // A Tactical RMM API timeout/500 leaves `devices` at its previous
      // (often empty) value with no visible signal — surface it instead of
      // letting the page silently look like "no devices match your IP".
      setDevicesError(
        err?.response?.status === 500
          ? "Couldn't reach the RMM service right now (it may be slow or temporarily down). Devices shown below may be out of date."
          : "Failed to load devices. Retrying automatically."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, []);

  // GravityZone endpoints whose IP matches the current user.
  const matchedEndpoints = useMemo(
    () => companyEndpoints.filter((ep) => ep.ip && userIps.includes(ep.ip)),
    [companyEndpoints, userIps]
  );

  // Cross-reference those endpoints to Tactical devices by normalized name,
  // and remember which endpoint IP corresponds to which device (for display).
  //
  // Applies to every role, including "support" — unlike the stat cards and
  // RMM banner above (which stay support-only), the device list itself is
  // always IP-matched now, matching how Antivirus/Self-Help behave.
  //
  // IMPORTANT: normalizeDeviceName("") === normalizeDeviceName(undefined) === "".
  // Without an explicit guard, any device with a missing hostname/name would
  // match against any endpoint with a missing name (both normalize to ""),
  // which silently pulled in unrelated devices. Empty keys are skipped below
  // so a name can only ever match a real, non-empty name.
  const { ipMatchedDevices, endpointIpByDeviceId } = useMemo(() => {
    const ipByName = new Map<string, string>();
    for (const ep of matchedEndpoints) {
      const key = normalizeDeviceName(ep.name);
      if (key && ep.ip) ipByName.set(key, ep.ip);
    }

    const ipById = new Map<string, string>();
    const result = devices.filter((d) => {
      const key = normalizeDeviceName(d.hostname ?? d.name);
      if (!key) return false; // never match on an unknown/empty name
      const ip = ipByName.get(key);
      if (!ip) return false;
      ipById.set(d._id, ip);
      return true;
    });
    return { ipMatchedDevices: result, endpointIpByDeviceId: ipById };
  }, [devices, matchedEndpoints, userIps, companyEndpoints]);

  const filteredDevices = useMemo(() => {
    if (selectedDeviceId) {
      return ipMatchedDevices.filter((d) => d._id === selectedDeviceId);
    }

    return ipMatchedDevices;
  }, [ipMatchedDevices, selectedDeviceId]);

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === "online").length;
    const monitored = total;
    const healths = devices.map((d) => computeHealth(d.cpu, d.memory, d.storage));
    const warnings = devices.filter(
      (d, i) => healths[i] < 80 || d.status === "offline"
    ).length;
    const avgHealth = healths.length
      ? Math.round(healths.reduce((sum, h) => sum + h, 0) / healths.length)
      : 0;
    return { total, online, monitored, warnings, avgHealth };
  }, [devices]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Remote Monitoring &amp; Management</h1>
          <p className="text-gray-700 mt-1 text-sm sm:text-md">
            Monitor device health and performance in real-time
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto border border-green-600 text-green-700 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-green-50 transition-colors shrink-0"
        >
          Add New Device
        </button>
      </div>

      {/* RMM Service Active banner — admin only */}
      {isAdminRole && (
        <div className="mt-6 bg-gradient-to-r from-green-50 to-white border border-green-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-green-100 p-2.5 rounded-xl shrink-0">
              <ActivityIcon />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 text-sm sm:text-base">RMM Service Active</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Monitoring {stats.monitored} of {stats.total} devices
              </p>
            </div>
          </div>
          <Toggle label="Enable RMM" checked={rmmEnabled} />
        </div>
      )}

      {/* Stat cards — admin only */}
      {isAdminRole && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <StatCard label="Total Devices" value={stats.total} icon={<MonitorIcon color="#9ca3af" size={24} />} />
          <StatCard label="Online" value={stats.online} valueColorClass="text-green-600" icon={<CheckCircleIcon size={24} />} />
          <StatCard label="Warnings" value={stats.warnings} valueColorClass="text-red-600" icon={<AlertTriangleIcon size={24} />} />
          <StatCard label="Avg Health" value={`${stats.avgHealth}%`} valueColorClass="text-green-600" icon={<ActivityIcon color="#3b82f6" size={24} />} />
        </div>
      )}

      {devicesError && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-xl">
          {devicesError}
        </div>
      )}

      {/* Device filter — IP-matched select box, for every role */}
      <DeviceIpFilter
        loading={loading || ipDataLoading}
        matchedDevices={ipMatchedDevices}
        selectedDeviceId={selectedDeviceId}
        onSelectedDeviceIdChange={setSelectedDeviceId}
        endpointIpByDeviceId={endpointIpByDeviceId}
      />
      {isAdminRole && (
        <p className="mt-2 text-xs text-gray-400">
          Total Devices / Online / Warnings / Avg Health above still reflect all {stats.total} devices across the company.
        </p>
      )}

      {/* Devices */}
      <div className="flex flex-col gap-4 mt-6">
        {loading ? (
          <p className="text-sm text-gray-500">Loading devices...</p>
        ) : filteredDevices.length === 0 ? (
          <p className="text-sm text-gray-500">
            {ipMatchedDevices.length === 0
              ? "No company device matches your current IP address."
              : "No device matches this selection."}
          </p>
        ) : (
          filteredDevices.map((device) => <DeviceCard key={device._id} device={device} />)
        )}
      </div>

      {showAddModal && (
        <AddDeviceModal
          onClose={() => setShowAddModal(false)}
          onDeviceLikelyAdded={() => {
            setTimeout(loadDevices, 3000);
          }}
        />
      )}
    </div>
  );
}