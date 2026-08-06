const express = require('express');
const router = express.Router();
const {
  createUserSubscription,
  getMySubscription,
  getAllUserSubscriptions,
  getUserSubscriptionById,
  updateUserSubscription,
  deleteUserSubscription,
  getAllSubscriptions
} = require('../../controllers/subscription/userSubscription.controller');

const { protect } = require('../../middleware/auth.middleware');

// User routes
router.get('/my', protect, getMySubscription);
router.post('/', protect, createUserSubscription);
router.put('/:id', protect, updateUserSubscription);

// Admin routes (protect only for now)
router.get('/', protect, getAllUserSubscriptions);
router.get('/subscriptions', getAllSubscriptions);
router.get('/:id', protect, getUserSubscriptionById);
router.get('/subscriptions',protect, getAllSubscriptions);
router.delete('/:id', protect, deleteUserSubscription);

module.exports = router;