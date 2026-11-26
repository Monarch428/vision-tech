const router = require('express').Router();
const controller = require('../../controllers/deviceIdentity/deviceIdentity.controller');
const { rateLimit } = require('../../middleware/rateLimit');

const start = rateLimit({ name: 'device-identity-start', windowMs: 10 * 60 * 1000, max: 12, message: 'Too many device-info requests. Please wait and try again.' });
const read = rateLimit({ name: 'device-identity-read', windowMs: 60 * 1000, max: 90, message: 'Too many device-info checks. Please wait and try again.' });
const write = rateLimit({ name: 'device-identity-write', windowMs: 10 * 60 * 1000, max: 12, message: 'Too many device-info submissions. Please wait and try again.' });

// Tokens and collected identifiers must never be retained by browsers or proxies.
router.use((req, res, next) => { res.set('Cache-Control', 'no-store, private, max-age=0').set('Pragma', 'no-cache'); next(); });
router.post('/requests', start, controller.createRequest);
router.get('/requests/:id/helper', start, controller.downloadHelper);
router.get('/requests/:id', read, controller.getRequest);
router.post('/requests/:id/result', write, controller.submitResult);
router.post('/requests/callback/:callbackCode/result', write, controller.submitResultByCallbackCode);
module.exports = router;
