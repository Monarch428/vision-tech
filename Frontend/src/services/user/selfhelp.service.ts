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


// ─── Self-help tools ─────────────────────────────────────────────

export async function startTool(toolId: string) {
  const res = await API.post("/self-help/start", {
    toolId,
  });

  return res.data;
}


export const getToolStatus = async (id: string) => {
  const response = await API.get(
    `/self-help/status/${id}`
  );

  return response.data;
};


// ─── Antivirus scan report ───────────────────────────────────────

export const getScanReport = async () => {
  const response = await API.get(
    "/self-help/scan-report"
  );

  return response.data;
};


// ─── Backup ──────────────────────────────────────────────────────

export const startBackupJob = async () => {
  const response = await API.post(
    "/self-help/backup"
  );

  return response.data;
};


export interface BackupRecord {
  id: string;
  fileName: string;
  size: number | null;
  createdAt: string;
}


export const listBackups = async (): Promise<BackupRecord[]> => {
  const response = await API.get(
    "/self-help/backups"
  );

  return response.data.backups;
};


export const downloadBackup = async (
  id: string,
  fileName: string
) => {
  const response = await API.get(
    `/self-help/backups/${id}/download`,
    {
      responseType: "blob",
    }
  );

  const url = window.URL.createObjectURL(
    new Blob([response.data])
  );

  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);

  link.click();

  link.remove();

  window.URL.revokeObjectURL(url);
};


// ─── RMM endpoints ───────────────────────────────────────────────

export async function getEndpoints() {
  const res = await API.get(
    "/self-help/endpoints"
  );

  return res.data.agents;
}


// ─── Bitdefender ─────────────────────────────────────────────────

export interface BitdefenderDeviceStatus {
  hostname: string;

  installStatus:
    | "not_installed"
    | "installing"
    | "installed"
    | "failed";

  bitdefenderEndpointId: string | null;

  installError?: string | null;
}


export interface BitdefenderDownloadLinks {
  windows: string | null;
  linux: string | null;
  mac: string | null;
}


// Get installer
export const getBitdefenderDownloadLink =
  async (): Promise<BitdefenderDownloadLinks> => {

    const res = await API.get(
      "/self-help/bitdefender/download-link"
    );

    return res.data.links;
  };


// Register hostname after Bitdefender installation
export const registerBitdefenderHostname =
  async (hostname: string) => {

    const res = await API.post(
      "/self-help/bitdefender/register-hostname",
      {
        hostname,
      }
    );

    return res.data;
  };


// Check GravityZone installation status
export const getBitdefenderInstallStatus =
  async (): Promise<BitdefenderDeviceStatus | null> => {

    const res = await API.get(
      "/self-help/bitdefender/status"
    );

    return res.data.device;
  };


// ─── Debug ───────────────────────────────────────────────────────

export const getReportDebug = async (
  agentId: string
) => {

  const response = await API.get(
    "/self-help/report-data",
    {
      params: {
        agentId,
      },
    }
  );

  return response.data;
};

export interface BitdefenderEndpoint {
  id: string;
  name: string;
  ip?: string | null;
  macs?: string[];
}

export interface BitdefenderEndpointResponse {
  success: boolean;
  endpoint: BitdefenderEndpoint | null;
}

export const getBitdefenderEndpoint = async (
  localIp?: string | null
): Promise<BitdefenderEndpointResponse> => {
  const response = await API.get("/self-help/bitdefender/endpoint", {
    params: { localIp: localIp ?? undefined },
  });
  return response.data;
};

  export const runBitdefenderScan = async () => {
  const response = await API.post(
    "/self-help/bitdefender/scan"
  );

  return response.data;
}

export interface CompanyEndpoint {
  id: string;
  name: string;
  ip: string | null;
  os: string | null;
}

export const listCompanyEndpoints = async (): Promise<CompanyEndpoint[]> => {
  const res = await API.get("/self-help/bitdefender/company-endpoints");
  return res.data.endpoints;
};

export const runScanOnEndpoint = async (endpointId: string) => {
  const res = await API.post("/self-help/bitdefender/scan-endpoint", { endpointId });
  return res.data;
};