const mongoose = require('mongoose');

// One document per gateway payment that has been fulfilled. Inserting it is
// the idempotency check: the unique key means only the first of several
// concurrent fulfilments (e.g. Stripe redirect confirm + webhook) proceeds.
const paymentClaimSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g. "stripe:pi_123"
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentClaim', paymentClaimSchema);
