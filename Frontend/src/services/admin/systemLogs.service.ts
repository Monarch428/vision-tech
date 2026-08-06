import axios from 'axios';
import Cookies from "js-cookie";
import { clearCache } from "../../hooks/useCacheStorage";

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
  async (error) => {
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

export interface SystemLogsParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
}

export const getSystemLogs = (params: SystemLogsParams = {}) => {
  const { page = 1, limit = 500, search = '', type = 'all' } = params;
  return API.get('/system-logs', {
    params: { page, limit, search, type },
  });
};