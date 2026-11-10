// Minimal in-memory fixed-window rate limiter. Counts are per server process,
// which suits a single instance; use a shared store (e.g. Redis) if the API is
// ever scaled to several instances. RATE_LIMIT_DISABLED=true turns it off.
const buckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60 * 1000).unref();

// `keyFn(req)` decides who is being limited (IP, IP+email, user id…).
const rateLimit = ({ name, windowMs, max, keyFn = (req) => req.ip, message }) => (req, res, next) => {
  if (process.env.RATE_LIMIT_DISABLED === 'true') return next();

  const key = `${name}:${keyFn(req)}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ message: message || 'Too many requests. Please try again later.', retryAfter });
  }
  next();
};

const MIN = 60 * 1000;
const emailOf = (req) => String(req.body?.email || '').trim().toLowerCase();

const limits = {
  loginPerAccount: rateLimit({ name: 'login-acct', windowMs: 15 * MIN, max: 10, keyFn: (req) => `${req.ip}:${emailOf(req)}`, message: 'Too many login attempts. Please wait 15 minutes.' }),
  loginPerIp: rateLimit({ name: 'login-ip', windowMs: 15 * MIN, max: 100 }),
  sendCode: rateLimit({ name: 'send-code', windowMs: 15 * MIN, max: 5, message: 'Too many code requests. Please wait 15 minutes.' }),
  verifyCode: rateLimit({ name: 'verify-code', windowMs: 15 * MIN, max: 15, message: 'Too many verification attempts. Please wait 15 minutes.' }),
  resetPassword: rateLimit({ name: 'reset-password', windowMs: 15 * MIN, max: 10 }),
  register: rateLimit({ name: 'register', windowMs: 60 * MIN, max: 10, message: 'Too many sign-ups from this network. Please try again later.' }),
  installer: rateLimit({ name: 'installer', windowMs: 60 * MIN, max: 20, keyFn: (req) => req.user?.id || req.ip, message: 'Too many installer links requested. Please try again later.' }),
};

module.exports = { rateLimit, limits };
