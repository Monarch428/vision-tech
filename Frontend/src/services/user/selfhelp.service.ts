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

export const startTool = async (toolId: string) => {
  const response = await API.post("/self-help/start-tool", {
    toolId,
  });

  return response.data;
};

export const getToolStatus = async (id: string) => {
  const response = await API.get(`/self-help/tool-status/${id}`);

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

export interface EndpointLinkStatus {
  linked: boolean;
  endpointName?: string;
}

// yet?" check, without triggering a scan.
export const checkEndpointLinked = async (): Promise<EndpointLinkStatus> => {
  try {
    const res = await API.get("/self-help/scan-report-debug");
    if (res.data?.result) {
      return { linked: true, endpointName: res.data.result.name };
    }
    return { linked: false };
  } catch {
    // 400 = "No linked endpoint" from the backend — treat any failure here
    // as "not linked" rather than surfacing it as a hard error.
    return { linked: false };
  }
};

export interface CreateInstallPackageResponse {
  success: boolean;
  packageId?: string;
  packageName?: string;
  links: unknown;
  reused?: boolean;
}

// POST /self-help/create-install-package
export const createInstallPackage = async (): Promise<CreateInstallPackageResponse> => {
  const response = await API.post<CreateInstallPackageResponse>("/self-help/create-install-package");
  return response.data;
};
