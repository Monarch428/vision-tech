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
  };
  recentScan: {
    taskId: string;
    taskName: string;
    filesScanned: number;
    isClean: boolean;
    scanDate: string;
    threatsDetected: number;
  };
  scans: Array<{
    id: string;
    name: string;
  }>;
  stats: {
    filesScanned: number;
    threatsBlocked: number;
    totalScans: number;
    completedScans: number;
  };
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


