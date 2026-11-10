const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');
const paypalUtil = require('../src/utils/paypal');
const Payment = require('../src/models/subscription/Payment');
const PaymentClaim = require('../src/models/subscription/PaymentClaim');
const UserManagement = require('../src/models/user-management/User');
const Plan = require('../src/models/subscription/Plan');
const { activatePlan } = require('../src/utils/planActivation');

// PayPal is faked: each test decides what "PayPal" answers. No network.
let captureReply;          // (orderId) => result | throws
let verification = 'SUCCESS';
paypalUtil.client.execute = async (request) => {
  if (request.path.startsWith('/v1/notifications/verify-webhook-signature')) {
    return { result: { verification_status: verification } };
  }
  const capture = request.path.match(/\/v2\/checkout\/orders\/([^/]+)\/capture/);
  if (capture) return { result: await captureReply(capture[1]) };
  throw new Error(`unexpected PayPal call ${request.path}`);
};

const order = (status, captureStatus, { userId, captureId = `CAP-${Date.now()}`, amount = '49.99', plan = 'pro' } = {}) => ({
  id: 'ORDER-1',
  status,
  purchase_units: [{
    custom_id: `${userId}:${plan}`,
    payments: { captures: [{ id: captureId, status: captureStatus, amount: { currency_code: 'USD', value: amount }, custom_id: `${userId}:${plan}` }] },
  }],
});

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });
beforeEach(async () => {
  verification = 'SUCCESS';
  await Payment.deleteMany({});
  await PaymentClaim.deleteMany({});
  await activatePlan({ userId: t.ids.user, plan: await Plan.findOne({ name: 'free' }) });
});

const capture = () => t.request('POST', '/payments/paypal/capture-order', { token: t.tokens.user, body: { orderId: 'ORDER-1' } });
const webhook = (event_type, resource) => t.request('POST', '/payments/paypal/webhook', { body: { id: `WH-${Date.now()}`, event_type, resource } });
const plan = async () => (await UserManagement.findById(t.ids.user).lean()).plan;

test('completed capture activates the plan once', async () => {
  captureReply = () => order('COMPLETED', 'COMPLETED', { userId: t.ids.user, captureId: 'CAP-OK' });
  const res = await capture();
  assert.equal(res.status, 200);
  assert.equal(res.body.subscription.planName, 'pro');
  assert.equal(await plan(), 'pro');
  assert.equal((await capture()).status, 409); // same capture again
  assert.equal(await Payment.countDocuments({ transactionId: 'CAP-OK' }), 1);
});

test('pending capture waits, then the webhook completes it', async () => {
  captureReply = () => order('COMPLETED', 'PENDING', { userId: t.ids.user, captureId: 'CAP-PEND' });
  const res = await capture();
  assert.equal(res.status, 202);
  assert.equal(res.body.pending, true);
  assert.equal(await plan(), 'free');
  assert.equal((await Payment.findOne({ transactionId: 'CAP-PEND' }).lean()).status, 'pending');

  const hook = await webhook('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-PEND', status: 'COMPLETED', amount: { currency_code: 'USD', value: '49.99' }, custom_id: `${t.ids.user}:pro` });
  assert.equal(hook.status, 200);
  const payment = await Payment.findOne({ transactionId: 'CAP-PEND' }).lean();
  assert.equal(payment.status, 'success');
  assert.ok(payment.invoiceNumber);
  assert.equal(await plan(), 'pro');
  assert.equal(await Payment.countDocuments({ transactionId: 'CAP-PEND' }), 1);
});

test('a pending capture that PayPal later denies is marked failed', async () => {
  captureReply = () => order('COMPLETED', 'PENDING', { userId: t.ids.user, captureId: 'CAP-DENY' });
  await capture();
  assert.equal((await webhook('PAYMENT.CAPTURE.DENIED', { id: 'CAP-DENY' })).status, 200);
  assert.equal((await Payment.findOne({ transactionId: 'CAP-DENY' }).lean()).status, 'failed');
  assert.equal(await plan(), 'free');
});

test('a declined funding source asks the buyer to choose another', async () => {
  captureReply = () => { throw Object.assign(new Error('{"name":"UNPROCESSABLE_ENTITY","details":[{"issue":"INSTRUMENT_DECLINED"}]}'), { statusCode: 422 }); };
  const res = await capture();
  assert.equal(res.status, 402);
  assert.equal(res.body.code, 'INSTRUMENT_DECLINED');
  assert.equal(await Payment.countDocuments({}), 0);
});

test("someone else's order is refused", async () => {
  captureReply = () => order('COMPLETED', 'COMPLETED', { userId: t.ids.admin });
  assert.equal((await capture()).status, 403);
  assert.equal(await plan(), 'free');
});

test('an underpaid capture is refused', async () => {
  captureReply = () => order('COMPLETED', 'COMPLETED', { userId: t.ids.user, amount: '1.00' });
  assert.equal((await capture()).status, 400);
  assert.equal(await plan(), 'free');
});

test('unverified webhooks are ignored', async () => {
  verification = 'FAILURE';
  const res = await webhook('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-FORGED', status: 'COMPLETED', amount: { currency_code: 'USD', value: '49.99' }, custom_id: `${t.ids.user}:pro` });
  assert.equal(res.status, 400);
  assert.equal(await plan(), 'free');
});

test('refunds and reversals made in PayPal are recorded', async () => {
  captureReply = () => order('COMPLETED', 'COMPLETED', { userId: t.ids.user, captureId: 'CAP-REF' });
  await capture();
  const up = { rel: 'up', href: 'https://api.sandbox.paypal.com/v2/payments/captures/CAP-REF' };
  assert.equal((await webhook('PAYMENT.CAPTURE.REFUNDED', { id: 'REF-1', links: [up] })).status, 200);
  let payment = await Payment.findOne({ transactionId: 'CAP-REF' }).lean();
  assert.equal(payment.status, 'refunded');
  assert.equal(payment.refundReason, 'Refunded in PayPal');
  assert.equal(await plan(), 'free');

  captureReply = () => order('COMPLETED', 'COMPLETED', { userId: t.ids.user, captureId: 'CAP-REV' });
  await capture();
  await webhook('PAYMENT.CAPTURE.REVERSED', { id: 'REV-1', links: [{ rel: 'up', href: 'https://api.sandbox.paypal.com/v2/payments/captures/CAP-REV' }] });
  payment = await Payment.findOne({ transactionId: 'CAP-REV' }).lean();
  assert.equal(payment.status, 'refunded');
  assert.match(payment.refundReason, /chargeback/);
});
