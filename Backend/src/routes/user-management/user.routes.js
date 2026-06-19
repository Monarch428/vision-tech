const express = require('express');
const router = express.Router();

const {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserSB,
  getUserRole
} = require('../../controllers/user-management/user.controller');

const { protect } = require('../../middleware/auth.middleware');

router.post('/',              protect, createUser);
router.get('/',               protect, getAllUsers);
router.get('/userSB',         protect, getUserSB);
router.get('/currentrole',    protect, getUserRole);  
router.get('/:id',            protect, getUserById); 
router.put('/:id',            protect, updateUser);
router.delete('/:id',         protect, deleteUser);

module.exports = router;