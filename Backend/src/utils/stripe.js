const Stripe = require('stripe');

// Lazily created so the app (and tests) start without Stripe configured.
let client = null;

const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

const getStripe = () => {
  if (!isStripeConfigured()) {
    throw Object.assign(new Error('Card payments are not configured.'), { status: 503 });
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
};

// Stripe amounts are in the smallest currency unit (cents).
const toCents = (amount) => Math.round(Number(amount) * 100);

module.exports = { getStripe, isStripeConfigured, toCents };
