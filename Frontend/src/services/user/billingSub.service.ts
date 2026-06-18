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
  async(error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      Cookies.remove('token');
      localStorage.removeItem('user');
      await clearCache();
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Subscription {
  _id: string;
  sub_id: string;
  user: string;
  planName: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string | null;
  nextRenewalDate: string | null;
}

export interface Invoice {
  _id: string;
  invoiceNumber?: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  paymentMethod: string;
  paidAt: string;
  user?: {
    _id: string;
    name: string;
    email: string;
  };
  subscription?: {
    _id: string;
    status?: string;
    plan?: {
      _id?: string;
      name?: string;
      price?: number;
      billingCycle?: string;
    };
  };
}

export interface CreateSubscriptionPayload {
  user: string;
  planName: string;
  startDate: string;
}

export interface UpdateSubscriptionPayload {
  planName?: string;
  status?: string;
  cancelledAt?: string;
  pendingPlanName?: string;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

// GET /user-subscriptions/my
export const getMySubscription = async (): Promise<Subscription> => {
  const response = await API.get<{ success: boolean; data: Subscription }>(
    '/user-subscriptions/my'
  );
  return response.data.data;
};

// POST /user-subscriptions
export const createSubscription = async (
  payload: CreateSubscriptionPayload
): Promise<Subscription> => {
  const response = await API.post<{ success: boolean; data: Subscription }>(
    '/user-subscriptions',
    payload
  );
  return response.data.data;
};

// PUT /user-subscriptions/:id
export const updateSubscription = async (
  id: string,
  payload: UpdateSubscriptionPayload
): Promise<Subscription> => {
  const response = await API.put<{ success: boolean; data: Subscription }>(
    `/user-subscriptions/${id}`,
    payload
  );
  return response.data.data;
};

// ─── Payments / Invoices ──────────────────────────────────────────────────────

// GET /payments/my
export const getMyInvoices = async (): Promise<Invoice[]> => {
  const response = await API.get<{ success: boolean; data: Invoice[] }>(
    '/payments/my'
  );
  return response.data.data;
};

// GET /payments/:id/invoice  → returns a PDF blob
export const downloadInvoice = async (
  invoiceId: string,
  invoiceNumber?: string
): Promise<void> => {
  const response = await API.get(`/payments/${invoiceId}/invoice`, {
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber || 'invoice'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// PayPal

export const createPaypalOrder = async (amount: number) => {
  const response = await API.post("/payments/paypal/create-order", {
    amount,
  });

  return response.data;
};

export const capturePaypalOrder = async (orderId: string) => {
  const response = await API.post(
    `/payments/paypal/capture-order/${orderId}`
  );

  return response.data;
};