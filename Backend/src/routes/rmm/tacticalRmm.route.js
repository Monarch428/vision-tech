// const router = require('express').Router();
// const { protect } = require('../../middleware/auth.middleware');
// const ctrl = require('../../controllers/rmm/tacticalRmm.controller');

// router.get('/devices', protect, ctrl.getDevices);
// router.get('/devices/:id', protect, ctrl.getDevice);
// router.post('/devices/:id/run-script', protect, ctrl.runScript);
// router.post('/devices/:id/run-command', protect, ctrl.runCommand);

// module.exports = router;

const express = require("express");
const router = express.Router();

const tacticalController = require(
  "../../controllers/rmm/tacticalRmm.controller"
);

router.get("/", tacticalController.getDevices);
router.get("/:id", tacticalController.getDevice);
router.post('/devices/generate-installer', tacticalController.generateInstaller);

module.exports = router;