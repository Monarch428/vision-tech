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

const { protect, authorize, STAFF_ROLES } = require('../../middleware/auth.middleware');

const staffOnly = authorize(...STAFF_ROLES);

// User routes (ownership and allowed changes are checked in the controllers)
router.get('/my', protect, getMySubscription);
router.put('/:id', protect, updateUserSubscription);

// Staff routes
router.post('/', protect, staffOnly, createUserSubscription);
router.get('/', protect, staffOnly, getAllUserSubscriptions);
router.get('/subscriptions', protect, staffOnly, getAllSubscriptions);
router.get('/:id', protect, getUserSubscriptionById);
router.delete('/:id', protect, staffOnly, deleteUserSubscription);

module.exports = router;
