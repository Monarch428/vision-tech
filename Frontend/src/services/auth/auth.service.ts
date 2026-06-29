import axios from 'axios';
// import Cookies from 'js-cookie';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  requiresOtp: boolean;
  token:string;
  email: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface LoginTimerResponse {
  locked: boolean;
  lockUntil?: string;
  attemptsLeft: number;
  maxAttempts: number;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  message: string;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface ResendOtpPayload {
  email: string;
}

export interface ResendOtpResponse {
  message: string;
}

export const loginUser = async (payload: LoginPayload): Promise<LoginResponse> => {
  const response = await API.post('/auth/login', payload);
  return response.data;
};

export const loginTimer = async (email: string): Promise<LoginTimerResponse> => {
  const response = await API.post('/auth/login-timer', { email });
  return response.data;
};

export const verifyOtp = async (payload: VerifyOtpPayload): Promise<VerifyOtpResponse> => {
  const response = await API.post('/auth/verify-otp', payload);
  return response.data;
};

export const resendOtp = async (payload: ResendOtpPayload): Promise<ResendOtpResponse> => {
  const response = await API.post('/auth/resend-otp', payload);
  return response.data;
};