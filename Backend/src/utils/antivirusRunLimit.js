const DEFAULT_SCAN_RUN_LIMIT = (() => {
  const raw = Number.parseInt(process.env.BITDEFENDER_SCAN_RUN_LIMIT || '3', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
})();

function getAntivirusRunLimit() {
  const raw = Number.parseInt(process.env.BITDEFENDER_SCAN_RUN_LIMIT || String(DEFAULT_SCAN_RUN_LIMIT), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SCAN_RUN_LIMIT;
}

function canRunAntivirusScan(completedRuns, limit = getAntivirusRunLimit()) {
  const current = Number(completedRuns || 0);
  const maxRuns = Number(limit || getAntivirusRunLimit());
  if (!Number.isFinite(maxRuns) || maxRuns <= 0) return true;
  return current < maxRuns;
}

module.exports = {
  DEFAULT_SCAN_RUN_LIMIT,
  getAntivirusRunLimit,
  canRunAntivirusScan,
};
