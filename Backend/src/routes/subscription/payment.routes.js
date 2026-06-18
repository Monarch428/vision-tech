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

const { protect } = require('../../middleware/auth.middleware');

// User routes
router.get('/my', protect, getMyPayments);
router.post('/', protect, createPayment);
router.get('/:id/invoice', protect, downloadInvoicePdf);

// Admin routes
router.get('/', protect, getAllPayments);
router.get('/:id', protect, getPaymentById);

//paypal
//paypal
router.post('/paypal/create-order', protect, createPaypalOrder);
router.post('/paypal/capture-order', protect, capturePaypalOrder);

module.exports = router;