const Subscription = require('../../models/subscription/Subscription');
const Plan = require('../../models/subscription/Plan');
const Payment = require('../../models/subscription/Payment');
const User = require('../../models/auth/User');
const { v4: uuidv4 } = require('uuid');
const { getSupportUsage } = require('../../utils/supportUserHelper');
const systemLogger = require("../../utils/systemLogger");

// ─── Helper: transform DB doc → frontend shape ────────────────────────────────
const toClientShape = (sub) => {
  const plain = sub.toObject ? sub.toObject() : sub;
  return {
    _id: plain._id,
    sub_id: plain.sub_id,
    user: plain.user,
    planName: plain.plan?.name || plain.plan,
    status: plain.status,
    startDate: plain.startDate,
    endDate: plain.cancelledAt || null,
    nextRenewalDate: plain.nextRenewalDate,
    amount: plain.amount,
  };
};

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

    const supportUsage = await getSupportUsage(req.user.id, subscription);

    res.status(200).json({
      success: true,
      data: {
        ...toClientShape(subscription),
        supportUsage,
      },
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUBSCRIPTION_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch subscription: ${error.message}`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

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
      sub_id: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    let nextSubId = 'SUB-001';
    if (lastSub && lastSub.sub_id) {
      const lastNumber = parseInt(lastSub.sub_id.split('-')[1], 10);
      const newNumber = lastNumber + 1;
      nextSubId = `SUB-${String(newNumber).padStart(3, '0')}`;
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

    const plan = await Plan.findOne({ name: planName?.toLowerCase() });
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: `Plan '${planName}' not found. Run seedPlans.js to create plans.`,
      });
    }

    const now = startDate ? new Date(startDate) : new Date();
    const nextRenewal = new Date(now);
    if (plan.price === 0) {
      nextRenewal.setFullYear(nextRenewal.getFullYear() + 100);
    } else {
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    }

    const subscription = await Subscription.create({
      sub_id: nextSubId,
      user,
      plan: plan._id,
      amount: plan.price,
      status: 'active',
      startDate: now,
      nextRenewalDate: nextRenewal,
    });

    if (plan.price > 0) {
      await Payment.create({
        user,
        subscription: subscription._id,
        amount: plan.price,
        status: 'success',
        paymentMethod: 'paypal',
        paidAt: new Date(),
      });
    }

    await systemLogger({
      type: "success",
      action: "SUBSCRIPTION_CREATED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Subscription created: ${nextSubId} — plan "${planName}" for user ${user} ($${plan.price})`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

    const populated = await Subscription.findById(subscription._id)
      .populate('plan', 'name price');

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: toClientShape(populated),
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUBSCRIPTION_CREATE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to create subscription: ${error.message}`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: 'Error creating subscription',
      error: error.message,
    });
  }
};

// ─── PUT /api/user-subscriptions/:id ─────────────────────────────────────────
const updateUserSubscription = async (req, res) => {
  try {
    const { planName, status, cancelledAt } = req.body;

    const subscription = await Subscription.findById(req.params.id).populate('plan', 'name price');
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    let planChanged = false;
    let newPlan = subscription.plan;

    if (planName && planName !== subscription.plan.name) {
      const plan = await Plan.findOne({ name: planName });
      if (!plan) {
        return res.status(400).json({ success: false, message: `Plan '${planName}' not found` });
      }

      subscription.plan = plan._id;
      subscription.amount = plan.price;
      newPlan = plan;
      planChanged = true;

      const nextRenewal = new Date();
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
      subscription.nextRenewalDate = nextRenewal;
    }

    const previousStatus = subscription.status;

    if (status) {
      subscription.status = status;

      if (status === 'cancelled') {
        subscription.cancelledAt = cancelledAt ? new Date(cancelledAt) : new Date();
      }

      if (status === 'active' && subscription.cancelledAt) {
        subscription.cancelledAt = null;
      }
    }

    await subscription.save();

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

    // Build a meaningful details string based on what changed
    const changes = [];
    if (planChanged) changes.push(`plan changed to "${planName}" ($${newPlan.price})`);
    if (status && status !== previousStatus) changes.push(`status changed from "${previousStatus}" to "${status}"`);

    await systemLogger({
      type: "success",
      action: "SUBSCRIPTION_UPDATED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Subscription ${req.params.id} updated — ${changes.length ? changes.join(', ') : 'no significant changes'}`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

    const updated = await Subscription.findById(subscription._id).populate('plan', 'name price');

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: toClientShape(updated),
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUBSCRIPTION_UPDATE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to update subscription ${req.params?.id}: ${error.message}`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

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
    await systemLogger({
      type: "error",
      action: "ALL_SUBSCRIPTIONS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch all subscriptions: ${error.message}`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

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
    await systemLogger({
      type: "error",
      action: "SUBSCRIPTION_FETCH_BY_ID_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch subscription ${req.params?.id}: ${error.message}`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

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

    await systemLogger({
      type: "success",
      action: "SUBSCRIPTION_DELETED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Subscription deleted: ${req.params.id} (sub_id: ${subscription.sub_id})`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Subscription deleted successfully',
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUBSCRIPTION_DELETE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to delete subscription ${req.params?.id}: ${error.message}`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: 'Error deleting subscription',
      error: error.message,
    });
  }
};

// ─── GET /api/admin/subscriptions ────────────────────────────────────────────
const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('user', 'name email')
      .populate('plan', 'name price billingCycle')
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments();
    const activeSubscriptions = subscriptions.filter((sub) => sub.status === 'active').length;
    const subscriptionPercentage =
      totalUsers > 0 ? ((activeSubscriptions / totalUsers) * 100).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      totalUsers,
      activeSubscriptions,
      subscriptionPercentage,
      data: subscriptions,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "ADMIN_SUBSCRIPTIONS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch admin subscriptions overview: ${error.message}`,
      module: "subscriptions",
      ipAddress: req.ip,
    });

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
  getAllSubscriptions,
};