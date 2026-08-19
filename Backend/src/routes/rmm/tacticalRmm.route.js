const express = require("express");
const router = express.Router();

const { protect } = require('../../middleware/auth.middleware');
const tacticalController = require(
  "../../controllers/rmm/tacticalRmm.controller"
);

router.get("/", protect, tacticalController.getDevices);
router.get("/:id", protect, tacticalController.getDevice);
router.post('/generate-installer', protect, tacticalController.generateInstaller);

module.exports = router;