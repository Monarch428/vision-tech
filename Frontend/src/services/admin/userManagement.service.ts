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
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      Cookies.remove('token');
      await clearCache();
      window.location.replace("/login");
    }

    return Promise.reject(error);
  }
);

export const getAllUsers = () => API.get('/v1/users');
export const getSystemConfig = () => API.get('/system-config/me');
export const getUserById = (id: string) => API.get(`/v1/users/${id}`);
export const createUser = (data: {
  name: string; email: string; password: string; role: string; status?: string;
}) => API.post('/v1/users', data);
export const updateUser = (id: string, data: Partial<{
  name: string; email: string; password: string; currentPassword: string; role: string; status: string;
}>) => API.put(`/v1/users/${id}`, data);
export const deleteUser = (id: string, action: "toggle" | "delete" = "toggle") => API.delete(`/v1/users/${id}?action=${action}`);

export const currentUserRole = () => API.get('/v1/users/currentrole');