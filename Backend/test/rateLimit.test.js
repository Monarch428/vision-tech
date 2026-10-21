const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rateLimit } = require('../src/middleware/rateLimit');

const run = (middleware, req) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    headers: {},
    set(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json() { resolve(this.statusCode); },
  };
  middleware(req, res, () => resolve('next'));
});

test('allows up to the limit, then answers 429 with Retry-After', async () => {
  delete process.env.RATE_LIMIT_DISABLED;
  const limiter = rateLimit({ name: `t-${Date.now()}`, windowMs: 60000, max: 2 });
  const req = { ip: '10.0.0.1' };
  assert.equal(await run(limiter, req), 'next');
  assert.equal(await run(limiter, req), 'next');
  assert.equal(await run(limiter, req), 429);
  assert.equal(await run(limiter, { ip: '10.0.0.2' }), 'next'); // other clients unaffected
});

test('can be switched off for development', async () => {
  process.env.RATE_LIMIT_DISABLED = 'true';
  const limiter = rateLimit({ name: `off-${Date.now()}`, windowMs: 60000, max: 0 });
  assert.equal(await run(limiter, { ip: '10.0.0.3' }), 'next');
});
