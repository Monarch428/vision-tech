const express = require("express");
const router = express.Router();

const { protect, authorize, STAFF_ROLES } = require('../../middleware/auth.middleware');
const { limits } = require('../../middleware/rateLimit');
const tacticalController = require(
  "../../controllers/rmm/tacticalRmm.controller"
);

const staffOnly = authorize(...STAFF_ROLES);

// Site linking (staff). Declared before "/:id" so "sites" isn't read as an agent id.
router.get("/sites", protect, staffOnly, tacticalController.listSites);
router.put("/sites/link", protect, staffOnly, tacticalController.linkSite);
router.delete("/sites/link/:userId", protect, staffOnly, tacticalController.unlinkSite);

// Staff console: every device with owner, filters and totals; RMM activity log.
router.get("/console", protect, staffOnly, tacticalController.getConsole);
router.get("/audit", protect, staffOnly, tacticalController.getAuditLog);

// Monitoring alerts (customers: own devices; staff: all).
router.get("/alerts", protect, tacticalController.listAlerts);
router.post("/alerts/:alertId/acknowledge", protect, staffOnly, tacticalController.acknowledgeAlert);

// Devices are scoped to the caller's linked Site (staff: whole client).
router.get("/", protect, tacticalController.getDevices);
router.post('/generate-installer', protect, limits.installer, tacticalController.generateInstaller);
router.get("/:id/details", protect, tacticalController.getDeviceDetails);
// Safe, pre-defined actions only; ownership, safety lock, cooldowns and limits are checked in the controller.
router.post("/:id/actions/:action", protect, tacticalController.runDeviceAction);
router.get("/:id", protect, tacticalController.getDevice);
// Uninstalls the agent; ownership and the write safety lock are checked in the controller.
router.delete("/:id", protect, tacticalController.removeDevice);

module.exports = router;
