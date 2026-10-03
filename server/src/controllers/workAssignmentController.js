const WorkAssignment = require('../models/WorkAssignment');
const mongoose = require('mongoose');
const Worker = require('../models/Worker');
const Site = require('../models/Site');
const Attendance = require('../models/Attendance');
const asyncHandler = require('../utils/asyncHandler');
const { assertDate, todayString, upsertAttendance } = require('./attendanceHelpers');

const populateAssignment = (query) =>
  query.populate([
    { path: 'site', select: 'name' },
    { path: 'workers', select: 'name role dailyWage' },
  ]);

function validateDispatchInput({ workerIds, site, customerCharge }) {
  if (!Array.isArray(workerIds) || workerIds.length < 1) {
    return 'Select at least one worker for a dispatch.';
  }
  if (!site || !mongoose.isValidObjectId(site)) {
    return 'Select a valid site for this dispatch.';
  }
  if (workerIds.some((workerId) => !mongoose.isValidObjectId(workerId))) {
    return 'Select valid workers for this dispatch.';
  }
  if (new Set(workerIds.map(String)).size !== workerIds.length) {
    return 'A worker cannot be selected more than once.';
  }
  if (!Number.isFinite(customerCharge) || customerCharge < 0) {
    return 'Enter a valid customer charge of zero or more.';
  }
  return null;
}

const getWorkAssignments = asyncHandler(async (req, res) => {
  const { date, site, from, to } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  const filter = { createdBy: req.user._id };

  if (date) {
    assertDate(date);
    filter.date = date;
  } else if (from || to) {
    const start = from || to;
    const end = to || from;
    assertDate(start, 'from');
    assertDate(end, 'to');
    filter.date = { $gte: start, $lte: end };
  } else if (!site) {
    filter.date = todayString();
  }

  if (site) {
    if (!mongoose.isValidObjectId(site)) {
      return res.status(400).json({ message: 'Invalid site filter.' });
    }
    filter.site = site;
  }

  const assignments = await WorkAssignment.find(filter)
    .populate('site', 'name')
    .populate('workers', 'name role dailyWage')
    .sort({ date: -1, createdAt: 1 })
    .limit(limit);
  return res.json(assignments);
});

const createWorkAssignment = asyncHandler(async (req, res) => {
  const { date, site, workers: workerIds, customerCharge } = req.body;
  assertDate(date);

  const validationError = validateDispatchInput({ workerIds, site, customerCharge });
  if (validationError) return res.status(400).json({ message: validationError });

  const siteDoc = await Site.findOne({ _id: site, createdBy: req.user._id, active: true });
  if (!siteDoc) return res.status(404).json({ message: 'Active site not found.' });

  const workerDocs = await Worker.find({
    _id: { $in: workerIds },
    createdBy: req.user._id,
    active: true,
  });
  if (workerDocs.length !== workerIds.length) {
    return res.status(404).json({ message: 'One or more active workers were not found.' });
  }

  const existingAssignment = await WorkAssignment.findOne({
    createdBy: req.user._id,
    date,
    workers: { $in: workerIds },
  });
  if (existingAssignment) {
    return res.status(409).json({ message: 'A selected worker is already assigned for this date.' });
  }

  const existingAttendance = await Attendance.find({
    date,
    worker: { $in: workerIds },
  });
  if (existingAttendance.some((record) => record.paidInPayment)) {
    return res.status(409).json({
      message: 'A selected worker already has a paid attendance record for this date.',
    });
  }

  const attendanceByWorker = new Map(
    existingAttendance.map((record) => [String(record.worker), record])
  );
  const workersById = new Map(workerDocs.map((worker) => [String(worker._id), worker]));
  const previousAttendanceByWorker = new Map(
    existingAttendance.map((record) => [String(record.worker), record.toObject()])
  );
  const attendanceRecords = [];
  let assignment;
  try {
    for (const workerId of workerIds) {
      const workerDoc = workersById.get(String(workerId));
      const previousAttendance = attendanceByWorker.get(String(workerId));
      // eslint-disable-next-line no-await-in-loop
      attendanceRecords.push(
        await upsertAttendance({
          workerDoc,
          date,
          status: 'present',
          wageRate: previousAttendance?.wageRate,
          site: siteDoc._id,
          notes: previousAttendance?.notes,
          userId: req.user._id,
        })
      );
    }

    assignment = await WorkAssignment.create({
      date,
      site: siteDoc._id,
      siteName: siteDoc.name,
      workers: workerIds,
      customerCharge,
      createdBy: req.user._id,
    });
  } catch (error) {
    const rollbackResults = await Promise.allSettled(
      attendanceRecords.map((record) => {
        const previous = previousAttendanceByWorker.get(String(record.worker));
        return previous
          ? Attendance.replaceOne({ _id: previous._id }, previous)
          : Attendance.deleteOne({ _id: record._id });
      })
    );
    const rollbackErrors = rollbackResults
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason.message);
    if (rollbackErrors.length) {
      const rollbackError = new Error(
        `Dispatch save failed (${error.message}); restoring attendance also failed (${rollbackErrors.join('; ')}).`
      );
      rollbackError.status = 500;
      throw rollbackError;
    }
    throw error;
  }

  return res.status(201).json({
    assignment: await assignment.populate([
      { path: 'site', select: 'name' },
      { path: 'workers', select: 'name role dailyWage' },
    ]),
    attendance: attendanceRecords,
  });
});

