import "./env";
import os from "os";
import { ensureDevice } from "./register";
import { HeartbeatSocket } from "./wsClient";
import { getCpuUsage, getMemoryUsage, getStorageUsage, calculateHealth } from "./metric";

const HEARTBEAT_INTERVAL_MS = 15000; // was 60000

async function main() {
  const config = ensureDevice();
  const socket = new HeartbeatSocket(config);
  socket.connect();

  async function sendHeartbeat() {
    const current = socket.getConfig();
    if (!current) {
      console.log("Waiting to be added before sending heartbeats...");
      return;
    }

    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const storage = await getStorageUsage();
    const health = calculateHealth(cpu, memory, storage);

    socket.send({
      type: "heartbeat",
      deviceId: current.deviceId,
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: Math.round(os.uptime()),
      cpu,
      memory,
      storage,
      health,
    });
    console.log(`[${new Date().toISOString()}] Heartbeat sent`, { cpu, memory, storage, health });
  }

  void sendHeartbeat();
  setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
}

void main();