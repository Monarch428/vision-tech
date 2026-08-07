const { WebSocketServer } = require("ws");
const Device = require("./models/rnm/Device");

const pendingConnections = []; // agents waiting to be added from the dashboard
const activeConnections = new Map(); // deviceId -> ws, for authenticated/paired agents

function attachHeartbeatWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws/devices") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (ws, req) => {
    const auth = req.headers["authorization"];
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

    if (token) {
      const device = await Device.findOne({ token }).select("+token");
      if (!device) {
        console.warn("WS auth failed — no device matches this token");
        ws.close(4401, "Invalid token");
        return;
      }
      ws.deviceId = device.deviceId;
      activeConnections.set(device.deviceId, ws);
      console.log(`Device ${device.deviceId} connected via WS`);
    } else {
      pendingConnections.push({ ws, connectedAt: Date.now() });
      console.log("Unauthenticated agent connected — waiting to be added from dashboard");
    }

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (err) {
        console.error("Bad WS message (not JSON):", err.message);
        return;
      }

      if (msg.type === "heartbeat" && ws.deviceId) {
        const result = await Device.updateOne(
          { deviceId: ws.deviceId },
          {
            $set: {
              cpu: msg.cpu,
              memory: msg.memory,
              storage: msg.storage,
              uptime: msg.uptime,
              hostname: msg.hostname,
              platform: msg.platform,
              lastSeen: new Date(),
            },
          }
        );
        if (result.matchedCount === 0) {
          console.warn(`Heartbeat from ${ws.deviceId} but no matching Device in DB — closing`);
          ws.close(4404, "Device deleted");
          return;
        }
        ws.send(JSON.stringify({ type: "ack" }));
      }
    });

    ws.on("close", () => {
      const idx = pendingConnections.findIndex((entry) => entry.ws === ws);
      if (idx !== -1) pendingConnections.splice(idx, 1);
      if (ws.deviceId) activeConnections.delete(ws.deviceId);
      console.log(`Device ${ws.deviceId || "(pending)"} disconnected`);
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (let i = pendingConnections.length - 1; i >= 0; i--) {
      if (now - pendingConnections[i].connectedAt > 5 * 60 * 1000) {
        pendingConnections.splice(i, 1);
      }
    }
  }, 60 * 1000);
}

function assignCredentials({ deviceId, token }) {
  const entry = pendingConnections.shift();
  if (!entry) return false;

  const { ws } = entry;
  if (ws.readyState !== ws.OPEN) return false;

  ws.deviceId = deviceId;
  activeConnections.set(deviceId, ws);
  ws.send(JSON.stringify({ type: "registered", deviceId, token }));
  return true;
}

// Called by deleteDevice — forcibly disconnects the agent immediately, not just in the DB.
function disconnectDevice(deviceId) {
  const ws = activeConnections.get(deviceId);
  if (ws) {
    ws.close(4404, "Device deleted");
    activeConnections.delete(deviceId);
    return true;
  }
  return false;
}

module.exports = { attachHeartbeatWs, assignCredentials, disconnectDevice };