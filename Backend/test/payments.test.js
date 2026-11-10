const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');
const { getStripe } = require('../src/utils/stripe');
const paypalUtil = require('../src/utils/paypal');
const Payment = require('../src/models/subscription/Payment');
const PaymentClaim = require('../src/models/subscription/PaymentClaim');
const SystemLog = require('../src/models/system-log/SystemLogs');
const UserManagement = require('../src/models/user-management/User');
const Plan = require('../src/models/subscription/Plan');
const { activatePlan } = require('../src/utils/planActivation');

// Gateways are faked (no network); Stripe webhook signatures are real.
const stripe = getStripe();
const calls = [];
let stripeRefundFails = false;
stripe.refunds.create = async (params) => {
  calls.push(['stripe.refund', params.payment_intent]);
  if (stripeRefundFails) throw new Error('card_declined');
  return { id: `re_${params.payment_intent}` };
};
stripe.refunds.list = async ({ payment_intent: pi }) => ({ data: [{ id: `re_listed_${pi}` }] });
paypalUtil.client.execute = async (request) => {
  calls.push(['paypal', request.path]);
  return { result: { id: 'PAYPAL-REFUND-1' } };
};

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });
beforeEach(async () => {
  calls.length = 0;
  stripeRefundFails = false;
  await Payment.deleteMany({});
  await PaymentClaim.deleteMany({});
  await activatePlan({ userId: t.ids.user, plan: await Plan.findOne({ name: 'free' }) });
});

const pay = async (method, transactionId, planName = 'pro') =>
  (await activatePlan({
    userId: t.ids.user,
    plan: await Plan.findOne({ name: planName }),
    payment: { amount: 49.99, method, transactionId },
  })).payment;
const userPlan = async () => (await UserManagement.findById(t.ids.user).lean()).plan;
const refund = (id, body = { confirm: true, reason: 'Customer request' }, token = t.tokens.admin) =>
  t.request('POST', `/payments/${id}/refund`, { token, body });

test('plans are served from the database, publicly', async () => {
  const res = await t.request('GET', '/plans');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.plans.map((p) => [p.name, p.price]), [['free', 0], ['pro', 49.99], ['enterprise', 149.99]]);
});

test('the payments overview is staff-only and totals by gateway', async () => {
  await pay('stripe', 'pi_a');
  await pay('paypal', 'CAP_A');
  assert.equal((await t.request('GET', '/payments/admin', { token: t.tokens.user })).status, 403);
  const res = await t.request('GET', '/payments/admin', { token: t.tokens.admin });
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 2);
  assert.equal(res.body.totals.stripe.count, 1);
  assert.equal(res.body.totals.paypal.count, 1);
  assert.equal(res.body.payments[0].customer.email, 'user@test.local');
  assert.equal((await t.request('GET', '/payments/admin?gateway=stripe', { token: t.tokens.admin })).body.total, 1);
});

test('customers cannot refund; staff must confirm', async () => {
  const payment = await pay('stripe', 'pi_b');
  assert.equal((await refund(payment._id, { confirm: true }, t.tokens.user)).status, 403);
  assert.equal((await refund(payment._id, {})).status, 400);
  assert.deepEqual(calls, []);
});

test('a Stripe refund refunds at Stripe, records it and moves the customer to Free', async () => {
  const payment = await pay('stripe', 'pi_c');
  assert.equal(await userPlan(), 'pro');
  const res = await refund(payment._id);
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [['stripe.refund', 'pi_c']]);
  const saved = await Payment.findById(payment._id).lean();
  assert.equal(saved.status, 'refunded');
  assert.equal(saved.refundReference, 're_pi_c');
  assert.equal(saved.refundReason, 'Customer request');
  assert.equal(await userPlan(), 'free');
  assert.equal((await refund(payment._id)).status, 409); // never twice
  assert.equal(calls.length, 1);
});

test('a PayPal refund uses the capture refund API', async () => {
  const payment = await pay('paypal', 'CAP_D');
  assert.equal((await refund(payment._id)).status, 200);
  assert.deepEqual(calls, [['paypal', '/v2/payments/captures/CAP_D/refund?']]);
  assert.equal((await Payment.findById(payment._id).lean()).refundReference, 'PAYPAL-REFUND-1');
});

test('a failed gateway refund changes nothing and can be retried', async () => {
  const payment = await pay('stripe', 'pi_e');
  stripeRefundFails = true;
  assert.equal((await refund(payment._id)).status, 502);
  assert.equal((await Payment.findById(payment._id).lean()).status, 'success');
  assert.equal(await userPlan(), 'pro');
  stripeRefundFails = false;
  assert.equal((await refund(payment._id)).status, 200);
});

test('refunding an older payment keeps a plan the customer paid for again', async () => {
  const old = await pay('stripe', 'pi_old');
  await Payment.updateOne({ _id: old._id }, { $set: { paidAt: new Date(Date.now() - 40 * 86400000) } });
  await pay('stripe', 'pi_new');
  assert.equal((await refund(old._id)).status, 200);
  assert.equal(await userPlan(), 'pro');
});

const webhook = async (type, object) => {
  const payload = JSON.stringify({ id: `evt_${Date.now()}`, object: 'event', type, data: { object } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  const res = await fetch(`${t.baseUrl}/payments/stripe/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body: payload,
  });
  return res.status;
};

test('a refund made in the Stripe Dashboard is recorded via webhook', async () => {
  const payment = await pay('stripe', 'pi_dash');
  const status = await webhook('charge.refunded', { id: 'ch_1', payment_intent: 'pi_dash', refunded: true, refunds: { data: [{ id: 're_dash' }] } });
  assert.equal(status, 200);
  const saved = await Payment.findById(payment._id).lean();
  assert.equal(saved.status, 'refunded');
  assert.equal(saved.refundReference, 're_dash');
  assert.equal(await userPlan(), 'free');
  assert.deepEqual(calls, []); // nothing sent back to Stripe
});

test('a dispute is logged for staff', async () => {
  const status = await webhook('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_x', amount: 4999, reason: 'fraudulent' });
  assert.equal(status, 200);
  assert.ok(await SystemLog.exists({ action: 'STRIPE_DISPUTE_CREATED' }));
});

test('a Dashboard refund without embedded refunds still records the refund id', async () => {
  const payment = await pay('stripe', 'pi_noembed');
  assert.equal(await webhook('charge.refunded', { id: 'ch_2', payment_intent: 'pi_noembed', refunded: true }), 200);
  assert.equal((await Payment.findById(payment._id).lean()).refundReference, 're_listed_pi_noembed');
});

test('a lost dispute is treated like a refund; a won dispute changes nothing', async () => {
  const lost = await pay('stripe', 'pi_lost');
  assert.equal(await webhook('charge.dispute.closed', { id: 'dp_l', payment_intent: 'pi_lost', amount: 4999, reason: 'fraudulent', status: 'lost' }), 200);
  assert.equal((await Payment.findById(lost._id).lean()).status, 'refunded');
  assert.equal(await userPlan(), 'free');

  const won = await pay('stripe', 'pi_won');
  assert.equal(await webhook('charge.dispute.closed', { id: 'dp_w', payment_intent: 'pi_won', amount: 4999, reason: 'fraudulent', status: 'won' }), 200);
  assert.equal((await Payment.findById(won._id).lean()).status, 'success');
  assert.equal(await userPlan(), 'pro');
});
