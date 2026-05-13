  const Subscription = require('../../models/subscription/Subscription');
  const Plan = require('../../models/subscription/Plan');
  const Payment = require('../../models/subscription/Payment');
  const User = require('../../models/auth/User');
  const { v4: uuidv4 } = require('uuid');

  // ─── Helper: transform DB doc → frontend shape ────────────────────────────────
  // Frontend expects: { _id, user, planName, status, startDate, endDate, nextRenewalDate }
  const toClientShape = (sub) => {
    const plain = sub.toObject ? sub.toObject() : sub;
    return {
      _id: plain._id,
      sub_id:plain.sub_id,
      user: plain.user,
      planName: plain.plan?.name || plain.plan,   // populated → plan.name, else raw ObjectId
      status: plain.status,
      startDate: plain.startDate,
      endDate: plain.cancelledAt || null,
      nextRenewalDate: plain.nextRenewalDate,
      amount: plain.amount,
    };
  };

  // ─── GET /api/user-subscriptions/my ──────────────────────────────────────────
  const getMySubscription = async (req, res) => {
    try {
      const subscription = await Subscription.findOne({ user: req.user.id })
        .populate('plan', 'name price billingCycle features')
        .sort({ createdAt: -1 });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No subscription found for this user',
        });
      }

      res.status(200).json({
        success: true,
        data: toClientShape(subscription),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching subscription',
        error: error.message,
      });
    }
  };

  // ─── POST /api/user-subscriptions ────────────────────────────────────────────
  const createUserSubscription = async (req, res) => {
    try {
      const { user, planName, startDate } = req.body;

      const lastSub = await Subscription.findOne({
        sub_id: { $exists: true, $ne: null }
      }).sort({ createdAt: -1 });
      
let nextSubId = 'SUB-001';
if (lastSub && lastSub.sub_id) {
  const lastNumber = parseInt(lastSub.sub_id.split('-')[1], 10);
  const newNumber = lastNumber + 1;
  nextSubId = `SUB-${String(newNumber).padStart(3, "0")}`;
}

      const userExists = await User.findById(user);
      if (!userExists) {
        return res.status(400).json({ success: false, message: 'Invalid user' });
      }

      const existing = await Subscription.findOne({ user, status: 'active' });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'An active subscription already exists for this user',
        });
      }

      // 3. Look up plan by name (lowercase for safety)
      const plan = await Plan.findOne({ name: planName?.toLowerCase() });
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: `Plan '${planName}' not found. Run seedPlans.js to create plans.`,
        });
      }

      const now = startDate ? new Date(startDate) : new Date();

      // 4. Free plan never expires — set 100 years ahead
      //    Paid plans renew monthly
      const nextRenewal = new Date(now);
      if (plan.price === 0) {
        nextRenewal.setFullYear(nextRenewal.getFullYear() + 100);
      } else {
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
      }

      // 5. Create the subscription
      const subscription = await Subscription.create({
        sub_id: nextSubId,
        user,
        plan:           plan._id,
        amount:         plan.price,
        status:         'active',
        startDate:      now,
        nextRenewalDate: nextRenewal
      });

      // 6. Record payment for paid plans (was missing before!)
      if (plan.price > 0) {
        await Payment.create({
          user,
          subscription:  subscription._id,
          amount:        plan.price,
          status:        'success',
          paymentMethod: 'paypal',
          paidAt:        new Date(),
        });
      }

      // 7. Return populated shape
      const populated = await Subscription.findById(subscription._id)
        .populate('plan', 'name price');

      res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        data: toClientShape(populated),
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating subscription',
        error: error.message,
      });
    }
  };

  // ─── PUT /api/user-subscriptions/:id ─────────────────────────────────────────
  // Handles: plan upgrade/downgrade AND status changes (cancel, reactivate)
  const updateUserSubscription = async (req, res) => {
    try {
      const { planName, status, cancelledAt } = req.body;

      const subscription = await Subscription.findById(req.params.id).populate('plan', 'name price');
      if (!subscription) {
        return res.status(404).json({ success: false, message: 'Subscription not found' });
      }

      let planChanged = false;
      let newPlan = subscription.plan; // current plan (populated)

      // ── Handle plan change ────────────────────────────────────────────────
      if (planName && planName !== subscription.plan.name) {
        const plan = await Plan.findOne({ name: planName });
        if (!plan) {
          return res.status(400).json({ success: false, message: `Plan '${planName}' not found` });
        }

        subscription.plan = plan._id;
        subscription.amount = plan.price;
        newPlan = plan;
        planChanged = true;

        // Recalculate next renewal from today
        const nextRenewal = new Date();
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        subscription.nextRenewalDate = nextRenewal;
      }

      // ── Handle status change ──────────────────────────────────────────────
      if (status) {
        subscription.status = status;

        if (status === 'cancelled') {
          subscription.cancelledAt = cancelledAt ? new Date(cancelledAt) : new Date();
        }

        if (status === 'active' && subscription.cancelledAt) {
          subscription.cancelledAt = null; // reactivation clears cancelledAt
        }
      }

      await subscription.save();

      // ── Create a Payment record if plan was upgraded/changed ──────────────
      if (planChanged && newPlan.price > 0) {
        await Payment.create({
          user: subscription.user,
          subscription: subscription._id,
          amount: newPlan.price,
          status: 'success',
          paymentMethod: 'paypal',
          paidAt: new Date(),
        });
      }

      const updated = await Subscription.findById(subscription._id).populate('plan', 'name price');

      res.status(200).json({
        success: true,
        message: 'Subscription updated successfully',
        data: toClientShape(updated),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating subscription',
        error: error.message,
      });
    }
  };

  // ─── GET /api/user-subscriptions (Admin) ─────────────────────────────────────
  const getAllUserSubscriptions = async (req, res) => {
    try {
      const subscriptions = await Subscription.find()
        .populate('user', 'name email')
        .populate('plan', 'name price billingCycle')
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        count: subscriptions.length,
        data: subscriptions.map(toClientShape),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching subscriptions',
        error: error.message,
      });
    }
  };

  // ─── GET /api/user-subscriptions/:id ─────────────────────────────────────────
  const getUserSubscriptionById = async (req, res) => {
    try {
      const subscription = await Subscription.findById(req.params.id)
        .populate('user', 'name email')
        .populate('plan', 'name price billingCycle features');

      if (!subscription) {
        return res.status(404).json({ success: false, message: 'Subscription not found' });
      }

      res.status(200).json({
        success: true,
        data: toClientShape(subscription),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching subscription',
        error: error.message,
      });
    }
  };

  // ─── DELETE /api/user-subscriptions/:id (Admin) ──────────────────────────────
  const deleteUserSubscription = async (req, res) => {
    try {
      const subscription = await Subscription.findByIdAndDelete(req.params.id);

      if (!subscription) {
        return res.status(404).json({ success: false, message: 'Subscription not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Subscription deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting subscription',
        error: error.message,
      });
    }
  };

  // GET /api/admin/subscriptions
  const getAllSubscriptions = async (req, res) => {
    try {
      const subscriptions = await Subscription.find()
        .populate('user', 'name email')
        .populate('plan', 'name price billingCycle')
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: subscriptions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching subscriptions',
        error: error.message,
      });
    }
  };

  module.exports = {
    createUserSubscription,
    getMySubscription,
    getAllUserSubscriptions,
    getUserSubscriptionById,
    updateUserSubscription,
    deleteUserSubscription,
    getAllSubscriptions
  };