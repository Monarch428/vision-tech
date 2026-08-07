// Backend/src/server.js
const http = require("http");
const app = require("./app");
const connectDB = require("./conifg/db");
const { attachHeartbeatWs } = require("./wsServer");

const PORT = process.env.PORT || 5000;

connectDB();

const server = http.createServer(app);
attachHeartbeatWs(server);

server.listen(PORT, () => {
  console.log(`Server + WS running on port ${PORT}`);
});