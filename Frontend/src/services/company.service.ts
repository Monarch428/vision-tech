import axios from 'axios';

const API = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL, headers: { 'Content-Type': 'application/json' } });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type Company = { id: string; name: string; role: string; paid: boolean; providers: Array<{ provider: string; verifiedAt: string }> };
export type CompanyDevice = { agent_id: string; hostname?: string; operating_system?: string; status?: string; site?: number };
export type AntivirusEndpoint = { id: string; name?: string; status?: string };

export const getCompany = async () => (await API.get<Company>('/companies/me')).data;
export const getCompanyDevices = async () => (await API.get<{ devices: CompanyDevice[] }>('/companies/me/devices')).data.devices;
export const getCompanyEndpoints = async () => (await API.get<{ endpoints: AntivirusEndpoint[] }>('/companies/me/antivirus/endpoints')).data.endpoints;
export const startCompanyScan = (endpointId: string) => API.post('/companies/me/antivirus/scans', { endpointId });
export const migrateLegacyCompanies = (apply = false) => API.post('/companies/migration/legacy', { apply });
