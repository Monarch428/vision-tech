const express = require('express');
const router = express.Router();
const {
  getMyPayments,
  getAllPayments,
  createPayment,
  getPaymentById,
  downloadInvoicePdf
} = require('../../controllers/subscription/payment.controller');

const { protect } = require('../../middleware/auth.middleware');

// User routes
router.get('/my', protect, getMyPayments);
router.post('/', protect, createPayment);
router.get('/:id/invoice', protect, downloadInvoicePdf);

// Admin routes
router.get('/', protect, getAllPayments);
router.get('/:id', protect, getPaymentById);

module.exports = router;