import API from "./rmm.service";

// Customer file backups: the RMM agent zips folders on the customer's own
// computer and uploads them to cloud storage (Backend: /api/file-backups).

export type FileBackupStatus = "pending" | "running" | "completed" | "failed";

export interface FileBackup {
  id: string;
  agentId: string;
  hostname: string | null;
  folders: string[];
  trigger: "manual" | "schedule";
  status: FileBackupStatus;
  error: string | null;
  size: number;
  fileCount: number | null;
  skippedCount: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface FileBackupSchedule {
  agentId: string;
  folders: string[];
  enabled: boolean;
  lastRunAt: string | null;
}

export interface FileBackupOverview {
  backups: FileBackup[];
  usage: { plan: string; used: number; limit: number };
  folders: string[];
  keepPerDevice: number;
  schedules: FileBackupSchedule[];
}

export const getFileBackups = async (): Promise<FileBackupOverview> => {
  const { data } = await API.get<FileBackupOverview & { success: boolean }>("/file-backups");
  return data;
};

export const startFileBackup = async (agentId: string, folders: string[]): Promise<FileBackup> => {
  const { data } = await API.post<{ success: boolean; backup: FileBackup }>("/file-backups", { agentId, folders });
  return data.backup;
};

export const setFileBackupSchedule = async (agentId: string, folders: string[], enabled: boolean): Promise<FileBackupSchedule> => {
  const { data } = await API.put<{ success: boolean; schedule: FileBackupSchedule }>("/file-backups/schedule", { agentId, folders, enabled });
  return data.schedule;
};

export const deleteFileBackup = async (id: string): Promise<void> => {
  await API.delete(`/file-backups/${id}`);
};

export const downloadFileBackup = async (backup: FileBackup): Promise<void> => {
  const response = await API.get(`/file-backups/${backup.id}/download`, { responseType: "blob" });
  const day = (backup.completedAt || backup.createdAt).slice(0, 10);
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup-${backup.hostname || "device"}-${day}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
