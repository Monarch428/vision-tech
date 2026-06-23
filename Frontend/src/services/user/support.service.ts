import axios from 'axios';
import Cookies from "js-cookie";
import { clearCache } from "../../hooks/useCacheStorage";

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
      Cookies.remove('token');
      localStorage.removeItem('user');
      clearCache();
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export type Priority = 'low' | 'medium' | 'high';
export type Status = "in-progress" | "open" | "resolved" | "closed";

export interface Ticket {
  _id: string;
  ticket_no: string;
  description: string;
  status: Status;
  priority: Priority;
  category: string;
  createdAt: string;
}

export interface Agent {
  _id: string;
  name: string;
}

export interface BookSupportPayload {
  duration: number;
  category: string;
  priority: Priority;
  description: string;
}

export interface NewRequestPayload {
  subject: string;
  description: string;
  priority: Priority;
  category: string;
  attachments: string[];
}

export interface AssignTicketPayload {
  assigned_user_id: string;
  status?: Status;
}

export const getSupportTickets = async (): Promise<Ticket[]> => {
  const response = await API.get<{ success: boolean; data: Ticket[] }>(
    '/support-booking/'
  );
  return response.data.data;
};

export const bookSupportSession = async (
  payload: BookSupportPayload
): Promise<Ticket> => {
  const response = await API.post<{ success: boolean; data: Ticket }>(
    '/support-booking',
    payload
  );
  return response.data.data;
};

export const assignTicket = async (
  ticketId: string,
  payload: AssignTicketPayload
): Promise<Ticket> => {
  const response = await API.post<{ success: boolean; data: Ticket }>(
    `/support-booking/assign/${ticketId}`,
    payload
  );
  return response.data.data;
};

export const createSupportRequest = async (
  payload: NewRequestPayload
): Promise<void> => {
  await API.post('/support-requests', payload);
};

export const getAgents = async (): Promise<Agent[]> => {
  const response = await API.get<{ success: boolean; data: Agent[] }>(
    '/v1/users/userRole'
  );
  return response.data.data;
};