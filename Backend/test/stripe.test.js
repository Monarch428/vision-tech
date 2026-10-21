const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');
const { getStripe } = require('../src/utils/stripe');
const Payment = require('../src/models/subscription/Payment');
const Subscription = require('../src/models/subscription/Subscription');
const PaymentClaim = require('../src/models/subscription/PaymentClaim');
const UserManagement = require('../src/models/user-management/User');
const Plan = require('../src/models/subscription/Plan');
const { activatePlan } = require('../src/utils/planActivation');

// Stripe's API is faked (no network); webhook signatures are real (Stripe SDK).
const stripe = getStripe();
const sessions = new Map();
let created = [];
stripe.checkout.sessions.create = async (params) => {
  created.push(params);
  return { id: `cs_test_${created.length}`, url: `https://checkout.stripe.test/${created.length}` };
};
stripe.checkout.sessions.retrieve = async (id) => {
  if (!sessions.has(id)) throw Object.assign(new Error('No such session'), { statusCode: 404 });
  return sessions.get(id);
};

const paidSession = (id, userId, overrides = {}) => ({
  id, object: 'checkout.session', status: 'complete', payment_status: 'paid', currency: 'usd',
  amount_total: 4999, payment_intent: `pi_${id}`, client_reference_id: userId,
  metadata: { userId, planName: 'pro' }, ...overrides,
});

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });
beforeEach(async () => {
  created = [];
  sessions.clear();
  await Payment.deleteMany({});
  await PaymentClaim.deleteMany({});
  await activatePlan({ userId: t.ids.user, plan: await Plan.findOne({ name: 'free' }) });
});

const confirm = (sessionId, token = t.tokens.user) => t.request('POST', '/payments/stripe/confirm', { token, body: { sessionId } });
const userPlan = async () => (await UserManagement.findById(t.ids.user).lean()).plan;

const sendWebhook = async (session, secret = process.env.STRIPE_WEBHOOK_SECRET) => {
  const payload = JSON.stringify({ id: `evt_${session.id}`, object: 'event', type: 'checkout.session.completed', data: { object: session } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(`${t.baseUrl}/payments/stripe/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body: payload,
  });
  return res.status;
};

test('checkout is priced by the server', async () => {
  assert.equal((await t.request('POST', '/payments/stripe/checkout', { token: t.tokens.user, body: { planName: 'free' } })).status, 400);
  const res = await t.request('POST', '/payments/stripe/checkout', { token: t.tokens.user, body: { planName: 'pro', amount: 1 } });
  assert.equal(res.status, 200);
  assert.match(res.body.url, /^https:\/\/checkout\.stripe\.test\//);
  assert.equal(created[0].line_items[0].price_data.unit_amount, 4999);
  assert.equal(created[0].metadata.userId, t.ids.user);
  assert.equal(created[0].metadata.planName, 'pro');
});

test('an unpaid session does not activate anything', async () => {
  sessions.set('cs_unpaid', paidSession('cs_unpaid', t.ids.user, { payment_status: 'unpaid', status: 'open' }));
  assert.equal((await confirm('cs_unpaid')).status, 402);
  assert.equal(await userPlan(), 'free');
});

test("someone else's session is refused", async () => {
  sessions.set('cs_other', paidSession('cs_other', t.ids.admin));
  assert.equal((await confirm('cs_other')).status, 403);
  assert.equal(await userPlan(), 'free');
});

test('an underpaid session is refused', async () => {
  sessions.set('cs_cheap', paidSession('cs_cheap', t.ids.user, { amount_total: 100 }));
  assert.equal((await confirm('cs_cheap')).status, 400);
  assert.equal(await userPlan(), 'free');
});

test('a paid session activates the plan once, even if confirmed twice', async () => {
  sessions.set('cs_paid', paidSession('cs_paid', t.ids.user));
  const first = await confirm('cs_paid');
  assert.equal(first.status, 200);
  assert.equal(first.body.subscription.planName, 'pro');
  assert.equal(await userPlan(), 'pro');
  const renewal = (await Subscription.findOne({ user: t.ids.user }).lean()).nextRenewalDate;

  const second = await confirm('cs_paid');
  assert.equal(second.status, 200);
  assert.equal(second.body.alreadyProcessed, true);
  assert.equal(await Payment.countDocuments({ user: t.ids.user, paymentMethod: 'stripe' }), 1);
  assert.equal((await Subscription.findOne({ user: t.ids.user }).lean()).nextRenewalDate.getTime(), renewal.getTime());
});

test('the webhook verifies signatures and does not double-activate', async () => {
  const session = paidSession('cs_hook', t.ids.user);
  assert.equal(await sendWebhook(session, 'whsec_wrong'), 400);
  assert.equal(await userPlan(), 'free');

  assert.equal(await sendWebhook(session), 200);
  assert.equal(await userPlan(), 'pro');
  sessions.set('cs_hook', session);
  assert.equal((await confirm('cs_hook')).body.alreadyProcessed, true);
  assert.equal(await Payment.countDocuments({ user: t.ids.user, paymentMethod: 'stripe' }), 1);
});

test('confirm and webhook arriving together activate only once', async () => {
  const session = paidSession('cs_race', t.ids.user);
  sessions.set('cs_race', session);
  await Promise.all([confirm('cs_race'), sendWebhook(session), confirm('cs_race')]);
  assert.equal(await Payment.countDocuments({ user: t.ids.user, paymentMethod: 'stripe' }), 1);
  const sub = await Subscription.findOne({ user: t.ids.user }).lean();
  const months = (sub.nextRenewalDate.getUTCFullYear() - new Date().getUTCFullYear()) * 12 + sub.nextRenewalDate.getUTCMonth() - new Date().getUTCMonth();
  assert.equal(months, 1);
});
