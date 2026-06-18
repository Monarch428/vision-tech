const express = require('express');
const router = express.Router();

const {
  createUserSubscription,
  getAllUserSubscriptions,
  getUserSubscriptionById,
  updateUserSubscription,
  deleteUserSubscription,
  getMySubscription
} = require('../../controllers/user-management/userSubscription.controller');

const { protect } = require('../../middleware/auth.middleware');

router.get('/me', protect, getMySubscription); 
router.post('/', protect, createUserSubscription);
router.get('/', protect, getAllUserSubscriptions);
router.get('/:id', protect, getUserSubscriptionById);
router.put('/:id', protect, updateUserSubscription);
router.delete('/:id', protect, deleteUserSubscription);

module.exports = router;