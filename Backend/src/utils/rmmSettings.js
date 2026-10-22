const SystemConfig = require('../models/system-config/SystemConfig');

// Tactical RMM settings edited in System Configuration → RMM:
//   clientId        Tactical Client that holds one Site per customer
//   writableSiteIds Sites the app may change: "*" (all), "73,74", or "" (none)
// They are kept in memory so the many synchronous callers stay synchronous.
// The first time the server starts with this feature, the old .env values
// (RMM_CLIENT_ID / RMM_WRITE_ALLOWED_SITE_IDS) are copied into the database
// once; after that the database is the only source. Until the database has
// been read (and in tests) the .env values are used.

const httpError = (status, message) => Object.assign(new Error(message), { status });

let cache = null;

const fromEnv = () => ({
  clientId: Number(process.env.RMM_CLIENT_ID) || null,
  writableSiteIds: String(process.env.RMM_WRITE_ALLOWED_SITE_IDS || '').trim(),
});

const getRmmSettings = () => cache || fromEnv();

// Validates values from the form; returns them normalized.
const normalizeRmmSettings = (input = {}) => {
  const rawClient = input.clientId;
  let clientId = null;
  if (rawClient !== null && rawClient !== undefined && String(rawClient).trim() !== '') {
    clientId = Number(rawClient);
    if (!Number.isInteger(clientId) || clientId <= 0) throw httpError(400, 'RMM Client ID must be a positive whole number.');
  }

  const rawSites = String(input.writableSiteIds ?? '').trim();
  let writableSiteIds = '';
  if (rawSites === '*') {
    writableSiteIds = '*';
  } else if (rawSites) {
    const ids = rawSites.split(',').map((v) => v.trim()).filter(Boolean);
    if (ids.some((v) => !/^\d+$/.test(v) || Number(v) <= 0)) {
      throw httpError(400, 'RMM Site IDs must be "*" or a comma-separated list of numbers, e.g. 73,74.');
    }
    writableSiteIds = [...new Set(ids.map(Number))].join(',');
  }
  return { clientId, writableSiteIds };
};

const applyRmmSettings = (rmm) => {
  cache = { clientId: rmm?.clientId || null, writableSiteIds: String(rmm?.writableSiteIds || '').trim() };
  return cache;
};

// Called once the database is connected.
const loadRmmSettings = async () => {
  const config = await SystemConfig.findOne();
  if (!config) return getRmmSettings();

  if (!config.rmm?.initialized) {
    const initial = normalizeRmmSettings(fromEnv());
    config.rmm = { ...initial, initialized: true };
    await config.save();
  }
  return applyRmmSettings(config.rmm);
};

module.exports = { getRmmSettings, normalizeRmmSettings, applyRmmSettings, loadRmmSettings };
