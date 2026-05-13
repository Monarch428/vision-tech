import { useState, useEffect } from "react";

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

const ChromeIcon = ({ color = "#16a34a" }: { color?: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
    <circle cx="12" cy="12" r="4" fill={color} />
    <path d="M12 8h8.5M7.5 16.5l4.25-7.36M4 16.5h8.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
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
    <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.5C16.5 22.15 20 17.25 20 12V6l-8-4z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
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

const TOOLS: Tool[] = [
  {
    id: "browser-cleanup",
    name: "Browser Cleanup",
    description: "Clear cache, cookies, and temporary files to improve browser performance",
    fullDescription: "This tool clears your browser's cache, cookies, and temporary internet files. Use it when experiencing slow browser performance or website loading issues.",
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
    fullDescription: "Resets network adapters and releases/renews IP configuration. Use this when experiencing internet connectivity problems or slow network speeds.",
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
    fullDescription: "Performs a quick scan of critical system areas for malware and threats. For a comprehensive scan, use the full antivirus service.",
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
    fullDescription: "Initiates a backup of your important files and documents. Regular backups protect your data from loss due to hardware failure or malware.",
    icon: <DriveIcon />,
    iconBg: "bg-green-50",
    instructionBg: "bg-orange-50",
    instructionText: "text-orange-700",
    instructionIconColor: "#ea580c",
  },
];

function ToolCard({ tool }: { tool: Tool }) {
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [progress, setProgress] = useState(0);

  const handleRun = () => {
    setStatus("running");
    setProgress(0);
  };

  const handleReset = () => {
    setStatus("idle");
    setProgress(0);
  };

  useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setStatus("completed");
          return 100;
        }
        return prev + 10;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-gray-900">{tool.name}</h3>
        <span
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
            status === "idle"
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
        <div className={`${tool.iconBg} p-2.5 rounded-xl shrink-0`}>
          {tool.icon}
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">{tool.description}</p>
      </div>

      {/* Progress (running only) */}
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

      {/* Actions */}
      {status === "idle" && (
        <button
          onClick={handleRun}
          className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
        >
          <PlayIcon />
          Run Tool
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
    </div>
  );
}

function InstructionCard({ tool }: { tool: Tool }) {
  const iconColor = tool.instructionIconColor;
  return (
    <div className={`${tool.instructionBg} rounded-2xl p-4 flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <span style={{ color: iconColor }}>{
          tool.id === "browser-cleanup" ? <ChromeIcon color={iconColor} /> :
          tool.id === "network-restart" ? <WifiIcon color={iconColor} /> :
          tool.id === "antivirus-scan" ? <ShieldIcon color={iconColor} /> :
          <DriveIcon color={iconColor} />
        }</span>
        <h4 className={`font-bold text-base ${tool.instructionText}`}>{tool.name}</h4>
      </div>
      <p className={`text-sm leading-relaxed ${tool.instructionText}`}>{tool.fullDescription}</p>
    </div>
  );
}

export default function SelfHelp() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Self-Help Tools Section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Self-Help Tools</h1>
          <p className="text-gray-500 mt-1 text-sm">Quick fixes and utilities to maintain your system</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {TOOLS.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>

        {/* Tool Instructions Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tool Instructions</h2>
          <p className="text-gray-500 mt-1 text-sm">Learn how to use these self-help tools effectively</p>

          <div className="flex flex-col gap-4 mt-6">
            {TOOLS.map((tool) => (
              <InstructionCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}