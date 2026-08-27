const axios = require("axios");

// ─── Env var sanitization ───────────────────────────────────────────────────
// IMPORTANT: .trim() every credential/config value read from process.env.
// A stray trailing space or newline (very easy to introduce when
// copy-pasting into a .env file) will silently break Basic Auth or produce
// a packageId GravityZone doesn't recognize, and the resulting errors
// ("Invalid API key", "Invalid params") give no hint that whitespace is
// the actual cause.
const RAW_API_URL = process.env.BITDEFENDER_API_URL;
const RAW_API_KEY = process.env.BITDEFENDER_API_KEY;

if (!RAW_API_URL || !RAW_API_KEY) {
  console.warn("[gravityZoneClient] GravityZone configuration missing");
}

// ─── Base setup ─────────────────────────────────────────────────────────────
// GravityZone's JSON-RPC endpoint is namespaced per API, e.g.:
//   {BASE}/packages   -> createPackage, getInstallationLinks, ...
//   {BASE}/network     -> getEndpointsList, createDeploymentTask, ...
//   {BASE}/incidents  -> ...
// So BITDEFENDER_API_URL should be the *bare* jsonrpc root, no trailing
// namespace — each call appends its own namespace.
//   e.g. https://cloud.gravityzone.bitdefender.com/api/v1.0/jsonrpc
//
// NOTE: GravityZone Cloud has multiple regional hosts (e.g. `cloud.` for
// US/EU vs `cloudap.` for Asia-Pacific). This MUST match the Access URL
// shown in Control Center -> My Account -> API keys for the key you're
// using, or every call will 401 with "Invalid API key" even though the
// key itself is correct.
const JSONRPC_BASE = RAW_API_URL?.trim().replace(/\/$/, "");

// GravityZone auths JSON-RPC calls with HTTP Basic Auth: API key as the
// username, empty password. axios wants this pre-encoded for us to avoid
// surprises with special characters in the key.
const authHeader = () => {
  const key = (RAW_API_KEY || "").trim();
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
};

const http = axios.create({
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Guard against silently getting back an HTML error/login page instead of
// JSON-RPC JSON (e.g. wrong host, expired session-based redirect, etc.) —
// fail loudly instead of breaking downstream .result access.
http.interceptors.response.use((response) => {
  if (typeof response.data === "string" && response.data.trim().startsWith("<!DOCTYPE")) {
    throw new Error(
      "[gravityZoneClient] Received HTML instead of JSON — check BITDEFENDER_API_URL points at the jsonrpc root."
    );
  }
  return response;
});

let rpcId = 0;

/**
 * Calls a GravityZone JSON-RPC method against a given API namespace.
 *
 * @param {string} api    - API namespace, e.g. "packages", "network", "incidents"
 * @param {string} method - RPC method name, e.g. "getInstallationLinks"
 * @param {object} params - method params (GravityZone expects an object, not array)
 */
const call = async (api, method, params = {}) => {
  const url = `${JSONRPC_BASE}/${api}`;
  const body = {
    params,
    jsonrpc: "2.0",
    method,
    id: ++rpcId,
  };

  // ─── DEBUG LOGGING ────────────────────────────────────────────────────
  // Remove once the "Invalid params" issue is confirmed/fixed. This is the
  // single most useful line for diagnosing GravityZone JSON-RPC errors:
  // it shows EXACTLY what left your server, so you can tell immediately
  // whether e.g. packageId came through as undefined and got dropped by
  // JSON.stringify (a very common and silent failure mode).
  console.log(`[gz call] -> ${api}.${method}`, JSON.stringify(body));

  const { data } = await http.post(url, body, {
    headers: { Authorization: authHeader() },
  });

  console.log(`[gz call] <- ${api}.${method}`, JSON.stringify(data));

  // JSON-RPC error responses come back HTTP 200 with an `error` field —
  // axios won't throw on these by itself, so surface them explicitly.
  if (data.error) {
    const err = new Error(
      `[gravityZoneClient] ${api}.${method} failed: ${data.error.message || JSON.stringify(data.error)}`
    );
    err.rpcError = data.error;
    throw err;
  }

  return data.result;
};

// ─── Convenience wrappers for the Packages API ─────────────────────────────

/** Lists installation packages already created in GravityZone. */
const getPackagesList = (params = {}) => call("packages", "getPackagesList", params);

/** Full package details (installer type, OS, available options) for a packageId. */
const getPackageDetails = (packageId) => call("packages", "getPackageDetails", { packageId });

/** Creates a new installation package. See GravityZone API guide for full param shape. */
const createPackage = (params) => call("packages", "createPackage", params);

/**
 * Returns the direct download link(s) for an existing package — the URL(s)
 * you hand to the target machine (or to an RMM script) to fetch the
 * installer binary itself.
 *
 * IMPORTANT — GravityZone quirk: unlike getPackageDetails/deletePackage,
 * this method does NOT accept `packageId`. It only accepts `packageName`
 * (or `ringId` for a specific staging ring). Passing `packageId` causes
 * GravityZone to reject the call with:
 *   {"code":-32602,"message":"Invalid params","data":{"details":"One or
 *   more parameters are not expected: packageId"}}
 * So this function takes a packageName, not a packageId. If you only have
 * the ID (e.g. from BITDEFENDER_PACKAGE_ID), resolve it to a name first
 * with getPackageDetails() — see getInstallationLinksByPackageId() below
 * for a convenience wrapper that does this for you.
 */
const getInstallationLinks = (packageName, params = {}) => {
  const cleanName = typeof packageName === "string" ? packageName.trim() : packageName;
  if (!cleanName) {
    throw new Error(
      "[gravityZoneClient] getInstallationLinks called with no packageName."
    );
  }
  return call("packages", "getInstallationLinks", { packageName: cleanName, ...params });
};

/**
 * Convenience wrapper: resolves a packageId (e.g. BITDEFENDER_PACKAGE_ID)
 * to its packageName via getPackageDetails, then calls getInstallationLinks
 * with that name. Use this instead of getInstallationLinks() directly when
 * all you have is the ID.
 */
const getInstallationLinksByPackageId = async (packageId) => {
  const cleanId = typeof packageId === "string" ? packageId.trim() : packageId;
  if (!cleanId) {
    throw new Error(
      "[gravityZoneClient] getInstallationLinksByPackageId called with no packageId — check BITDEFENDER_PACKAGE_ID is set correctly."
    );
  }

  const details = await getPackageDetails(cleanId);
  const packageName = details?.name || details?.packageName;

  if (!packageName) {
    throw new Error(
      `[gravityZoneClient] Could not resolve a name for packageId "${cleanId}" from getPackageDetails — check the ID is correct and the package still exists in Control Center.`
    );
  }

  return getInstallationLinks(packageName);
};

/**
 * Builds the direct HTTP download URL for a package's full kit installer.
 * This is a plain GET (not JSON-RPC) — the caller (or a script run via RMM)
 * fetches this URL with the same Basic Auth header to get the binary.
 *
 * downloadType: 20 = full kit installer (adjust per GravityZone API guide
 * if you need a different variant, e.g. web/downloader-only kit).
 */
const buildPackageDownloadUrl = (packageId, downloadType = 20) => {
  const httpBase = JSONRPC_BASE.replace("/jsonrpc", "/http");
  return `${httpBase}/downloadPackageFullKit?packageId=${packageId}&downloadType=${downloadType}`;
};

module.exports = {
  call,
  getPackagesList,
  getPackageDetails,
  createPackage,
  getInstallationLinks,
  getInstallationLinksByPackageId,
  buildPackageDownloadUrl,
  authHeader,
};