const UserSubscription = require('../../models/user-management/UserSubscription');
const User = require('../../models/user-management/User');
const Plan = require('../../models/subscription/Plan');

const ACTIVE_USER_MATCH = { deletedAt: null };

// Create Subscription
const createUserSubscription = async (req, res) => {
  try {
    const { user, planName, status, startDate, endDate } = req.body;

    const userExists = await User.findOne({
      _id: user,
      deletedAt: null,
    });

    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or deleted user',
      });
    }

    const existingSubscription = await UserSubscription.findOne({ user });
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Subscription already exists for this user',
      });
    }

    const subscription = await UserSubscription.create({
      user,
      planName,
      status,
      startDate,
      endDate,
    });

    const populatedSubscription = await UserSubscription.findById(subscription._id)
      .populate({
        path: 'user',
        select: 'name email',
        match: ACTIVE_USER_MATCH,
      });

    if (!populatedSubscription || !populatedSubscription.user) {
      return res.status(404).json({
        success: false,
        message: 'Subscription user not found or deleted',
      });
    }

    res.status(201).json({
      success: true,
      message: 'User subscription created successfully',
      data: populatedSubscription,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating subscription',
      error: error.message,
    });
  }
};

const getMySubscription = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.user.id,
      deletedAt: null,
    }).select('name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account deleted',
      });
    }

    const subscription = await UserSubscription.findOne({ user: req.user.id });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found',
      });
    }

    const plan = await Plan.findOne({ name: subscription.planName });

    res.status(200).json({
      success: true,
      data: {
        ...subscription.toObject(),
        user,
        planDetails: plan,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription',
      error: error.message,
    });
  }
};

// Get All Subscriptions
const getAllUserSubscriptions = async (req, res) => {
  try {
    const subscriptions = await UserSubscription.find()
      .populate({
        path: 'user',
        select: 'name email',
        match: ACTIVE_USER_MATCH,
      })
      .sort({ createdAt: -1 });

    const filteredSubscriptions = subscriptions.filter((sub) => sub.user);

    res.status(200).json({
      success: true,
      count: filteredSubscriptions.length,
      data: filteredSubscriptions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching subscriptions',
      error: error.message,
    });
  }
};

// Get Subscription By ID
const getUserSubscriptionById = async (req, res) => {
  try {
    const subscription = await UserSubscription.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name email',
        match: ACTIVE_USER_MATCH,
      });

    if (!subscription || !subscription.user) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }

    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription',
      error: error.message,
    });
  }
};

// Update Subscription
const updateUserSubscription = async (req, res) => {
  try {
    const { user } = req.body;

    if (user) {
      const userExists = await User.findOne({
        _id: user,
        deletedAt: null,
      });

      if (!userExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or deleted user',
        });
      }
    }

    const subscription = await UserSubscription.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate({
      path: 'user',
      select: 'name email',
      match: ACTIVE_USER_MATCH,
    });

    if (!subscription || !subscription.user) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found or user deleted',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscription,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating subscription',
      error: error.message,
    });
  }
};

// Delete Subscription
const deleteUserSubscription = async (req, res) => {
  try {
    const subscription = await UserSubscription.findByIdAndDelete(req.params.id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
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

module.exports = {
  createUserSubscription,
  getAllUserSubscriptions,
  getUserSubscriptionById,
  updateUserSubscription,
  deleteUserSubscription,
  getMySubscription,
};