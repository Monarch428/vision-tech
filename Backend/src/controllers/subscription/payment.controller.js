const Payment = require('../../models/subscription/Payment');
const Subscription = require('../../models/subscription/Subscription');
const PDFDocument = require('pdfkit');

// ─── GET /api/payments/my ─────────────────────────────────────────────────────
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user.id })
      .populate('user', 'name email')
      .populate({
        path: 'subscription',
        populate: { path: 'plan', select: 'name price billingCycle' },
      })
      .sort({ paidAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
      error: error.message,
    });
  }
};
// ─── GET /api/payments (Admin) ────────────────────────────────────────────────
const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate({
        path: 'subscription',
        populate: { path: 'plan', select: 'name price' },
      })
      .sort({ paidAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching all payments',
      error: error.message,
    });
  }
};

// ─── GET /api/payments/:id ────────────────────────────────────────────────────
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user', 'name email')
      .populate({
        path: 'subscription',
        populate: { path: 'plan', select: 'name price' },
      });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payment',
      error: error.message,
    });
  }
};

const createPayment = async (req, res) => {
  try {
    const { subscription, amount, status, paymentMethod } = req.body;

    const sub = await Subscription.findById(subscription).populate('plan');
    if (!sub) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription',
      });
    }

    const paymentCount = await Payment.countDocuments();
    const invoiceNumber = `INV-${String(paymentCount + 1).padStart(3, '0')}`;

    const payment = await Payment.create({
      user: req.user.id,
      subscription,
      invoiceNumber,
      amount,
      status: status || 'success',
      paymentMethod: paymentMethod || 'paypal',
      paidAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error recording payment',
      error: error.message,
    });
  }
};

const downloadInvoicePdf = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user', 'name email')
      .populate({
        path: 'subscription',
        populate: { path: 'plan', select: 'name price billingCycle' },
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    if (String(payment.user._id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to download this invoice',
      });
    }

    const plan = payment.subscription?.plan;

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${payment.invoiceNumber || 'invoice'}.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(22).text('Invoice', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice Number: ${payment.invoiceNumber || 'N/A'}`);
    doc.text(`Invoice Date: ${new Date(payment.paidAt).toLocaleDateString()}`);
    doc.text(`Payment Status: ${payment.status}`);
    doc.text(`Payment Method: ${payment.paymentMethod}`);
    doc.moveDown();

    doc.fontSize(14).text('Customer Details', { underline: true });
    doc.fontSize(12).text(`Name: ${payment.user?.name || 'N/A'}`);
    doc.text(`Email: ${payment.user?.email || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Subscription Details', { underline: true });
    doc.fontSize(12).text(`Plan: ${plan?.name || 'N/A'}`);
    doc.text(`Plan Price: $${plan?.price ?? payment.amount}`);
    doc.text(`Subscription ID: ${payment.subscription?._id || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Payment Summary', { underline: true });
    doc.fontSize(12).text(`Amount Paid: $${payment.amount.toFixed(2)}`);
    doc.text(`Paid At: ${new Date(payment.paidAt).toLocaleString()}`);

    doc.moveDown(2);
    doc.text('Thank you for your payment.', { align: 'center' });

    doc.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating invoice PDF',
      error: error.message,
    });
  }
};

module.exports = {
  getMyPayments,
  getAllPayments,
  createPayment,
  getPaymentById,
  downloadInvoicePdf
};