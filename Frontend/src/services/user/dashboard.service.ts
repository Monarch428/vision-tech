import axios from 'axios';

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
      localStorage.removeItem('user');
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export interface Subscription {
  _id: string;
  sub_id: string;
  user: string;
  planName: "free" | "pro" | "enterprise";
  status: "active" | "paused" | "expired" | "cancelled";
  startDate: string;
  endDate: string | null;
  nextRenewalDate: string | null;
}

export interface Invoice {
  _id: string;
  invoiceNumber?: string;
  amount: number;
  status: "success" | "failed" | "pending";
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

export const getMySubscription = async (): Promise<Subscription> => {
  const response = await API.get<{ success: boolean; data: Subscription }>(
    '/user-subscriptions/my'
  );
  return response.data.data;
};

export const getMyInvoice = async (): Promise<Invoice[]> => {
  const response = await API.get<{ success: boolean; data: Invoice[] }>(
    "/payments/my"
  );

  return response.data.data || [];
};
