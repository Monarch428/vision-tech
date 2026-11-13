const { Router } = require('express');
const { connection, isObjectIdOrHexString } = require('mongoose');
const { protect } = require('../../middleware/auth.middleware');
const {
  activeUser, paidEntitlement, requirePlatformAdmin, requireCompanyMember, requirePaidCompanyMember,
} = require('../../middleware/companyAccess');
const Company = require('../../models/company/Company');
const CompanyMember = require('../../models/company/CompanyMember');
const CompanyProviderAccount = require('../../models/company/CompanyProviderAccount');
const { assignProviderAccount } = require('../../services/companyProviderAccount.service');
const operations = require('../../services/companyOperations.service');
const { migrateLegacyCompanyAssignments } = require('../../services/companyProvisioning.service');

const router = Router();
router.use(protect);
router.use(async (req, res, next) => {
  // Await unique indexes before accepting concurrent writes to pilot data.
  await Promise.all([Company.init(), CompanyMember.init(), CompanyProviderAccount.init()]);
  next();
});

router.get('/me', requireCompanyMember, async (req, res) => {
  const accounts = req.companyPaid
    ? await CompanyProviderAccount.find({ company: req.company._id }).select('provider verifiedAt -_id').lean()
    : [];
  res.json({
    id: req.company._id,
    name: req.company.name,
    role: req.companyRole,
    paid: req.companyPaid,
    providers: accounts,
  });
});

// All provider operations resolve the allocation from the authenticated
// member's company. IDs supplied by the browser are never trusted as scope.
router.get('/me/devices', requirePaidCompanyMember, async (req, res, next) => {
  try { res.json({ success: true, devices: await operations.listCompanyDevices(req.company._id) }); } catch (error) { next(error); }
});

router.get('/me/devices/:agentId', requirePaidCompanyMember, async (req, res, next) => {
  try { res.json({ success: true, device: await operations.getCompanyDevice(req.company._id, req.params.agentId) }); } catch (error) { next(error); }
});

router.post('/me/devices/generate-installer', requirePaidCompanyMember, async (req, res, next) => {
  try { res.json({ success: true, ...(await operations.generateCompanyInstaller(req.company._id, req.body || {})) }); } catch (error) { next(error); }
});

router.get('/me/antivirus/endpoints', requirePaidCompanyMember, async (req, res, next) => {
  try {
    const { items } = await operations.listCompanyAntivirusEndpoints(req.company._id);
    res.json({ success: true, endpoints: items });
  } catch (error) { next(error); }
});

router.post('/me/antivirus/scans', requirePaidCompanyMember, async (req, res, next) => {
  try { res.status(202).json({ success: true, task: await operations.createCompanyAntivirusScan(req.company._id, req.body?.endpointId) }); } catch (error) { next(error); }
});

router.post('/', requirePlatformAdmin, async (req, res) => {
  const { name, billingUser } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    return res.status(400).json({ message: 'Provide a company name of up to 120 characters' });
  }
  const user = await activeUser(billingUser);
  if (user?.role !== 'user' || !await paidEntitlement(user._id)) {
    return res.status(422).json({ message: 'An active, paid customer is required' });
  }
  let company;
  try {
    company = await connection.transaction(async (session) => {
      const created = await Company.findOneAndUpdate(
        { billingUser: user._id },
        { $setOnInsert: { name: name.trim() } },
        { upsert: true, returnDocument: 'after', runValidators: true, session },
      ).lean();
      // The unique user index serializes company creation with member assignment.
      await CompanyMember.updateOne(
        { user: user._id, company: created._id, role: 'owner' },
        { $setOnInsert: { role: 'owner' } },
        { upsert: true, runValidators: true, session },
      );
      return created;
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Customer already belongs to a company' });
    throw error;
  }
  res.json(company);
});

router.post('/migration/legacy', requirePlatformAdmin, async (req, res, next) => {
  try {
    // A dry run is the default; applying requires an explicit true boolean.
    res.json(await migrateLegacyCompanyAssignments({ apply: req.body?.apply === true }));
  } catch (error) { next(error); }
});

router.param('companyId', async (req, res, next, id) => {
  if (!isObjectIdOrHexString(id)) return res.status(400).json({ message: 'Invalid company ID' });
  next();
});

router.put('/:companyId/members/:userId', requirePlatformAdmin, async (req, res) => {
  const company = await Company.findById(req.params.companyId).lean();
  if (!company) return res.status(404).json({ message: 'Company not found' });
  const user = await activeUser(req.params.userId);
  const role = req.body?.role;
  if (user?.role !== 'user' || !['admin', 'member', 'viewer'].includes(role)) {
    return res.status(422).json({ message: 'An active customer and a valid company role are required' });
  }
  try {
    await CompanyMember.updateOne(
      { company: company._id, user: user._id, role: { $ne: 'owner' } }, { $set: { role } }, { upsert: true, runValidators: true },
    );
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Customer already belongs to a company' });
    throw error;
  }
  res.sendStatus(204);
});

router.delete('/:companyId/members/:userId', requirePlatformAdmin, async (req, res) => {
  if (!isObjectIdOrHexString(req.params.userId)) return res.status(400).json({ message: 'Invalid user ID' });
  await CompanyMember.deleteOne({
    company: req.params.companyId, user: req.params.userId, role: { $ne: 'owner' },
  });
  res.sendStatus(204);
});

router.put('/:companyId/providers/:provider', requirePlatformAdmin, async (req, res) => {
  const company = await Company.findById(req.params.companyId).lean();
  if (!company) return res.status(404).json({ message: 'Company not found' });
  if (!await paidEntitlement(company.billingUser)) {
    return res.status(403).json({ message: 'Company requires a paid entitlement' });
  }
  const account = await assignProviderAccount({
    company: company._id,
    provider: req.params.provider,
    body: req.body || {},
    assignedBy: req.user.id,
  });
  res.json(account);
});

router.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(error.status || 500).json({ message: error.message || 'Company operation failed' });
});

module.exports = router;
