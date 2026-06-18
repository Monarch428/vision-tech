import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
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

export const loginUser = async (
  payload: LoginPayload
): Promise<LoginResponse> => {
  const response = await API.post('/auth/login', payload);
  return response.data;
};

export const loginTimer = async (
  email: string
): Promise<LoginTimerResponse> => {
  const response = await API.post('/auth/login-timer', { email });
  return response.data;
};