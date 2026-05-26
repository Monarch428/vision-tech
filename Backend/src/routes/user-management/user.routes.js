const express = require('express');
const router = express.Router();

const {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserSB
} = require('../../controllers/user-management/user.controller');

const { protect } = require('../../middleware/auth.middleware');

router.post('/', protect, createUser);
router.get('/', protect, getAllUsers);
router.get('/userRole', protect, getUserSB);
router.get('/:id', protect, getUserById);
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, deleteUser);


module.exports = router;