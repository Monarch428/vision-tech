import "./env";
import WebSocket from "ws";
import { DeviceConfig, saveConfig, clearConfig } from "./config";

const WS_URL = process.env.WS_URL;
if (!WS_URL) {
  throw new Error("Missing WS_URL in .env");
}
const RESOLVED_WS_URL: string = WS_URL;

export class HeartbeatSocket {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private config: DeviceConfig | null;

  constructor(config: DeviceConfig | null) {
    this.config = config;
  }

  connect(): void {
    const headers: Record<string, string> = {};
    if (this.config) {
      headers.Authorization = `Bearer ${this.config.deviceToken}`;
    }

    this.ws = new WebSocket(RESOLVED_WS_URL, { headers });

    this.ws.on("open", () => {
      console.log(`[${new Date().toISOString()}] WS connected`);
      this.reconnectDelay = 1000;
      if (!this.config) {
        console.log('Waiting to be added from the dashboard ("Add New Device")...');
      }
    });

    this.ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === "registered") {
        this.config = { deviceId: msg.deviceId, deviceToken: msg.token };
        saveConfig(this.config);
        console.log(`Registered as device ${msg.deviceId} — credentials saved locally.`);
        return;
      }

      console.log("Server:", data.toString());
    });

    this.ws.on("close", (code) => {
      if (code === 4404 && this.config) {
        console.warn("This device was removed from the dashboard — clearing local credentials.");
        this.config = null;
        clearConfig();
      } else {
        console.warn(`WS closed (code ${code}) — reconnecting...`);
      }
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("WS error:", err.message);
      this.ws?.close();
    });
  }

  getConfig(): DeviceConfig | null {
    return this.config;
  }

  private scheduleReconnect(): void {
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      console.warn("WS not open — dropping message:", payload.type);
    }
  }
}