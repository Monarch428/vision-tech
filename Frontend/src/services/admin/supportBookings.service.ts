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

// GET /api/support-booking/all
export const getAllSupportBookings = () =>
  API.get('/support-booking/all');

// GET /api/support-booking  (current user's bookings)
export const getSupportBookings = () =>
  API.get('/support-booking');

// POST /api/support-booking
export const createSupportBooking = (data: {
  duration: number;
  category: string;
  priority: string;
  description: string;
}) => API.post('/support-booking', data);

// POST /api/support-booking/assign/:ticketId
export const assignSupportBooking = (
  ticketId: string,
  data: { assigned_user_id: string; status: string }
) => API.post(`/support-booking/assign/${ticketId}`, data);

// GET /api/v1/users  — fetch all users to use as assignable agents
export const getAgentsForBooking = () =>
  API.get('/v1/users');