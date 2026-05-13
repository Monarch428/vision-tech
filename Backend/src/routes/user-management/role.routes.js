const express = require('express');
const router = express.Router();

const {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
} = require('../../controllers/user-management/role.controller');

const { protect } = require('../../middleware/auth.middleware');

router.post('/', protect, createRole);
router.get('/', protect, getAllRoles);
router.get('/:id', protect, getRoleById);
router.put('/:id', protect, updateRole);
router.delete('/:id', protect, deleteRole);

module.exports = router;