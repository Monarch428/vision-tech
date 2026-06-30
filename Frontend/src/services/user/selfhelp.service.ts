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