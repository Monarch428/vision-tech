require('dotenv').config();
const axios = require('axios');

const API_BASE = process.env.BITDEFENDER_API_URL || 'https://cloud.gravityzone.bitdefender.com/api/v1.0/jsonrpc';
const API_KEY = process.env.BITDEFENDER_API_KEY;
const PACKAGE_ID = process.env.BITDEFENDER_PACKAGE_ID;
const HOSTNAME = process.env.BITDEFENDER_HOSTNAME || 'apples-macbook-pro.local';
const AUTH_TOKEN = process.env.VALIDATION_AUTH_TOKEN || 'PASTE_YOUR_JWT_TOKEN_HERE';

const os = require('os');

const basicAuth = `Basic ${Buffer.from(`${API_KEY}:`).toString('base64')}`;

const normalizeBitdefenderValue = (value) => {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\.(local|lan)$/i, '')
    .replace(/['"`]/g, '');
};

const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const detail of interfaces[name] || []) {
      if (detail.family === 'IPv4' && !detail.internal) {
        return detail.address;
      }
    }
  }
  return null;
};

const log = (label, value) => {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(value, null, 2));
};

async function validateApiKey() {
  try {
    const res = await axios.post(
      `${API_BASE}/network`,
      {
        jsonrpc: '2.0',
        method: 'getEndpointsList',
        params: {},
        id: 1,
      },
      {
        headers: {
          Authorization: basicAuth,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    log('API key validation', {
      status: res.status,
      hasError: !!res.data?.error,
      result: res.data?.result || res.data,
    });

    return res.data;
  } catch (err) {
    log('API key validation failed', {
      status: err.response?.status || 'unknown',
      message: err.message,
      body: err.response?.data || null,
    });
    throw err;
  }
}

async function validatePackage() {
  if (!PACKAGE_ID) {
    log('Package validation skipped', { message: 'BITDEFENDER_PACKAGE_ID missing' });
    return;
  }

  try {
    const res = await axios.post(
      `${API_BASE}/packages`,
      {
        jsonrpc: '2.0',
        method: 'getPackageDetails',
        params: { packageId: PACKAGE_ID },
        id: 2,
      },
      {
        headers: {
          Authorization: basicAuth,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    log('Package validation', {
      status: res.status,
      hasError: !!res.data?.error,
      result: res.data?.result || res.data,
    });
  } catch (err) {
    log('Package validation failed', {
      status: err.response?.status || 'unknown',
      message: err.message,
      body: err.response?.data || null,
    });
  }
}

async function matchHostnameAndIp() {
  try {
    const res = await axios.post(
      `${API_BASE}/network`,
      {
        jsonrpc: '2.0',
        method: 'getEndpointsList',
        params: {},
        id: 3,
      },
      {
        headers: {
          Authorization: basicAuth,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const items = res.data?.result?.items || res.data?.result || [];
    const targetHost = normalizeBitdefenderValue(HOSTNAME);
    const targetIp = normalizeBitdefenderValue(getLocalIp());

    const matches = Array.isArray(items) ? items.filter((endpoint) => {
      const candidates = [
        endpoint?.name,
        endpoint?.hostname,
        endpoint?.computerName,
        endpoint?.displayName,
        endpoint?.deviceName,
        endpoint?.localName,
        endpoint?.hostName,
        endpoint?.friendlyName,
      ].map(normalizeBitdefenderValue);

      const ips = [
        endpoint?.ip,
        endpoint?.ipAddress,
        endpoint?.localIp,
        endpoint?.localIP,
        endpoint?.lanIp,
        endpoint?.internalIp,
        endpoint?.privateIp,
        endpoint?.networkIp,
      ].map(normalizeBitdefenderValue);

      const hostMatch = candidates.some((value) => {
        if (!value) return false;
        return value === targetHost || value.includes(targetHost) || targetHost.includes(value);
      });

      const ipMatch = ips.some((value) => {
        if (!value || !targetIp) return false;
        return value === targetIp || value.includes(targetIp) || targetIp.includes(value);
      });

      return hostMatch || ipMatch;
    }) : [];

    log('Hostname + IP match', {
      hostname: HOSTNAME,
      detectedIp: getLocalIp(),
      found: matches.length,
      matches,
    });

    return matches[0] || null;
  } catch (err) {
    log('Hostname + IP match failed', {
      status: err.response?.status || 'unknown',
      message: err.message,
      body: err.response?.data || null,
    });
    return null;
  }
}

async function registerUserDevice(endpointId) {
  if (!AUTH_TOKEN || AUTH_TOKEN.includes('PASTE')) {
    log('Device registration skipped', {
      message: 'Set VALIDATION_AUTH_TOKEN to a real JWT before registering the device.',
    });
    return;
  }

  try {
    const res = await axios.post(
      'http://localhost:5001/api/self-help/bitdefender/register-device',
      { hostname: HOSTNAME },
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    log('Register device response', res.data);
  } catch (err) {
    log('Register device failed', {
      status: err.response?.status || 'unknown',
      message: err.message,
      body: err.response?.data || null,
    });
  }
}

async function startScan() {
  if (!AUTH_TOKEN || AUTH_TOKEN.includes('PASTE')) {
    log('Scan start skipped', {
      message: 'Set VALIDATION_AUTH_TOKEN to a real JWT before starting scan validation.',
    });
    return;
  }

  try {
    const res = await axios.post(
      'http://localhost:5001/api/self-help/start',
      { toolId: 'antivirus-scan' },
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    log('Scan start response', res.data);
  } catch (err) {
    log('Scan start failed', {
      status: err.response?.status || 'unknown',
      message: err.message,
      body: err.response?.data || null,
    });
  }
}

(async () => {
  console.log('Starting Bitdefender live validation...');
  console.log('API_BASE=', API_BASE);
  console.log('HOSTNAME=', HOSTNAME);

  try {
    await validateApiKey();
    await validatePackage();
    const endpoint = await matchHostnameAndIp();
    if (endpoint) {
      log('Matched endpoint', endpoint);
    }

    await registerUserDevice(endpoint?.id || null);
    await startScan();
  } catch (err) {
    console.error('Validation flow failed with error:', err.message);
    process.exitCode = 1;
  }
})();
