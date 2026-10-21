import axios from "axios";
import Cookies from "js-cookie";
import { clearCache } from "../../hooks/useCacheStorage";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      Cookies.remove("token");
      await clearCache();
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

// ─── Device types (backed by Tactical RMM agents) ───────────────────────────

export type DeviceStatus = "online" | "offline";
export type DeviceType = "Laptop" | "Desktop";

export interface Device {
  _id: string;
  deviceId: string;
  name: string;
  type: DeviceType;
  hostname?: string;
  platform?: string;
  status: DeviceStatus;
  // null when the device doesn't report it (CPU/memory come from Windows only)
  cpu: number | null;
  memory: number | null;
  storage: number | null;       // system drive (C: on Windows)
  storageDevice?: string | null;
  otherDiskWarning?: string | null; // e.g. "D: is 99% full"
  lastSeen?: string;
  siteId?: number | null;      // NEW
  clientId?: number | null;    // NEW
  clientName?: string | null;  // NEW
  siteName?: string | null;    // NEW
  // Tactical reports this as a single string per agent (e.g. "8CG2122G5R"),
  // present directly on the agent-list response — not an array.
  serialNumber?: string | null;
  // True when this device is beyond the owner's plan limit (flagged for staff).
  overLimit?: boolean;
  openAlerts?: number;
  metricsUpdatedAt?: string | null;
}

// Customer's plan limit; `max` is null for unlimited. Staff receive null.
export interface DeviceLimit {
  plan: string;
  max: number | null;
  used: number;
}

// `linked` is false when a customer's account has no RMM Site yet.
// `sync.stale` is true when device data couldn't be refreshed from the RMM for 10+ minutes.
export interface SyncStatus {
  lastSuccessAt: string | null;
  stale: boolean;
  lastError?: string | null;
}

export const getDevices = async (): Promise<{ devices: Device[]; linked: boolean; limit: DeviceLimit | null; sync: SyncStatus }> => {
  const response = await API.get<{ success: boolean; linked: boolean; limit: DeviceLimit | null; devices: Device[]; sync: SyncStatus }>("/devices");
  return { devices: response.data.devices, linked: response.data.linked, limit: response.data.limit, sync: response.data.sync };
};

// Uninstalls the monitoring agent from the computer.
export const removeDevice = async (id: string): Promise<{ message: string }> => {
  const response = await API.delete<{ success: boolean; message: string }>(`/devices/${encodeURIComponent(id)}`);
  return response.data;
};

export const getDevice = async (id: string): Promise<Device> => {
  const response = await API.get<{ success: boolean; device: Device }>(`/devices/${id}`);
  return response.data.device;
};

// The server chooses the Site (the customer's own); staff may pass siteId.
export interface GenerateInstallerPayload {
  siteId?: number;
  plat?: string;       // "windows" | "linux" | "darwin"
  agentType?: string;  // "server" | "workstation"
  arch?: string;       // "amd64" | "386" | "arm64" (arm64: macOS/Linux only)
  rdp?: boolean;
  ping?: boolean;
}

export interface GenerateInstallerResponse {
  success: boolean;
  cmd?: string;
  command?: string;
  url?: string;
  downloadUrl?: string;
  [key: string]: any; // shape isn't fully confirmed yet — see note below
}

export const generateInstaller = async (
  payload: GenerateInstallerPayload
): Promise<GenerateInstallerResponse> => {
  const response = await API.post<GenerateInstallerResponse>(
    "/devices/generate-installer",
    payload
  );
  return response.data;
};

export default API;
// ─── Site linking (staff) ───────────────────────────────────────────────────

export interface RmmSite {
  id: number;
  name: string;
  agentCount: number;
  linkedUser: { id: string; name: string; email: string } | null;
}

export const getRmmSites = async (): Promise<RmmSite[]> => {
  const response = await API.get<{ success: boolean; sites: RmmSite[] }>("/devices/sites");
  return response.data.sites;
};

export const linkRmmSite = async (userId: string, siteId: number) => {
  const response = await API.put("/devices/sites/link", { userId, siteId });
  return response.data;
};

export const unlinkRmmSite = async (userId: string) => {
  const response = await API.delete(`/devices/sites/link/${userId}`);
  return response.data;
};

// ─── Monitoring alerts ──────────────────────────────────────────────────────

