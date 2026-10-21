const express = require('express');
const router = express.Router();

const {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserSB,
  getUserRole,
  removeMySerialNumber 
} = require('../../controllers/user-management/user.controller');

const { protect, authorize, STAFF_ROLES } = require('../../middleware/auth.middleware');

const staffOnly = authorize(...STAFF_ROLES);

router.post('/', protect, staffOnly, createUser);
router.get('/', protect, staffOnly, getAllUsers);
router.get('/userSB', protect, staffOnly, getUserSB);
router.get('/currentrole', protect, getUserRole);
// Self-or-staff ownership is enforced inside these controllers.
router.get('/:id', protect, getUserById);
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, staffOnly, deleteUser);
router.delete('/serial-numbers/:serialNumber', protect, removeMySerialNumber);

module.exports = router;