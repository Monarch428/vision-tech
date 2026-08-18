const axios = require("axios");

if (
  !process.env.TACTICALRMM_BASE_URL ||
  !process.env.TACTICALRMM_API_KEY
) {
  console.warn(
    "[tacticalRmmClient] Tactical RMM configuration missing"
  );
}

const rmm = axios.create({
  baseURL: process.env.TACTICALRMM_BASE_URL?.replace(/\/$/, ""),
  timeout: 15000,
  headers: {
    "X-API-KEY": process.env.TACTICALRMM_API_KEY,
    "Content-Type": "application/json",
  },
});

// Guard against silently getting back the RMM frontend's HTML instead of
// JSON (e.g. if TACTICALRMM_BASE_URL ever points at the rmm. domain instead
// of api. again) — fail loudly instead of breaking downstream .map()/.data
// access with a confusing error.
rmm.interceptors.response.use((response) => {
  if (typeof response.data === "string" && response.data.trim().startsWith("<!DOCTYPE")) {
    throw new Error(
      "[tacticalRmmClient] Received HTML instead of JSON — check TACTICALRMM_BASE_URL points at the api. domain, not rmm."
    );
  }
  return response;
});

module.exports = rmm;