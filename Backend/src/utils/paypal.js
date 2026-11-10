const paypal = require('@paypal/checkout-server-sdk');

// PAYPAL_MODE=live switches to real payments; anything else stays on Sandbox.
const Environment =
  (process.env.PAYPAL_MODE || '').toLowerCase() === 'live'
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

const environment = new Environment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);
const client = new paypal.core.PayPalHttpClient(environment);

module.exports = { paypal, client };
