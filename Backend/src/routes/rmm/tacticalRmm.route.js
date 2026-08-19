const express = require("express");
const router = express.Router();

const tacticalController = require(
  "../../controllers/rmm/tacticalRmm.controller"
);

router.get("/", tacticalController.getDevices);
router.get("/:id", tacticalController.getDevice);
router.post('/generate-installer', tacticalController.generateInstaller);

module.exports = router;