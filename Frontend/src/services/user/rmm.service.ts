// import axios from 'axios';
// import Cookies from "js-cookie";
// import { clearCache } from "../../hooks/useCacheStorage"; // adjust path to match this file's actual depth

// const API = axios.create({
//   baseURL: import.meta.env.VITE_API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// API.interceptors.request.use((config) => {
//   const token = localStorage.getItem('token');
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

// API.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     if (error.response?.status === 401) {
//       localStorage.removeItem('token');
//       localStorage.removeItem('user');
//       Cookies.remove('token');
//       await clearCache();
//       window.location.replace('/login');
//     }
//     return Promise.reject(error);
//   }
// );

// // ─── Types ──────────────────────────────────────────────────────────────────

// export type DeviceStatus = "online" | "offline";
// export type DeviceType = "Laptop" | "Desktop";

// export interface Device {
//   _id: string;
//   deviceId: string;
//   name: string;
//   type: DeviceType;
//   status: DeviceStatus;
//   hostname?: string;
//   platform?: string;
//   monitoring: boolean;
//   health: number;
//   cpu: number;
//   memory: number;
//   storage: number;
//   uptime?: number;
//   lastSeen?: string;
//   createdAt?: string;
//   updatedAt?: string;
// }

// export interface AddDevicePayload {
//   name: string;
//   type: DeviceType;
// }

// export interface AddDeviceResponse {
//   success: boolean;
//   device: Device;
//   agentConfig: {
//     deviceId: string;
//     token: string;
//   };
// }

// // ─── API calls ──────────────────────────────────────────────────────────────

// export const getDevices = async (): Promise<Device[]> => {
//   const response = await API.get<{ success: boolean; devices: Device[] }>(
//     '/devices'
//   );
//   return response.data.devices;
// };

// export const addDevice = async (
//   payload: AddDevicePayload
// ): Promise<AddDeviceResponse> => {
//   const response = await API.post<AddDeviceResponse>('/devices', payload);
//   return response.data;
// };

// export const toggleMonitoring = async (
//   id: string,
//   monitoring: boolean
// ): Promise<Device> => {
//   const response = await API.patch<{ success: boolean; device: Device }>(
//     `/devices/${id}/monitoring`,
//     { monitoring }
//   );
//   return response.data.device;
// };

// export const deleteDevice = async (id: string): Promise<void> => {
//   await API.delete(`/devices/${id}`);
// };