const Payment = require('../../models/subscription/Payment');
const Subscription = require('../../models/subscription/Subscription');
const Plan = require('../../models/subscription/Plan');
const PDFDocument = require('pdfkit');
const { refundPayment } = require('../../utils/refunds');
const { fulfilPaypalCapture, recordPendingCapture, recordFailedCapture, parseCustomId } = require('../../utils/paypalPayments');
const UserManagement = require('../../models/user-management/User');
const { isStaff } = require('../../middleware/auth.middleware');
const { paypal, client } = require('../../utils/paypal');
const systemLogger = require("../../utils/systemLogger");

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
    await systemLogger({
      type: "error",
      action: "PAYMENTS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch user payments: ${error.message}`,
      module: "payments",
      ipAddress: req.ip,
    });

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
    await systemLogger({
      type: "error",
      action: "ALL_PAYMENTS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch all payments: ${error.message}`,
      module: "payments",
      ipAddress: req.ip,
    });

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

    if (String(payment.user?._id) !== String(req.user.id) && !isStaff(req)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this payment' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "PAYMENT_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch payment ${req.params?.id}: ${error.message}`,
      module: "payments",
      ipAddress: req.ip,
    });

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

    await systemLogger({
      type: "success",
      action: "PAYMENT_CREATED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Payment recorded: ${invoiceNumber} — $${amount} via ${paymentMethod || 'paypal'} (status: ${status || 'success'})`,
      module: "payments",
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "PAYMENT_CREATE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to record payment: ${error.message}`,
      module: "payments",
      ipAddress: req.ip,
    });

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

    if (String(payment.user._id) !== String(req.user.id) && !isStaff(req)) {
      await systemLogger({
        type: "error",
        action: "INVOICE_DOWNLOAD_UNAUTHORIZED",
        user: req.user?._id,
        userEmail: req.user?.email,
        details: `Unauthorized attempt to download invoice ${payment.invoiceNumber} (payment ${req.params.id})`,
        module: "payments",
        ipAddress: req.ip,
      });

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
    const methodLabels = { paypal: 'PayPal', stripe: 'Card (Stripe)' };
    doc.text(`Payment Method: ${methodLabels[payment.paymentMethod] || payment.paymentMethod}`);
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

    await systemLogger({
      type: "success",
      action: "INVOICE_DOWNLOADED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Invoice downloaded: ${payment.invoiceNumber} — $${payment.amount.toFixed(2)}`,
      module: "payments",
      ipAddress: req.ip,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "INVOICE_DOWNLOAD_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to generate invoice PDF for payment ${req.params?.id}: ${error.message}`,
      module: "payments",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: 'Error generating invoice PDF',
      error: error.message,
    });
  }
};

// ─── POST /api/payments/paypal/create-order ───────────────────────────────────
// The price always comes from the Plan collection, never from the client.
const createPaypalOrder = async (req, res) => {
  try {
    const planName = String(req.body.planName || '').toLowerCase();
    const plan = await Plan.findOne({ name: planName });
    if (!plan || plan.price <= 0) {
      return res.status(400).json({ message: 'Choose a valid paid plan' });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        custom_id: `${req.user.id}:${plan.name}`,
        description: `Vision Tech ${plan.name} plan (${plan.billingCycle})`,
        amount: { currency_code: 'USD', value: plan.price.toFixed(2) },
      }],
    });
    const order = await client.execute(request);

    await systemLogger({
      type: "success",
      action: "PAYPAL_ORDER_CREATED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `PayPal order created: ${order.result.id} — ${plan.name} $${plan.price}`,
      module: "payments",
      ipAddress: req.ip,
    });

    res.json({ id: order.result.id });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "PAYPAL_ORDER_CREATE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to create PayPal order: ${error.message}`,
      module: "payments",
      ipAddress: req.ip,
    });

    res.status(500).json({ message: 'Failed to create PayPal order', error: error.message });
  }
};

// ─── POST /api/payments/paypal/capture-order ──────────────────────────────────
// Captures the buyer-approved order and handles every outcome: COMPLETED
// activates the plan, PENDING is recorded and completed later by the webhook,
// DECLINED asks the buyer to choose another funding source.
const shapeSubscription = (sub) => ({
  _id: sub._id,
  sub_id: sub.sub_id,
  user: sub.user,
  planName: sub.plan?.name,
  status: sub.status,
  startDate: sub.startDate,
  endDate: sub.cancelledAt || null,
  nextRenewalDate: sub.nextRenewalDate,
  amount: sub.amount,
});

