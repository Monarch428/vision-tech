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
      Cookies.remove("user");
      await clearCache();
      localStorage.removeItem('user');
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export interface LogFile {
  _id: string;
  public_id: string;
  name: string;
  size: number;
  secure_url: string;
  format: string;
  created_at: string;
}

// GET /data-management/files
export const getLogFiles = () =>
  API.get<{ success: boolean; data: LogFile[] }>('/data-management/files');

// POST /data-management/upload  (multipart — override Content-Type for this call)
export const uploadLogFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return API.post<{ success: boolean; data: LogFile }>(
    '/data-management/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
};

// DELETE /data-management/files/:publicId
export const deleteLogFile = (public_id: string) =>
  API.delete(`/data-management/files/${encodeURIComponent(public_id)}`);