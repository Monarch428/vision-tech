import axios from 'axios';

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
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
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

export const createAntivirusSchedule = async (
  payload: AntivirusSchedulePayload
): Promise<AntivirusScheduleResponse> => {
  const response = await API.post<AntivirusScheduleResponse>(
    '/antivirus-schedules',
    payload
  );
  return response.data;
};


