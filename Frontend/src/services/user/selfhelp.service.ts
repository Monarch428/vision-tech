import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function startTool(toolId: string, deviceId?: string) {
  const res = await API.post("/self-help/start", { toolId, deviceId });
  return res.data;
}

export const getToolStatus = async (id: string) => {
  const response = await API.get(`/self-help/status/${id}`);
  return response.data;
};

export const getScanReport = () =>
  API.get('/self-help/bitdefender/scan-report');

export const startBackupJob = async () => {
    const response = await API.post('/self-help/backup');
    return response.data;
};

export const getReportDebug = () => API.get('/self-help/scan-report-debug');

// ─── Backup history / download ────────────────────────────────────────────

export interface BackupRecord {
  id: string;
  fileName: string;
  size: number | null;
  createdAt: string;
}

export const listBackups = async (): Promise<BackupRecord[]> => {
  const response = await API.get("/self-help/backups");
  return response.data.backups;
};

// Downloads via axios (not a plain <a href>) so the Authorization header
// from the interceptor is actually sent, then saves the blob client-side.
export const downloadBackup = async (id: string, fileName: string) => {
  const response = await API.get(`/self-help/backups/${id}/download`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export async function getEndpoints() {
  const res = await API.get("/self-help/endpoints"); // match your actual route
  return res.data.agents; // array of RMM agent objects
}


// ─── Bitdefender install ─────────────────────────────────────────────────

export interface BitdefenderDeviceStatus {
  rmmAgentId: string;
  hostname: string;
  installStatus: "not_installed" | "installing" | "installed" | "failed";
  bitdefenderEndpointId: string | null;
  installError?: string | null;
}

export const installBitdefender = async () => {
  const res = await API.post("/self-help/bitdefender/install");
  return res.data;
};

// ─── Bitdefender download link ────────────────────────────────────────────

export interface BitdefenderDownloadLinks {
  windows: string | null;
  linux: string | null;
  mac: string | null;
}

export const getBitdefenderDownloadLink = async (): Promise<BitdefenderDownloadLinks> => {
  const res = await API.get("/self-help/bitdefender/download-link");
  return res.data.links;
};

export const getBitdefenderInstallStatus = async (): Promise<BitdefenderDeviceStatus> => {
  const res = await API.get("/self-help/bitdefender/status");
  return res.data.device;
};