// Axios errors carry the full request, including the API-key header. Anything
// that logs or prints such an error would leak the key, so third-party clients
// replace errors with this minimal copy: message, code, method/url (no query
// string) and the response status/body the app's error handling relies on.
const toSafeHttpError = (label) => (error) => {
  const method = error.config?.method?.toUpperCase();
  const url = String(error.config?.url || '').split('?')[0];
  const status = error.response?.status;
  const safe = new Error(`[${label}] ${method || ''} ${url} failed: ${status ? `HTTP ${status}` : error.message}`.replace(/\s+/g, ' '));
  safe.code = error.code;
  safe.response = error.response ? { status, data: error.response.data } : undefined;
  safe.config = { method: error.config?.method, url };
  return Promise.reject(safe);
};

module.exports = { toSafeHttpError };
