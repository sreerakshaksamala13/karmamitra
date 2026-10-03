const Site = require('../models/Site');
const Worker = require('../models/Worker');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/sites?active=
 */
const listSites = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.active === 'true') filter.active = true;
  if (req.query.active === 'false') filter.active = false;

  const sites = await Site.find(filter).sort({ createdAt: -1 }).lean();

  // Attach a quick worker count to every site for the dashboard cards.
  const counts = await Worker.aggregate([
    { $match: { site: { $ne: null }, active: true } },
    { $group: { _id: '$site', workers: { $sum: 1 } } },
  ]);
  const countMap = counts.reduce((acc, c) => ({ ...acc, [String(c._id)]: c.workers }), {});

  return res.json(sites.map((s) => ({ ...s, workerCount: countMap[String(s._id)] || 0 })));
});

/**
 * GET /api/sites/:id
 */
const getSite = asyncHandler(async (req, res) => {
  const site = await Site.findById(req.params.id);
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
  const site = await Site.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!site) return res.status(404).json({ message: 'Site not found' });
  return res.json(site);
});

/**
 * DELETE /api/sites/:id
 */
const deleteSite = asyncHandler(async (req, res) => {
  const workerCount = await Worker.countDocuments({ site: req.params.id });
  if (workerCount && req.query.force !== 'true') {
    return res.status(409).json({
      message: `This site still has ${workerCount} worker(s) assigned. Reassign them first or pass force=true.`,
      workerCount,
    });
  }

  if (req.query.force === 'true') {
    await Worker.updateMany({ site: req.params.id }, { site: null });
  }

  const site = await Site.findByIdAndDelete(req.params.id);
  if (!site) return res.status(404).json({ message: 'Site not found' });
  return res.json({ message: 'Site deleted', id: req.params.id });
});

module.exports = { listSites, getSite, createSite, updateSite, deleteSite };