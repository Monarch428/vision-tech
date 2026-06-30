import { useState, useEffect, useRef } from "react";
import Cookies from "js-cookie";
import {
  startTool,
  getToolStatus,
  startBackupJob,
  getReportDebug
} from "../../services/user/selfhelp.service";
import { clearCache } from "../../hooks/useCacheStorage";

type ToolStatus = "idle" | "running" | "completed";

interface Tool {
  id: string;
  name: string;
  description: string;
  fullDescription: string;
  icon: React.ReactNode;
  iconBg: string;
  instructionBg: string;
  instructionText: string;
  instructionIconColor: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ChromeIcon = ({ color = "#16a34a" }: { color?: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
    <circle cx="12" cy="12" r="4" fill={color} />
    <path
      d="M12 8h8.5M7.5 16.5l4.25-7.36M4 16.5h8.5"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const WifiIcon = ({ color = "#16a34a" }: { color?: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M5 12.55a11 11 0 0 1 14 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="20" r="1" fill={color} />
  </svg>
);

const ShieldIcon = ({ color = "#16a34a" }: { color?: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.5C16.5 22.15 20 17.25 20 12V6l-8-4z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M9 12l2 2 4-4"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DriveIcon = ({ color = "#16a34a" }: { color?: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="20" height="12" rx="2" stroke={color} strokeWidth="1.8" />
    <path d="M2 10h20" stroke={color} strokeWidth="1.8" />
    <circle cx="7" cy="15" r="1" fill={color} />
    <circle cx="11" cy="15" r="1" fill={color} />
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
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

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6" strokeLinecap="round" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeLinecap="round" />
    <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" />
  </svg>
);

// ─── Tools config ─────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    id: "browser-cleanup",
    name: "Browser Cleanup",
    description: "Clear cache, cookies, and temporary files to improve browser performance",
    fullDescription:
      "This tool clears your browser's cache, cookies, and temporary internet files. Use it when experiencing slow browser performance or website loading issues.",
    icon: <ChromeIcon />,
    iconBg: "bg-green-50",
    instructionBg: "bg-blue-50",
    instructionText: "text-blue-700",
    instructionIconColor: "#3b82f6",
  },
  {
    id: "network-restart",
    name: "Network Restart",
    description: "Reset network adapters and renew IP configuration",
    fullDescription:
      "Resets network adapters and releases/renews IP configuration. Use this when experiencing internet connectivity problems or slow network speeds.",
    icon: <WifiIcon />,
    iconBg: "bg-green-50",
    instructionBg: "bg-purple-50",
    instructionText: "text-purple-700",
    instructionIconColor: "#7c3aed",
  },
  {
    id: "antivirus-scan",
    name: "Quick Antivirus Scan",
    description: "Run a quick scan of critical system areas",
    fullDescription:
      "Performs a quick scan of critical system areas for malware and threats. For a comprehensive scan, use the full antivirus service.",
    icon: <ShieldIcon />,
    iconBg: "bg-green-50",
    instructionBg: "bg-green-50",
    instructionText: "text-green-700",
    instructionIconColor: "#16a34a",
  },
  {
    id: "start-backup",
    name: "Start Backup",
    description: "Initiate a backup of your important files",
    fullDescription:
      "Initiates a backup of your important files and documents. Regular backups protect your data from loss due to hardware failure or malware.",
    icon: <DriveIcon />,
    iconBg: "bg-green-50",
    instructionBg: "bg-orange-50",
    instructionText: "text-orange-700",
    instructionIconColor: "#ea580c",
  },
];

// ─── Simulated progress helper ────────────────────────────────────────────────

function runSimulated(
  durationMs: number,
  intervalMs: number,
  onProgress: (p: number) => void,
  onComplete: () => void
): () => void {
  let current = 0;
  const steps = durationMs / intervalMs;

  const id = setInterval(() => {
    const remaining = 100 - current;
    const increment = Math.min(
      remaining,
      Math.max(1, Math.round((remaining / (steps * 0.4)) * (0.5 + Math.random())))
    );
    current = Math.min(100, current + increment);
    onProgress(current);

    if (current >= 100) {
      clearInterval(id);
      onComplete();
    }
  }, intervalMs);

  return () => clearInterval(id);
}

// ─── ToolCard ─────────────────────────────────────────────────────────────────

interface ToolCardProps {
  tool: Tool;
  onNetworkRestartComplete?: () => void;
  triggerRun?: number;
}

function ToolCard({ tool, onNetworkRestartComplete, triggerRun }: ToolCardProps) {
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [toolRecordId, setToolRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<any>(null);

  const simCleanupRef = useRef<(() => void) | null>(null);

  // Only antivirus polls the backend for real status
  const usesApi = tool.id === "antivirus-scan";

  // ── Start run ──────────────────────────────────────────────────────────────
  const startRun = async () => {
    setProgress(0);

    // ── Antivirus: real Bitdefender scan ─────────────────────────────────────
    if (usesApi) {
      try {
        setLoading(true);
        const response = await startTool(tool.id);
        setToolRecordId(response.tool._id);
        setStatus("running");
      } catch (error) {
        console.error("Antivirus start error:", error);
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Backup: real backup API ───────────────────────────────────────────────
    if (tool.id === "start-backup") {
      setStatus("running");
      setProgress(30);
      try {
        const result = await startBackupJob();
        setProgress(100);
        setStatus("completed");
        setBackupResult(result);
      } catch (err) {
        console.error("Backup failed:", err);
        setStatus("idle");
      }
      return;
    }

    // ── Browser-cleanup / Network-restart: simulated + backend log ───────────
    setStatus("running");

    // Fire-and-forget: log the tool run to backend (creates + completes DB record)
    startTool(tool.id).catch((err) =>
      console.error("Failed to log tool start to backend:", err)
    );

    if (tool.id === "browser-cleanup") {
      Cookies.remove("user");
      await clearCache();
    }

    simCleanupRef.current = runSimulated(
      8000,
      400,
      (p) => setProgress(p),
      () => {
        setStatus("completed");
        if (tool.id === "network-restart") {
          onNetworkRestartComplete?.();
        }
      }
    );
  };

  const handleRun = () => startRun();

  const handleReset = () => {
    simCleanupRef.current?.();
    simCleanupRef.current = null;
    setStatus("idle");
    setProgress(0);
    setBackupResult(null);
  };

  // ── External trigger (browser-cleanup auto-run after network-restart) ──────
  const prevTrigger = useRef(triggerRun ?? 0);
  useEffect(() => {
    if (triggerRun === undefined) return;
    if (triggerRun !== prevTrigger.current && triggerRun > 0) {
      prevTrigger.current = triggerRun;
      simCleanupRef.current?.();
      simCleanupRef.current = null;
      setStatus("idle");
      setProgress(0);
      setTimeout(() => startRun(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRun]);

  // In your antivirus component / page
  useEffect(() => {
    getReportDebug().then((res: { data: any; }) => console.log('BD Debug:', res.data));
  }, []);

  // ── Poll real status (antivirus only) ─────────────────────────────────────
  useEffect(() => {
    if (!usesApi || status !== "running" || !toolRecordId) return;

    const interval = setInterval(async () => {
      try {
        const res = await getToolStatus(toolRecordId);
        setProgress(res.data.progress);
        if (res.data.status === "completed" || res.data.status === "failed") {
          setStatus("completed");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Status poll error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, toolRecordId, usesApi]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => { simCleanupRef.current?.(); }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-gray-400 rounded-2xl p-5 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-gray-900">{tool.name}</h3>
        <span
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${status === "idle"
            ? "bg-gray-100 text-gray-600"
            : status === "running"
              ? "bg-blue-100 text-blue-600"
              : "bg-green-100 text-green-600"
            }`}
        >
          {status === "running" ? <SpinnerIcon size={12} /> : <PlayIcon />}
          {status}
        </span>
      </div>

      {/* Icon + Description */}
      <div className="flex items-start gap-3">
        <div className={`${tool.iconBg} p-2.5 rounded-xl shrink-0`}>{tool.icon}</div>
        <p className="text-md text-gray-700 mt-2 leading-relaxed">{tool.description}</p>
      </div>

      {/* Progress bar */}
      {status === "running" && (
        <div>
          <div className="flex justify-between text-sm font-medium text-gray-700 mb-1.5">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-800 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      {status === "idle" && (
        <button
          onClick={handleRun}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? <SpinnerIcon /> : <PlayIcon />}
          {loading ? "Starting..." : "Run Tool"}
        </button>
      )}

      {status === "running" && (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 bg-gray-500 text-white font-semibold text-sm py-3 rounded-xl cursor-not-allowed"
        >
          <SpinnerIcon />
          Running...
        </button>
      )}

      {status === "completed" && (
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-800 font-medium text-sm py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshIcon />
            Run Again
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center px-4 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <TrashIcon />
          </button>
        </div>
      )}

      {/* Backup report */}
      {tool.id === "start-backup" && status === "completed" && backupResult && (
        <div className="mt-3 border-t border-gray-400 pt-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Backup Report</p>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-sm font-semibold text-green-700">
              ✓{" "}
              {Array.isArray(backupResult.collections)
                ? `${backupResult.collections.length} collections backed up`
                : "Backup completed successfully"}
            </p>
            <p className="text-xs text-green-600 mt-1 break-all">
              {typeof backupResult.backupPath === "string"
                ? backupResult.backupPath
                : backupResult.message || "Backup saved"}
            </p>
            {Array.isArray(backupResult.collections) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {backupResult.collections.map((col: string) => (
                  <span
                    key={col}
                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
                  >
                    {col}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── InstructionCard ──────────────────────────────────────────────────────────

function InstructionCard({ tool }: { tool: Tool }) {
  const iconColor = tool.instructionIconColor;
  return (
    <div className={`${tool.instructionBg} rounded-2xl p-4 flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <span style={{ color: iconColor }}>
          {tool.id === "browser-cleanup" ? (
            <ChromeIcon color={iconColor} />
          ) : tool.id === "network-restart" ? (
            <WifiIcon color={iconColor} />
          ) : tool.id === "antivirus-scan" ? (
            <ShieldIcon color={iconColor} />
          ) : (
            <DriveIcon color={iconColor} />
          )}
        </span>
        <h4 className={`font-bold text-base ${tool.instructionText}`}>{tool.name}</h4>
      </div>
      <p className={`text-sm leading-relaxed ${tool.instructionText}`}>
        {tool.fullDescription}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SelfHelp() {
  const [browserCleanupTrigger, setBrowserCleanupTrigger] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold text-gray-900">Self-Help Tools</h1>
      <p className="text-gray-700 mt-1 text-md">
        Quick fixes and utilities to maintain your system
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {TOOLS.map((tool) => {
          if (tool.id === "browser-cleanup") {
            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                triggerRun={browserCleanupTrigger}
              />
            );
          }
          if (tool.id === "network-restart") {
            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                onNetworkRestartComplete={() =>
                  setBrowserCleanupTrigger((n) => n + 1)
                }
              />
            );
          }
          return <ToolCard key={tool.id} tool={tool} />;
        })}
      </div>

      {/* Tool Instructions */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-gray-900">Tool Instructions</h2>
        <p className="text-gray-700 mt-1 text-md">
          Learn how to use these self-help tools effectively
        </p>
        <div className="flex flex-col gap-4 mt-6">
          {TOOLS.map((tool) => (
            <InstructionCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  );
}