const updateWorkAssignment = asyncHandler(async (req, res) => {
  const { site, workers: workerIds, customerCharge } = req.body;

  const assignment = await WorkAssignment.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
  });
  if (!assignment) return res.status(404).json({ message: 'Dispatch not found.' });

  const validationError = validateDispatchInput({ workerIds, site, customerCharge });
  if (validationError) return res.status(400).json({ message: validationError });

  const siteDoc = await Site.findOne({ _id: site, createdBy: req.user._id, active: true });
  if (!siteDoc) return res.status(404).json({ message: 'Active site not found.' });

  const workerDocs = await Worker.find({
    _id: { $in: workerIds },
    createdBy: req.user._id,
    active: true,
  });
  if (workerDocs.length !== workerIds.length) {
    return res.status(404).json({ message: 'One or more active workers were not found.' });
  }

  // No other dispatch on the same date may contain any of the new workers.
  const clash = await WorkAssignment.findOne({
    _id: { $ne: assignment._id },
    createdBy: req.user._id,
    date: assignment.date,
    workers: { $in: workerIds },
  });
  if (clash) {
    return res.status(409).json({ message: 'A selected worker is already assigned in another dispatch for this date.' });
  }

  const oldWorkerIds = assignment.workers.map(String);
  const newWorkerIds = workerIds.map(String);
  const removedWorkerIds = oldWorkerIds.filter((id) => !newWorkerIds.includes(id));

  // Attendance rows created/kept by this dispatch can be re-pointed, but a
  // day already covered by a payment must never be moved or deleted.
  const affectedAttendance = await Attendance.find({
    date: assignment.date,
    worker: { $in: [...new Set([...oldWorkerIds, ...newWorkerIds])].map((id) => new mongoose.Types.ObjectId(id)) },
  });
  const paidWorkerIds = new Set(
    affectedAttendance.filter((r) => r.paidInPayment).map((r) => String(r.worker))
  );
  const blockedRemoved = removedWorkerIds.filter((id) => paidWorkerIds.has(id));
  if (blockedRemoved.length) {
    return res.status(409).json({
      message: 'A removed worker already has a paid attendance record for this date. Unpay it first.',
    });
  }
  if (newWorkerIds.some((id) => paidWorkerIds.has(id) && !oldWorkerIds.includes(id))) {
    return res.status(409).json({
      message: 'A selected worker already has a paid attendance record for this date.',
    });
  }

  const workersById = new Map(workerDocs.map((w) => [String(w._id), w]));
  const attendanceByWorker = new Map(affectedAttendance.map((r) => [String(r.worker), r]));

  // Point kept + added workers' attendance at the (possibly new) site.
  for (const workerId of newWorkerIds) {
    const workerDoc = workersById.get(String(workerId));
    const previous = attendanceByWorker.get(String(workerId));
    // eslint-disable-next-line no-await-in-loop
    await upsertAttendance({
      workerDoc,
      date: assignment.date,
      status: 'present',
      wageRate: previous?.wageRate,
      site: siteDoc._id,
      notes: previous?.notes,
      userId: req.user._id,
    });
  }

  // Workers removed from the dispatch go back to unmarked ONLY if their
  // present row still points at this dispatch's site and is unpaid.
  // Otherwise (user manually edited attendance afterwards) leave it alone.
  for (const workerId of removedWorkerIds) {
    const record = attendanceByWorker.get(String(workerId));
    if (
      record &&
      !record.paidInPayment &&
      record.status === 'present' &&
      String(record.site || '') === String(assignment.site || '')
    ) {
      // eslint-disable-next-line no-await-in-loop
      await Attendance.deleteOne({ _id: record._id });
    }
  }

  assignment.site = siteDoc._id;
  assignment.siteName = siteDoc.name;
  assignment.workers = workerIds;
  assignment.customerCharge = customerCharge;
  await assignment.save();

  const updated = await populateAssignment(
    WorkAssignment.findOne({ _id: assignment._id, createdBy: req.user._id })
  );
  return res.json(updated);
});