const capturePaypalOrder = async (req, res) => {
  const orderId = req.params.orderId || req.body?.orderId;
  try {
    if (!orderId) {
      return res.status(400).json({ message: 'orderId is required' });
    }

    let capture;
    try {
      capture = await client.execute(new paypal.orders.OrdersCaptureRequest(orderId));
    } catch (error) {
      // PayPal rejected the funding source (e.g. card declined): the buyer can
      // pick another one in the same PayPal window.
      if (/INSTRUMENT_DECLINED/.test(error.message)) {
        await systemLogger({
          type: 'warning', action: 'PAYPAL_INSTRUMENT_DECLINED', user: req.user?._id, userEmail: req.user?.email,
          details: `PayPal order ${orderId}: funding source declined`, module: 'payments', ipAddress: req.ip,
        });
        return res.status(402).json({ code: 'INSTRUMENT_DECLINED', message: 'PayPal declined that payment method. Please choose another one.' });
      }
      if (/ORDER_ALREADY_CAPTURED/.test(error.message)) {
        return res.status(409).json({ message: 'This payment was already processed' });
      }
      throw error;
    }

    const unit = capture.result.purchase_units?.[0];
    const captured = unit?.payments?.captures?.[0];
    if (!captured) {
      return res.status(402).json({ message: `Payment not completed (status: ${capture.result.status})` });
    }
    captured.custom_id = captured.custom_id || unit?.custom_id;

    if (parseCustomId(captured.custom_id).userId !== String(req.user.id)) {
      return res.status(403).json({ message: 'This order belongs to a different user' });
    }

    if (captured.status === 'PENDING') {
      await recordPendingCapture(captured);
      return res.status(202).json({
        pending: true,
        message: 'PayPal is reviewing this payment. Your plan will activate automatically once PayPal completes it.',
      });
    }
    if (captured.status !== 'COMPLETED') {
      await recordFailedCapture(captured.id, captured.status);
      return res.status(402).json({ message: `PayPal did not complete the payment (status: ${captured.status}).` });
    }

    const result = await fulfilPaypalCapture(captured, { expectedUserId: req.user.id });
    if (result.alreadyProcessed) {
      return res.status(409).json({ message: 'This payment was already processed' });
    }

    const populated = await Subscription.findById(result.subscription._id).populate('plan', 'name price');
    res.json({ success: true, subscription: shapeSubscription(populated), payment: result.payment });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "PAYPAL_ORDER_CAPTURE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to capture PayPal order ${orderId}: ${error.message}`,
      module: "payments",
      ipAddress: req.ip,
    });

    res.status(error.status || 500).json({ message: 'Failed to capture PayPal order', error: error.message });
  }
};

// ─── Staff: payments overview and refunds ─────────────────────────────────────

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/payments/admin?gateway=&status=&search=&from=&to=&page=
const listPaymentsAdmin = async (req, res) => {
  try {
    const { gateway, status, search, from, to } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 25, 100);

    const filter = {};
    if (gateway) filter.paymentMethod = gateway;
    if (status) filter.status = status;
    if (from || to) {
      filter.paidAt = {};
      if (from) filter.paidAt.$gte = new Date(from);
      if (to) filter.paidAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    if (search) {
      const term = new RegExp(escapeRegex(search), 'i');
      const users = await UserManagement.find({ $or: [{ email: term }, { name: term }] }).select('_id').lean();
      filter.$or = [{ invoiceNumber: term }, { user: { $in: users.map((u) => u._id) } }];
    }

    // Older payments don't store the plan; infer it from the amount paid
    // (never from the customer's current plan, which may have changed since).
    const planByPrice = new Map((await Plan.find().select('name price').lean()).map((pl) => [pl.price, pl.name]));

    const [payments, total, totals] = await Promise.all([
      Payment.find(filter).sort({ paidAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('user', 'name email').populate({ path: 'subscription', populate: { path: 'plan', select: 'name' } }).lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([
        { $match: filter },
        { $group: { _id: { method: '$paymentMethod', status: '$status' }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
    ]);

    const sum = (pred) => totals.filter(pred).reduce((acc, t) => ({ count: acc.count + t.count, amount: acc.amount + t.amount }), { count: 0, amount: 0 });
    res.json({
      success: true,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
      totals: {
        received: sum((t) => t._id.status === 'success'),
        refunded: sum((t) => t._id.status === 'refunded'),
        paypal: sum((t) => t._id.method === 'paypal' && t._id.status === 'success'),
        stripe: sum((t) => t._id.method === 'stripe' && t._id.status === 'success'),
      },
      payments: payments.map((p) => ({
        id: p._id,
        invoiceNumber: p.invoiceNumber,
        paidAt: p.paidAt,
        amount: p.amount,
        status: p.status,
        paymentMethod: p.paymentMethod,
        planName: p.planName || planByPrice.get(p.amount) || null,
        customer: p.user ? { id: p.user._id, name: p.user.name, email: p.user.email } : null,
        transactionId: p.transactionId || null,
        refundedAt: p.refundedAt,
        refundReason: p.refundReason,
        refundable: p.status === 'success' && Boolean(p.transactionId) && ['paypal', 'stripe'].includes(p.paymentMethod),
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payments/:id/refund { confirm: true, reason }
const refundPaymentHandler = async (req, res) => {
  try {
    if (req.body?.confirm !== true) return res.status(400).json({ success: false, message: 'Please confirm the refund.' });
    const reason = String(req.body.reason || '').trim().slice(0, 300) || null;
    const { payment, downgraded } = await refundPayment({
      paymentId: req.params.id,
      actor: { id: req.user.id, email: req.user.email },
      reason,
    });
    res.json({
      success: true,
      message: `Refunded ${payment.invoiceNumber} ($${payment.amount}).${downgraded ? ' The customer is now on the Free plan.' : ''}`,
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listPaymentsAdmin,
  refundPaymentHandler,
  getMyPayments,
  getAllPayments,
  createPayment,
  getPaymentById,
  downloadInvoicePdf,
  createPaypalOrder,
  capturePaypalOrder,
};
