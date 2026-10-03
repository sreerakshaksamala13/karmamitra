const Worker = require('../models/Worker');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/workers?search=&active=&site=
 */
const listWorkers = asyncHandler(async (req, res) => {
  const { search = '', active, site } = req.query;
  const filter = {};

  if (search) filter.name = { $regex: search, $options: 'i' };
  if (active === 'true') filter.active = true;
  if (active === 'false') filter.active = false;
  if (site) filter.site = site;

  const workers = await Worker.find(filter).populate('site', 'name location').sort({ name: 1 });
  return res.json(workers);
});

/**
 * GET /api/workers/:id
 */
const getWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.params.id).populate('site', 'name location');
  if (!worker) return res.status(404).json({ message: 'Worker not found' });
  return res.json(worker);
});

/**
 * POST /api/workers
 */
const createWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.create({ ...req.body, createdBy: req.user._id });
  return res.status(201).json(await worker.populate('site', 'name location'));
});

/**
 * PUT /api/workers/:id
 */
const updateWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('site', 'name location');
  if (!worker) return res.status(404).json({ message: 'Worker not found' });
  return res.json(worker);
});

/**
 * PATCH /api/workers/:id/status  { active: boolean }
 * Soft delete / deactivate a worker without losing attendance history.
 */
const setWorkerStatus = asyncHandler(async (req, res) => {
  const worker = await Worker.findByIdAndUpdate(
    req.params.id,
    { active: Boolean(req.body.active) },
    { new: true }
  );
  if (!worker) return res.status(404).json({ message: 'Worker not found' });
  return res.json(worker);
});

/**
 * DELETE /api/workers/:id?force=true
 * Refuses to delete a worker that already has records unless force=true.
 */
const deleteWorker = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [attendanceCount, paymentCount] = await Promise.all([
    Attendance.countDocuments({ worker: id }),
    Payment.countDocuments({ worker: id }),
  ]);

  if ((attendanceCount || paymentCount) && req.query.force !== 'true') {
    return res.status(409).json({
      message:
        'This worker has attendance or payment history. Deactivate instead, or pass force=true to delete everything.',
      attendanceCount,
      paymentCount,
    });
  }

  if (req.query.force === 'true') {
    await Promise.all([
      Attendance.deleteMany({ worker: id }),
      Payment.deleteMany({ worker: id }),
    ]);
  }

  const worker = await Worker.findByIdAndDelete(id);
  if (!worker) return res.status(404).json({ message: 'Worker not found' });
  return res.json({ message: 'Worker deleted', id });
});

module.exports = {
  listWorkers,
  getWorker,
  createWorker,
  updateWorker,
  setWorkerStatus,
  deleteWorker,
};