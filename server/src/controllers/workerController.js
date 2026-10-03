const Worker = require('../models/Worker');
const Site = require('../models/Site');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const WorkAssignment = require('../models/WorkAssignment');
const asyncHandler = require('../utils/asyncHandler');
const ownerFilter = (req) => ({ createdBy: req.user._id });

/**
 * GET /api/workers?search=&active=&site=
 */
const listWorkers = asyncHandler(async (req, res) => {
  const { search = '', active, site } = req.query;
  const filter = ownerFilter(req);

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
  const worker = await Worker.findOne({ _id: req.params.id, ...ownerFilter(req) }).populate(
    'site',
    'name location'
  );
  if (!worker) return res.status(404).json({ message: 'Worker not found' });
  return res.json(worker);
});

/**
 * POST /api/workers
 */
const createWorker = asyncHandler(async (req, res) => {
  const payload = { ...req.body, createdBy: req.user._id };
  if (!payload.role) payload.role = 'Mason';
  if (payload.site && !(await Site.findOne({ _id: payload.site, ...ownerFilter(req) }))) {
    return res.status(404).json({ message: 'Site not found' });
  }
  const worker = await Worker.create(payload);
  return res.status(201).json(await worker.populate('site', 'name location'));
});

/**
 * PUT /api/workers/:id
 */
const updateWorker = asyncHandler(async (req, res) => {
  const editable = ['name', 'phone', 'role', 'dailyWage', 'site', 'joinDate', 'active', 'address', 'idNumber', 'notes'];
  const updates = Object.fromEntries(
    editable.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]])
  );
  if (updates.site && !(await Site.findOne({ _id: updates.site, ...ownerFilter(req) }))) {
    return res.status(404).json({ message: 'Site not found' });
  }
  const worker = await Worker.findOneAndUpdate(
    { _id: req.params.id, ...ownerFilter(req) },
    updates,
    {
      new: true,
      runValidators: true,
    }
  ).populate('site', 'name location');
  if (!worker) return res.status(404).json({ message: 'Worker not found' });
  return res.json(worker);
});

/**
 * PATCH /api/workers/:id/status  { active: boolean }
 * Soft delete / deactivate a worker without losing attendance history.
 */
const setWorkerStatus = asyncHandler(async (req, res) => {
  const worker = await Worker.findOneAndUpdate(
    { _id: req.params.id, ...ownerFilter(req) },
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
  const worker = await Worker.findOne({ _id: id, ...ownerFilter(req) });
  if (!worker) return res.status(404).json({ message: 'Worker not found' });

  const [attendanceCount, paymentCount, assignmentCount] = await Promise.all([
    Attendance.countDocuments({ worker: id }),
    Payment.countDocuments({ worker: id }),
    WorkAssignment.countDocuments({ workers: id, createdBy: req.user._id }),
  ]);

  if ((attendanceCount || paymentCount || assignmentCount) && req.query.force !== 'true') {
    return res.status(409).json({
      message:
        'This worker has attendance, payment, or dispatch history. Deactivate instead, or pass force=true to delete all their records.',
      attendanceCount,
      paymentCount,
      assignmentCount,
    });
  }

  if (req.query.force === 'true') {
    await Promise.all([
      Attendance.deleteMany({ worker: id }),
      Payment.deleteMany({ worker: id }),
      WorkAssignment.deleteMany({ workers: id, createdBy: req.user._id }),
    ]);
  }

  await worker.deleteOne();
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