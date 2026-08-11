const cron = require('node-cron');
const { autoLinkPendingEndpoints } = require('../controllers/selfhelp/selfHelp.controller');

// every 5 minutes — cheap call, no need to run it more often
cron.schedule('*/5 * * * *', async () => {
  try {
    await autoLinkPendingEndpoints();
  } catch (err) {
    console.warn('[autoLinkPendingEndpoints] cron run failed:', err.message);
  }
});