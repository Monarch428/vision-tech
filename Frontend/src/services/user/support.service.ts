import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type Priority = "low" | "medium" | "high";
export type Status = "open" | "in-progress" | "resolved" | "closed";

export interface Ticket {
  _id: string;
  ticket_no: string;
  description: string;
  status: Status;
  priority?: Priority;
  category?: string;
  createdAt: string;
}

// duration is now part of the same request — no separate booking call.
// Optional: omit or send 0 for tickets filed without a one-on-one session.
export interface CreateSupportRequestPayload {
  subject: string;
  description: string;
  priority: Priority;
  category: string;
  attachments: unknown[];
  duration?: number;
}

export async function getSupportTickets(): Promise<Ticket[]> {
  const res = await API.get("/support-requests");
  return res.data.data;
}

export async function createSupportRequest(
  payload: CreateSupportRequestPayload
): Promise<Ticket> {
  const res = await API.post("/support-requests", payload);
  return res.data.data;
}
