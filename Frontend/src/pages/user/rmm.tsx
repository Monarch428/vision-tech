import { useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceStatus = "online" | "offline";
type DeviceType = "Laptop" | "Desktop";

interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  lastSeen: string;
  monitoring: boolean;
  health: number;
  cpu: number;
  memory: number;
  storage: number;
}

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
    <path
      d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"
      strokeLinecap="round"
    />
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

// ─── Toggle switch ──────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {label && <span className="text-xs sm:text-sm font-medium text-gray-800 whitespace-nowrap">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
          checked ? "bg-gray-900" : "bg-gray-300"
        }`}
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

// ─── Progress bar helpers ───────────────────────────────────────────────────

function usageColor(value: number) {
  if (value >= 85) return "bg-red-500";
  if (value >= 60) return "bg-orange-500";
  return "bg-green-500";
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

// ─── Mock data ──────────────────────────────────────────────────────────────

const INITIAL_DEVICES: Device[] = [
  {
    id: "work-laptop",
    name: "Work Laptop",
    type: "Laptop",
    status: "online",
    lastSeen: "Just now",
    monitoring: true,
    health: 95,
    cpu: 45,
    memory: 62,
    storage: 78,
  },
  {
    id: "home-desktop",
    name: "Home Desktop",
    type: "Desktop",
    status: "online",
    lastSeen: "2 minutes ago",
    monitoring: true,
    health: 88,
    cpu: 32,
    memory: 54,
    storage: 65,
  },
  {
    id: "office-pc",
    name: "Office PC",
    type: "Desktop",
    status: "offline",
    lastSeen: "3 hours ago",
    monitoring: false,
    health: 72,
    cpu: 0,
    memory: 0,
    storage: 58,
  },
];

// ─── DeviceCard ─────────────────────────────────────────────────────────────

function DeviceCard({
  device,
  onToggleMonitoring,
}: {
  device: Device;
  onToggleMonitoring: (id: string, value: boolean) => void;
}) {
  const isOnline = device.status === "online";

  return (
    <div className="bg-white border border-gray-400 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="bg-green-50 p-2 sm:p-2.5 rounded-xl shrink-0">
            {device.type === "Laptop" ? <LaptopIcon /> : <DesktopIcon />}
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
              {device.type} • Last seen: {device.lastSeen}
            </p>
          </div>
        </div>

        <div className="sm:self-start">
          <Toggle
            label="Monitoring"
            checked={device.monitoring}
            onChange={(v) => onToggleMonitoring(device.id, v)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-4">
        <StatBar
          icon={<HeartPulseIcon />}
          label="Health"
          value={device.health}
          barColorClass="bg-gray-900"
        />
        <StatBar
          icon={<CpuIcon />}
          label="CPU"
          value={device.cpu}
          barColorClass={usageColor(device.cpu)}
        />
        <StatBar
          icon={<MemoryIcon />}
          label="Memory"
          value={device.memory}
          barColorClass={usageColor(device.memory)}
        />
        <StatBar
          icon={<StorageIcon />}
          label="Storage"
          value={device.storage}
          barColorClass={usageColor(device.storage)}
        />
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

// ─── Page ───────────────────────────────────────────────────────────────────

export default function RMM() {
  const [rmmEnabled, setRmmEnabled] = useState(true);
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);

  const handleToggleMonitoring = (id: string, value: boolean) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, monitoring: value } : d))
    );
  };

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === "online").length;
    const monitored = devices.filter((d) => d.monitoring).length;
    const warnings = devices.filter((d) => d.health < 80 || d.status === "offline").length;
    const avgHealth = Math.round(
      devices.reduce((sum, d) => sum + d.health, 0) / (devices.length || 1)
    );
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
        <button className="w-full sm:w-auto border border-green-600 text-green-700 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-green-50 transition-colors shrink-0">
          Add New Device
        </button>
      </div>

      {/* RMM Service Active banner */}
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
        <Toggle label="Enable RMM" checked={rmmEnabled} onChange={setRmmEnabled} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
        <StatCard
          label="Total Devices"
          value={stats.total}
          icon={<MonitorIcon color="#9ca3af" size={24} />}
        />
        <StatCard
          label="Online"
          value={stats.online}
          valueColorClass="text-green-600"
          icon={<CheckCircleIcon size={24} />}
        />
        <StatCard
          label="Warnings"
          value={stats.warnings}
          valueColorClass="text-red-600"
          icon={<AlertTriangleIcon size={24} />}
        />
        <StatCard
          label="Avg Health"
          value={`${stats.avgHealth}%`}
          valueColorClass="text-green-600"
          icon={<ActivityIcon color="#3b82f6" size={24} />}
        />
      </div>

      {/* Devices */}
      <div className="flex flex-col gap-4 mt-6">
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onToggleMonitoring={handleToggleMonitoring}
          />
        ))}
      </div>
    </div>
  );
}