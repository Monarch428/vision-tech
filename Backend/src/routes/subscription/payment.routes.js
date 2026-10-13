const express = require('express');
const router = express.Router();
const {
  getMyPayments,
  getAllPayments,
  createPayment,
  getPaymentById,
  downloadInvoicePdf,
  createPaypalOrder,
  capturePaypalOrder
} = require('../../controllers/subscription/payment.controller');

const { protect, authorize, STAFF_ROLES } = require('../../middleware/auth.middleware');

const staffOnly = authorize(...STAFF_ROLES);

// User routes (ownership is checked in the controllers)
router.get('/my', protect, getMyPayments);
router.get('/:id/invoice', protect, downloadInvoicePdf);

// PayPal: price and plan activation are decided server-side
router.post('/paypal/create-order', protect, createPaypalOrder);
router.post('/paypal/capture-order', protect, capturePaypalOrder);
router.post('/paypal/capture-order/:orderId', protect, capturePaypalOrder);

// Staff routes
router.get('/', protect, staffOnly, getAllPayments);
router.post('/', protect, staffOnly, createPayment);
router.get('/:id', protect, getPaymentById);

module.exports = router;
