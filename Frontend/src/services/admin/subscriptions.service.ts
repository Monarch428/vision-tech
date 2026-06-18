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
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      Cookies.remove('token');
      localStorage.removeItem('user');
      clearCache();
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export const getAllSubscriptions = () =>
  API.get('/admin/subscriptions');

export const updateSubscriptionStatus = (
  id: string,
  status: 'active' | 'paused' | 'cancelled' | 'expired'
) => API.put(`/user-subscriptions/${id}`, { status });