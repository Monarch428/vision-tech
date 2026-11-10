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

export interface AdminPayment {
  id: string;
  invoiceNumber: string | null;
  paidAt: string;
  amount: number;
  status: 'success' | 'failed' | 'pending' | 'refunded';
  paymentMethod: string;
  planName: string | null;
  customer: { id: string; name: string; email: string } | null;
  transactionId: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  refundable: boolean;
}

interface Sum { count: number; amount: number }

export interface PaymentsPage {
  page: number;
  pages: number;
  total: number;
  totals: { received: Sum; refunded: Sum; paypal: Sum; stripe: Sum };
  payments: AdminPayment[];
}

export interface PaymentFilters {
  gateway?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
}

export const getAdminPayments = async (filters: PaymentFilters): Promise<PaymentsPage> => {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined));
  const response = await API.get('/payments/admin', { params });
  return response.data;
};

export const refundPayment = async (id: string, reason: string): Promise<{ message: string }> => {
  const response = await API.post(`/payments/${id}/refund`, { confirm: true, reason });
  return response.data;
};

export const downloadInvoiceAsStaff = async (id: string, invoiceNumber: string | null): Promise<void> => {
  const response = await API.get(`/payments/${id}/invoice`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber || 'invoice'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
