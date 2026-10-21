const express = require('express');
const Plan = require('../../models/subscription/Plan');

const router = express.Router();

// GET /api/plans — public price list, so the Billing page shows exactly what the
// server will charge (prices live only in the database).
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.find().select('name price billingCycle features').sort({ price: 1 }).lean();
    res.json({ success: true, plans: plans.map(({ name, price, billingCycle, features }) => ({ name, price, billingCycle, features })) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
