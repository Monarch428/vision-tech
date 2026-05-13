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

export const getAllUsers  = ()          => API.get('/v1/users');
export const getUserById  = (id: string) => API.get(`/v1/users/${id}`);
export const createUser   = (data: {
  name: string; email: string; password: string; role: string; status?: string;
}) => API.post('/v1/users', data);
export const updateUser   = (id: string, data: Partial<{
  name: string; email: string; password: string; role: string; status: string;
}>) => API.put(`/v1/users/${id}`, data);
export const deleteUser   = (id: string,action: "toggle" | "delete" = "toggle") => API.delete(`/v1/users/${id}?action=${action}`);
