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
  type: DeviceType;      // derived client-side from platform, see helper below
  hostname?: string;
  platform?: string;
  status: DeviceStatus;
  cpu: number;
  memory: number;
  storage: number;
  lastSeen?: string;
}

export const getDevices = async (): Promise<Device[]> => {
  const response = await API.get<{ success: boolean; devices: Device[] }>("/devices");
  return response.data.devices;
};

export const getDevice = async (id: string): Promise<Device> => {
  const response = await API.get<{ success: boolean; device: Device }>(`/devices/${id}`);
  return response.data.device;
};

export const runScriptOnDevice = async (
  deviceId: string,
  scriptId: number,
  args: string[] = [],
  timeout = 90
): Promise<unknown> => {
  const response = await API.post<{ success: boolean; result: unknown }>(
    `/devices/${deviceId}/run-script`,
    { scriptId, args, timeout }
  );
  return response.data.result;
};

export const runCommandOnDevice = async (
  deviceId: string,
  cmd: string,
  shell: "powershell" | "cmd" | "python" = "powershell",
  timeout = 30
): Promise<unknown> => {
  const response = await API.post<{ success: boolean; result: unknown }>(
    `/devices/${deviceId}/run-command`,
    { cmd, shell, timeout }
  );
  return response.data.result;
};

export interface GenerateInstallerPayload {
  clientId: string;
  siteId: string;
  plat?: string;       // "windows" | "linux" | "darwin"
  agentType?: string;  // "server" | "workstation"
  arch?: string;       // "amd64" | "386"
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