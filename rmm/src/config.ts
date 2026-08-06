// src/config.ts
import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".myagent");
const CONFIG_FILE = path.join(CONFIG_DIR, "device.json");

export interface DeviceConfig {
  deviceId: string;
  deviceToken: string;
}

export function loadConfig(): DeviceConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConfig(config: DeviceConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600, // owner read/write only — it's a credential
  });
}

export function clearConfig(): void {
  try {
    fs.unlinkSync(CONFIG_FILE);
  } catch {
    // already gone, nothing to do
  }
}