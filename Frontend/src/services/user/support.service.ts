import axios from "axios";

// ⚠️ CONFIRM: same axios pattern as dashboard.service.ts / self-help service.
// If you have this exported as a shared instance elsewhere, use that import
// instead of duplicating it here.
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

// ⚠️ RECONSTRUCTED — I never saw this file directly, only its exports as used
// in Support.tsx. Confirm these still match your real implementation.

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

// NOTE: bookSupportSession() removed — booking and ticket filing are now the
// same SupportRequest document; pass `duration` directly to
// createSupportRequest() instead of making a second call.

// NOTE: support usage (used/allowed/remaining minutes) is intentionally NOT
// fetched here. It already lives on the Subscription object returned by
// getMySubscription() in dashboard.service.ts — that's the single source of
// truth the Dashboard page uses, and Support.tsx now reads from the same
// place instead of duplicating the call.