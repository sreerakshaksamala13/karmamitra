const Site = require('../models/Site');
const Worker = require('../models/Worker');
const WorkAssignment = require('../models/WorkAssignment');
const asyncHandler = require('../utils/asyncHandler');

const ownerFilter = (req) => ({ createdBy: req.user._id });

/**
 * GET /api/sites?active=
 */
const listSites = asyncHandler(async (req, res) => {
  const filter = ownerFilter(req);
  if (req.query.active === 'true') filter.active = true;
  if (req.query.active === 'false') filter.active = false;

  const sites = await Site.find(filter).sort({ createdAt: -1 }).lean();

  // Attach a quick worker count to every site for the dashboard cards.
  const counts = await Worker.aggregate([
    { $match: { ...ownerFilter(req), site: { $ne: null }, active: true } },
    { $group: { _id: '$site', workers: { $sum: 1 } } },
  ]);
  const countMap = counts.reduce((acc, c) => ({ ...acc, [String(c._id)]: c.workers }), {});

  return res.json(sites.map((s) => ({ ...s, workerCount: countMap[String(s._id)] || 0 })));
});

/**
 * GET /api/sites/:id
 */
const getSite = asyncHandler(async (req, res) => {
  const site = await Site.findOne({ _id: req.params.id, ...ownerFilter(req) });
  if (!site) return res.status(404).json({ message: 'Site not found' });
  return res.json(site);
});

/**
 * POST /api/sites
 */
const createSite = asyncHandler(async (req, res) => {
  const site = await Site.create({ ...req.body, createdBy: req.user._id });
  return res.status(201).json(site);
});

/**
 * PUT /api/sites/:id
 */
const updateSite = asyncHandler(async (req, res) => {
  const editable = [
    'name',
    'location',
    'clientName',
    'clientPhone',
    'startDate',
    'dailyRateToClient',
    'active',
    'notes',
  ];
  const updates = Object.fromEntries(
    editable.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]])
  );
  const site = await Site.findOneAndUpdate(
    { _id: req.params.id, ...ownerFilter(req) },
    updates,
    { new: true, runValidators: true }
  );
  if (!site) return res.status(404).json({ message: 'Site not found' });
  return res.json(site);
});

/**
 * DELETE /api/sites/:id
 */
const deleteSite = asyncHandler(async (req, res) => {
  const site = await Site.findOne({ _id: req.params.id, ...ownerFilter(req) });
  if (!site) return res.status(404).json({ message: 'Site not found' });

  const workerFilter = { site: req.params.id, ...ownerFilter(req) };
  const [workerCount, assignmentCount] = await Promise.all([
    Worker.countDocuments(workerFilter),
    WorkAssignment.countDocuments({ site: req.params.id, ...ownerFilter(req) }),
  ]);
  if ((workerCount || assignmentCount) && req.query.force !== 'true') {
    return res.status(409).json({
      message: `This site has ${workerCount} worker(s) assigned and ${assignmentCount} dispatch record(s). Reassign workers first or pass force=true to remove the site.`,
      workerCount,
      assignmentCount,
    });
  }

  if (req.query.force === 'true') {
    await Worker.updateMany(workerFilter, { site: null });
    await WorkAssignment.updateMany(
      { site: req.params.id, ...ownerFilter(req) },
      { site: null }
    );
  }

  await site.deleteOne();
  return res.json({ message: 'Site deleted', id: req.params.id });
});

module.exports = { listSites, getSite, createSite, updateSite, deleteSite };