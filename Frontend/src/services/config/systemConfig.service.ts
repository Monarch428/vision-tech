import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

// ── Types ──────────────────────────────────────────────────────────────────

export interface SystemConfigPayload {
  general: {
    siteName: string;
    siteUrl: string;
    timezone: string;
    maintenanceMode: boolean;
    autoBackup: boolean;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
    emailNotificationsEnabled: boolean;
  };
  security: {
    sessionTimeoutMinutes: number | null;
    maxLoginAttempts: number | null;
    minimumPasswordLength: number | null;
    requireTwoFactorAuth: boolean;
    allowedIpAddresses: string[];
  };
  notifications: {
    newUserRegistration: boolean;
    serviceRequestAlerts: boolean;
    systemErrors: boolean;
    securityAlerts: boolean;
    subscriptionRenewals: boolean;
  };
}

// ── Endpoints ──────────────────────────────────────────────────────────────

export const getSystemConfig = () =>
  API.get('/system-config/me');

export const createSystemConfig = (payload: SystemConfigPayload) =>
  API.post('/system-config', payload);

export const updateSystemConfig = (payload: SystemConfigPayload) =>
  API.put('/system-config', payload);

export const sendTestEmail = (fromEmail: string) =>
  API.post('/system-config/test-email', { fromEmail });