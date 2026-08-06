const router = require('express').Router();
const {
  getDevices,
  addDevice,
  toggleMonitoring,
  deleteDevice,
} = require('../../controllers/rmm/device.controller');
const { protect } = require('../../middleware/auth.middleware');

router.use(protect);
router.get('/', getDevices);
router.post('/', addDevice);
router.patch('/:id/monitoring', toggleMonitoring);
router.delete('/:id', deleteDevice);

module.exports = router;