const { logger } = require("../utils/logger");

// Unknown /api routes get a JSON 404 instead of Express's HTML page.
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Last-resort handler. Express 5 forwards rejected async handlers here, so any
// error a controller forgets to catch still ends as a JSON response.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;
  let message = err.expose || status < 500 ? err.message : "Internal server error";

  if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON in request body";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body is too large";
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors || {}).map((e) => e.message).join(", ") || err.message;
  } else if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(", ") || "a unique field"}`;
  } else if (typeof err.message === "string" && err.message.startsWith("CORS blocked")) {
    status = 403;
    message = err.message;
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed: ${err.stack || err.message}`);
  }

  res.status(status).json({ success: false, message: message || "Request failed" });
};

module.exports = { notFound, errorHandler };