export interface RmmAlert {
  id: string;
  agentId: string;
  hostname: string | null;
  type: "offline" | "diskspace" | "cpuload" | "memory" | "script" | "other";
  title: string;
  severity: "info" | "warning" | "error";
  status: "open" | "resolved";
  openedAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  customer?: { name: string; email: string };
}

export const getAlerts = async (status: "open" | "resolved" | "all" = "open"): Promise<RmmAlert[]> => {
  const response = await API.get<{ success: boolean; alerts: RmmAlert[] }>("/devices/alerts", { params: { status } });
  return response.data.alerts;
};

export const acknowledgeAlert = async (alertId: string) => {
  const response = await API.post(`/devices/alerts/${alertId}/acknowledge`);
  return response.data;
};

// ─── Device details and safe remote actions ────────────────────────────────

export interface DeviceAction {
  key: "restart" | "disk-cleanup" | "antivirus-scan";
  label: string;
  description: string;
  availableInSeconds: number;
}

export interface DeviceDetails {
  device: {
    id: string;
    hostname: string;
    status: string;
    platform: string;
    os: string;
    makeModel: string | null;
    cpuModel: string | null;
    totalRamGb: number | null;
    lastSeen: string | null;
    bootTime: string | null;
    needsReboot: boolean;
    loggedInUser: string | null;
    publicIp: string | null;
    localIps: string | null;
    serialNumber: string | null;
    siteName: string;
    disks: { device: string; total: string; used: string; free: string; percent: number }[];
    cpu: number | null;
    memory: number | null;
    metricsUpdatedAt: string | null;
    overLimit: boolean;
  };
  checks: { checkId: number; checkType: string; title: string; status: string; severity: string }[];
  software: { name: string; version: string; publisher: string; installDate: string; size: string }[];
  pendingUpdates: { kb: string; title: string; severity: string | null }[];
  alerts: { id: string; title: string; severity: string; status: string; openedAt: string; resolvedAt: string | null }[];
  actions: { action: string; status: string; error: string | null; createdAt: string; requestedBy: string }[];
  availableActions: DeviceAction[];
  remoteDesktopUrl: string | null;
}

export const getDeviceDetails = async (id: string): Promise<DeviceDetails> => {
  const response = await API.get<DeviceDetails & { success: boolean }>(`/devices/${encodeURIComponent(id)}/details`);
  return response.data;
};

export const runDeviceAction = async (id: string, action: DeviceAction["key"]): Promise<{ message: string }> => {
  const response = await API.post<{ success: boolean; message: string }>(
    `/devices/${encodeURIComponent(id)}/actions/${action}`,
    { confirm: true }
  );
  return response.data;
};

// ─── Staff console ──────────────────────────────────────────────────────────

export interface ConsoleDevice {
  id: string;
  hostname: string;
  platform: string | null;
  os: string | null;
  status: "online" | "offline";
  lastSeen: string | null;
  siteId: number;
  siteName: string | null;
  customer: { id: string; name: string; email: string; plan: string } | null;
  openAlerts: number;
  overLimit: boolean;
  storage: number | null;
}

export interface ConsoleData {
  summary: {
    total: number;
    online: number;
    offline: number;
    withAlerts: number;
    overLimit: number;
    unlinkedSites: number;
    lastSyncAt: string | null;
  };
  sites: { id: number; name: string; linkedUser: string | null }[];
  devices: ConsoleDevice[];
  tacticalUrl: string | null;
  sync: SyncStatus;
}

export interface ConsoleFilters {
  search?: string;
  status?: "" | "online" | "offline";
  siteId?: string;
  alerts?: boolean;
  overLimit?: boolean;
}

export const getConsole = async (filters: ConsoleFilters): Promise<ConsoleData> => {
  const params: Record<string, string> = {};
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.siteId) params.siteId = filters.siteId;
  if (filters.alerts) params.alerts = "open";
  if (filters.overLimit) params.overLimit = "true";
  const response = await API.get<ConsoleData & { success: boolean }>("/devices/console", { params });
  return response.data;
};

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  type: string;
  by: string | null;
  details: string;
}

export const getAuditLog = async (before?: string): Promise<AuditEntry[]> => {
  const response = await API.get<{ success: boolean; entries: AuditEntry[] }>("/devices/audit", {
    params: { limit: 50, ...(before ? { before } : {}) },
  });
  return response.data.entries;
};
