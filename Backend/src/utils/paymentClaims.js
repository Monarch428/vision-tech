const PaymentClaim = require('../models/subscription/PaymentClaim');

// Exactly-once guard for payment side effects (fulfilling a gateway payment,
// issuing a refund). The unique index makes the first claim win; others see
// `false` and must not repeat the side effect.
let indexReady = null;
const ensureIndex = () => {
  if (!indexReady) indexReady = PaymentClaim.createIndexes().catch((error) => { indexReady = null; throw error; });
  return indexReady;
};

const claim = async (key, user = null) => {
  await ensureIndex();
  try {
    await PaymentClaim.create({ key, user });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
};

// Undo a claim when the side effect failed, so a retry can try again.
const release = (key) => PaymentClaim.deleteOne({ key });

module.exports = { claim, release };
