const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },

    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ['success', 'failed', 'pending', 'refunded'],
      default: 'success',
    },

    paymentMethod: {
      type: String,
      default: 'card',
    },

    // Gateway capture/charge id; unique so a capture can't be recorded twice.
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },

    // Plan bought with this payment (for reporting and refunds).
    planName: { type: String, default: null },

    // Set when the payment was refunded (from the portal or in the gateway's dashboard).
    refundedAt: { type: Date, default: null },
    refundReference: { type: String, default: null }, // gateway refund id
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    refundReason: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Payment', paymentSchema);