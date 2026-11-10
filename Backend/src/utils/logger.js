const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
  // Automated tests set NODE_ENV=test; request logs would drown out the results.
  silent: process.env.NODE_ENV === 'test',
});

module.exports = { logger };