import axios from 'axios';
import Cookies from 'js-cookie';
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
      Cookies.remove('user');
       clearCache();
      localStorage.removeItem('user');
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export type Priority = 'high' | 'medium' | 'low';
export type Status = 'in-progress' | 'open' | 'resolved' | 'closed';

export interface ServiceRequest {
  _id: string;
  user: { _id: string; name: string; email: string };
  ticketNumber: number;
  ticket_no?: string;
  assigned_user_id: { _id: string; name: string } | null;
  duration: number;
  category: string;
  priority: Priority;
  status: Status;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportAgent {
  _id: string;
  name: string;
  email: string;
}

export interface AssignTicketPayload {
  assigned_user_id: string;
  status: Status;
  assigned_by: string;
}

// GET /support-requests/all
export const getAllServiceRequests = () =>
  API.get<{
    success: boolean;
    message?: string;
    data: ServiceRequest[];
    criticalRequest: number;
  }>('/support-requests/all');

// GET /api/v1/users  — fetch all users to use as assignable agents
export const getAgentsForBooking = () =>
  API.get('/v1/users');

// PATCH /support-requests/:id/assign
export const assignTicket = (ticketId: string, payload: AssignTicketPayload) =>
  API.post<{ success: boolean; message?: string }>(
    `/support-requests/assign/${ticketId}`,
    payload
  );