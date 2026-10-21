const express = require('express');
const router = express.Router();
const {
  getMyPayments,
  getAllPayments,
  createPayment,
  getPaymentById,
  downloadInvoicePdf,
  createPaypalOrder,
  capturePaypalOrder,
  listPaymentsAdmin,
  refundPaymentHandler,
} = require('../../controllers/subscription/payment.controller');
const { createCheckoutSession, confirmCheckoutSession } = require('../../controllers/subscription/stripe.controller');
const { handlePaypalWebhook } = require('../../controllers/subscription/paypalWebhook.controller');

const { protect, authorize, STAFF_ROLES } = require('../../middleware/auth.middleware');

const staffOnly = authorize(...STAFF_ROLES);

// User routes (ownership is checked in the controllers)
router.get('/my', protect, getMyPayments);
router.get('/:id/invoice', protect, downloadInvoicePdf);

// PayPal: price and plan activation are decided server-side
router.post('/paypal/create-order', protect, createPaypalOrder);
router.post('/paypal/capture-order', protect, capturePaypalOrder);
router.post('/paypal/capture-order/:orderId', protect, capturePaypalOrder);
// PayPal event notifications: no login; each event is verified with PayPal.
router.post('/paypal/webhook', handlePaypalWebhook);

// Stripe Checkout: price and plan activation are decided server-side.
// (The webhook is registered in app.js because it needs the raw request body.)
router.post('/stripe/checkout', protect, createCheckoutSession);
router.post('/stripe/confirm', protect, confirmCheckoutSession);

// Staff routes
router.get('/', protect, staffOnly, getAllPayments);
router.get('/admin', protect, staffOnly, listPaymentsAdmin);
router.post('/:id/refund', protect, staffOnly, refundPaymentHandler);
router.post('/', protect, staffOnly, createPayment);
router.get('/:id', protect, getPaymentById);

module.exports = router;
