const cron = require('node-cron');
const { expireStaleBackups, runScheduledBackups } = require('../utils/fileBackups');
const systemLogger = require('../utils/systemLogger');

// Hourly: fail backups whose device never finished, then start weekly
// automatic backups that are due (offline devices are retried next hour).
const runFileBackupJobs = async () => {
  await expireStaleBackups();
  await runScheduledBackups();
};

const startFileBackupJobs = () => {
  cron.schedule('20 * * * *', () => {
    runFileBackupJobs().catch((error) =>
      systemLogger({ type: 'error', action: 'FILE_BACKUP_JOB_ERROR', details: error.message, module: 'backup' })
    );
  });
};

module.exports = { startFileBackupJobs, runFileBackupJobs };
