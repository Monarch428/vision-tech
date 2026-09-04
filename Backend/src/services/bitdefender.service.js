const axios = require("axios");

const BASE_URL = process.env.BITDEFENDER_API_URL; // https://.../jsonrpc
const API_KEY = (process.env.BITDEFENDER_API_KEY || "").trim();
const authHeader = "Basic " + Buffer.from(`${API_KEY}:`).toString("base64");

async function call(module, method, params = {}) {
  const { data } = await axios.post(
    `${BASE_URL}/${module}`,
    { id: "1", jsonrpc: "2.0", method, params },
    { headers: { "Content-Type": "application/json", Authorization: authHeader } }
  );
  if (data.error) {
    const err = new Error(data.error.data?.details || data.error.message || "GravityZone API error");
    err.gzError = data.error;
    throw err;
  }
  return data.result;
}

const getEndpointsList = (parentId, params = {}) =>
  call("network", "getEndpointsList", { parentId, page: 1, perPage: 100, ...params });

const getManagedEndpointDetails = (endpointId) =>
  call("network", "getManagedEndpointDetails", { endpointId });

const getScanTasksList = (endpointId, page = 1, perPage = 30) =>
  call("network", "getScanTasksList", { endpointId, page, perPage });

const getInstallationLinks = (packageId) =>
  call("packages", "getInstallationLinks", { packageId });

const createScanTask = (endpointIds, name, type = 2) =>
  call("network", "createScanTask", { targetIds: endpointIds, name, type });

module.exports = { getEndpointsList, getManagedEndpointDetails, getScanTasksList, getInstallationLinks, createScanTask };