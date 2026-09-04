import axios from 'axios';
import Cookies from "js-cookie";
import { clearCache } from "../../hooks/useCacheStorage";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async(error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      Cookies.remove('token');
      await clearCache();
      localStorage.removeItem('user');
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export interface AntivirusSchedulePayload {
  serviceType: string;
  preferredDate: string;
  preferredTime: string;
  numberOfDevices: string;
}

export interface AntivirusScheduleResponse {
  id: string;
  serviceType: string;
  preferredDate: string;
  preferredTime: string;
  numberOfDevices: string;
  status: string;
  createdAt: string;
}

export interface ScanUser {
  id: string;
  name: string | null;
  email: string | null;
}

export interface UserLastScan {
  id: string;
  status: string;
  progress: number;
  filesScanned: number;
  threatsDetected: number;
  scanStartedAt: string;
  scanFinishedAt: string | null;
  // false = Bitdefender no longer has a real file count for this specific
  // historical scan (it only retains the endpoint's single most recent
  // scan). Show "Not available" instead of the raw number in this case.
  filesScannedAvailable: boolean;
}

export interface ScanReport {
  success: boolean;
 machine: {
  name: string;
  ip: string;
  os: string;
  agentVersion: string;
  detection: boolean;
  engineVersion: string;
  infected: boolean;
  lastSeen: string;
  lastUpdate: string;
  securityStatus: number;
  signatureOutdated: boolean;
  productOutdated: boolean;
  updateDisabled: boolean;
};
recentScan: {
  taskId: string;
  taskName: string;
  filesScanned: number | null;
  filesScannedAvailable: boolean;
  isClean: boolean;
  scanDate: string;
  threatsDetected: number;
  scannedBy: ScanUser | null;
};
scans: Array<{
  id: string;
  name: string;
  startDate?: string;
  filesScanned?: number | null;
  filesScannedAvailable?: boolean;
  threatsDetected?: number;
  status?: string;
  requestedBy: ScanUser | null;
}>;
  stats: {
    filesScanned: number;
    threatsBlocked: number;
    totalScans: number;
    completedScans: number;
  };
  // Most recent scan requested by the currently logged-in user, sourced
  // from their own SelfHelpTool history rather than the shared endpoint.
  userLastScan: UserLastScan | null;
}

export const getScanReport = async (): Promise<ScanReport> => {
  const response = await API.get<ScanReport>('/self-help/bitdefender/scan-report');
  return response.data;
};


export const createAntivirusSchedule = async (
  payload: AntivirusSchedulePayload
): Promise<AntivirusScheduleResponse> => {
  const response = await API.post<AntivirusScheduleResponse>(
    '/antivirus-schedules',
    payload
  );
  return response.data;
};