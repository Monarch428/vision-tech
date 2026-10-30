// Backend/src/server.js
const http = require("http");
const app = require("./app");
const connectDB = require("./conifg/db");
const { logger } = require("./utils/logger");

const PORT = process.env.PORT || 5001;

// A stray rejected promise (cron, fire-and-forget email, etc.) should be logged,
// not take the whole API down.
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled promise rejection: ${reason?.stack || reason}`);
});

// After an uncaught exception the process state is unknown, so log and exit;
// nodemon / the process manager restarts it.
process.on("uncaughtException", (error) => {
  logger.error(`Uncaught exception: ${error.stack || error.message}`);
  process.exit(1);
});

connectDB();

const server = http.createServer(app);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`);
  } else {
    logger.error(`HTTP server error: ${error.stack || error.message}`);
  }
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running on port ${PORT}`);
});
