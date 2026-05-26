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

export const getAllServiceRequests = () =>
  API.get('/support-requests/all');

export const getSupportAgents = () =>
  API.get('/v1/users/userRole');

export const assignTicket = (
  ticketId: string,
  payload: {
    assigned_user_id: string;
    status: string;
    assigned_by: string;
  }
) => API.post(`/support-requests/assign/${ticketId}`, payload);