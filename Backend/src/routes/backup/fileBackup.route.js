const express = require('express');
const router = express.Router();

const { protect } = require('../../middleware/auth.middleware');
const { rateLimit } = require('../../middleware/rateLimit');
const { PART_BYTES } = require('../../utils/fileBackups');
const controller = require('../../controllers/backup/fileBackup.controller');

const startLimit = rateLimit({
  name: 'file-backup-start', windowMs: 60 * 60 * 1000, max: 10, keyFn: (req) => req.user?.id || req.ip,
  message: 'Too many backups started. Please try again later.',
});

// ── Device side: the RMM backup script, authenticated by its one-time token ──
router.put(
  '/agent/parts/:index',
  express.raw({ type: 'application/octet-stream', limit: PART_BYTES }),
  controller.agentUploadPart
);
router.post('/agent/status', controller.agentReportStatus);

// ── Customers: backups of their own devices ──
router.get('/', protect, controller.listFileBackups);
router.post('/', protect, startLimit, controller.startFileBackup);
router.put('/schedule', protect, controller.setSchedule);
router.get('/:id/download', protect, controller.downloadFileBackup);
router.delete('/:id', protect, controller.deleteFileBackup);

module.exports = router;
