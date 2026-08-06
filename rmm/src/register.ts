import "./env";
import { loadConfig, DeviceConfig } from "./config";

export function ensureDevice(): DeviceConfig | null {
  return loadConfig();
}