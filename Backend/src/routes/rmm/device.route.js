const router = require('express').Router();
const {
  getDevices,
  addDevice,
  toggleMonitoring,
  deleteDevice,
<<<<<<< HEAD
  heartbeat,
} = require('../../controllers/rmm/device.controller');
const { protect } = require('../../middleware/auth.middleware'); // adjust to your existing auth middleware name

router.post('/heartbeat', heartbeat); // agent → no user auth, token-based

router.use(protect); // everything below requires logged-in user
=======
} = require('../../controllers/rmm/device.controller');
const { protect } = require('../../middleware/auth.middleware');

router.use(protect);
>>>>>>> abhinesh
router.get('/', getDevices);
router.post('/', addDevice);
router.patch('/:id/monitoring', toggleMonitoring);
router.delete('/:id', deleteDevice);

module.exports = router;