const deleteWorkAssignment = asyncHandler(async (req, res) => {
  const assignment = await WorkAssignment.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
  });
  if (!assignment) return res.status(404).json({ message: 'Dispatch not found.' });

  const attendanceRows = await Attendance.find({
    date: assignment.date,
    worker: { $in: assignment.workers },
  });
  if (attendanceRows.some((r) => r.paidInPayment)) {
    return res.status(409).json({
      message: 'Cannot delete: a worker in this dispatch already has a paid attendance record for this date.',
    });
  }

  // Remove only the auto-created present rows that still point at this
  // dispatch's site. If the user changed attendance manually afterwards
  // (half-day/absent/different site), keep their edit.
  const removableIds = attendanceRows
    .filter(
      (r) =>
        r.status === 'present' && String(r.site || '') === String(assignment.site || '')
    )
    .map((r) => r._id);
  if (removableIds.length) {
    await Attendance.deleteMany({ _id: { $in: removableIds } });
  }

  await assignment.deleteOne();
  return res.json({ message: 'Dispatch deleted', id: assignment._id, removedAttendance: removableIds.length });
});

const updateCollectionStatus = asyncHandler(async (req, res) => {
  const { status, collectedAt } = req.body;
  if (!['paid', 'unpaid'].includes(status)) {
    return res.status(400).json({ message: 'Collection status must be paid or unpaid.' });
  }

  let collectionDate = null;
  if (status === 'paid') {
    collectionDate = collectedAt ? new Date(collectedAt) : new Date();
    if (Number.isNaN(collectionDate.getTime())) {
      return res.status(400).json({ message: 'Enter a valid collection date.' });
    }
  }

  const assignment = await WorkAssignment.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user._id },
    { collectionStatus: status, collectedAt: collectionDate },
    { new: true, runValidators: true }
  )
    .populate('site', 'name')
    .populate('workers', 'name role dailyWage');
  if (!assignment) return res.status(404).json({ message: 'Dispatch not found.' });
  return res.json(assignment);
});

module.exports = { getWorkAssignments, createWorkAssignment, updateWorkAssignment, deleteWorkAssignment, updateCollectionStatus };
