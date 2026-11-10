const positiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

// The legacy/default client must never be allocated to a company. Keeping this
// in one helper also makes a missing setting fail closed rather than allowing a
// tenant to be assigned the shared account by accident.
const getRmmSettings = () => ({
  clientId: positiveInteger(process.env.TACTICALRMM_LEGACY_CLIENT_ID),
});

module.exports = { getRmmSettings };
