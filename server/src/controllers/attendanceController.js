const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Worker = require('../models/Worker');
const asyncHandler = require('../utils/asyncHandler');
const { assertDate, todayString, upsertAttendance } = require('./attendanceHelpers');

/**
 * GET /api/attendance?date=YYYY-MM-DD&site=&worker=
 * Returns only the marked rows for a day.
 */
const listAttendance = asyncHandler(async (req, res) => {
  const date = req.query.date || todayString();
  assertDate(date);

  const filter = { date };
  if (req.query.site) filter.site = req.query.site;
  if (req.query.worker) filter.worker = req.query.worker;

  const rows = await Attendance.find(filter)
    .populate('worker', 'name role dailyWage phone active')
    .populate('site', 'name')
    .sort({ createdAt: 1 });

  return res.json(rows);
});

/**
 * GET /api/attendance/sheet?date=YYYY-MM-DD&site=
 * The daily marking sheet: every active worker plus whatever is already
 * recorded for that date.
 */
const getDailySheet = asyncHandler(async (req, res) => {
  const date = req.query.date || todayString();
  assertDate(date);

  const workerFilter = { active: true };
  if (req.query.site) workerFilter.site = req.query.site;

  const workers = await Worker.find(workerFilter)
    .populate('site', 'name location')
    .sort({ name: 1 })
    .lean();

  const existing = await Attendance.find({ date, worker: { $in: workers.map((w) => w._id) } });
  const byWorker = existing.reduce((acc, a) => ({ ...acc, [String(a.worker)]: a }), {});

  const rows = workers.map((w) => {
    const record = byWorker[String(w._id)];
    return {
      worker: {
        _id: w._id,
        name: w.name,
        role: w.role,
        dailyWage: w.dailyWage,
        site: w.site,
      },
      attendance: record || null,
      status: record ? record.status : 'present',
      wageRate: record ? record.wageRate : w.dailyWage,
      marked: Boolean(record),
    };
  });

  const summary = {
    date,
    total: rows.length,
    present: rows.filter((r) => r.marked && r.status === 'present').length,
    halfDay: rows.filter((r) => r.marked && r.status === 'half-day').length,
    absent: rows.filter((r) => r.marked && r.status === 'absent').length,
    unmarked: rows.filter((r) => !r.marked).length,
    totalWage: Math.round(rows.reduce((s, r) => s + (r.marked ? r.attendance.wageAmount : 0), 0) * 100) / 100,
  };

  return res.json({ summary, rows });
});

/**
 * POST /api/attendance
 * Create or update attendance for a single worker on a single day.
 * Body: { worker, date, status, wageRate?, site?, notes? }
 */
const markAttendance = asyncHandler(async (req, res) => {
  const { worker, date, status, wageRate, site, notes } = req.body;
  assertDate(date);

  const workerDoc = await Worker.findById(worker);
  if (!workerDoc) return res.status(404).json({ message: 'Worker not found' });

  const record = await upsertAttendance({
    workerDoc,
    date,
    status,
    wageRate,
    site,
    notes,
    userId: req.user._id,
  });

  return res.status(201).json(await record.populate('worker', 'name role dailyWage'));
});

/**
 * POST /api/attendance/bulk
 * Body: { date, site?, entries: [{ worker, status, wageRate? }] }
 * Marks a whole group in one call - the main daily-round action.
 */
const bulkMarkAttendance = asyncHandler(async (req, res) => {
  const { date, entries = [], site } = req.body;
  assertDate(date);

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ message: 'entries must be a non-empty array' });
  }

  const workers = await Worker.find({ _id: { $in: entries.map((e) => e.worker) } });
  const workerMap = workers.reduce((acc, w) => ({ ...acc, [String(w._id)]: w }), {});

  const rows = [];
  const skipped = [];

  // Sequential on purpose: keeps writes simple and reports errors per worker
  // instead of failing the whole batch.
  for (const entry of entries) {
    const workerDoc = workerMap[String(entry.worker)];
    if (!workerDoc) {
      skipped.push({ worker: entry.worker, reason: 'Worker not found' });
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      rows.push(
        await upsertAttendance({
          workerDoc,
          date,
          status: entry.status,
          wageRate: entry.wageRate,
          site,
          notes: entry.notes,
          userId: req.user._id,
        })
      );
    } catch (err) {
      skipped.push({ worker: entry.worker, reason: err.message });
    }
  }

  return res.status(200).json({ marked: rows.length, skipped, rows });
});

/**
 * DELETE /api/attendance/:id
 */
const deleteAttendance = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id);
  if (!record) return res.status(404).json({ message: 'Attendance not found' });
  if (record.paidInPayment) {
    return res.status(409).json({ message: 'Cannot delete a day that is already paid.' });
  }
  await record.deleteOne();
  return res.json({ message: 'Attendance deleted', id: req.params.id });
});

/**
 * GET /api/attendance/summary?from=&to=&worker=&site=
 * Totals for a date range, used by the reports page.
 */
const attendanceSummary = asyncHandler(async (req, res) => {
  const to = req.query.to || todayString();
  const from = req.query.from || to;
  assertDate(from, 'from');
  assertDate(to, 'to');

  const match = { date: { $gte: from, $lte: to } };
  if (req.query.worker) match.worker = new mongoose.Types.ObjectId(req.query.worker);
  if (req.query.site) match.site = new mongoose.Types.ObjectId(req.query.site);

  const grouped = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$worker',
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        days: { $sum: 1 },
        wages: { $sum: '$wageAmount' },
        unpaidWages: { $sum: { $cond: [{ $eq: ['$paidInPayment', null] }, '$wageAmount', 0] } },
      },
    },
  ]);

  const workers = await Worker.find({ _id: { $in: grouped.map((g) => g._id) } }).select(
    'name role dailyWage active'
  );
  const workerMap = workers.reduce((acc, w) => ({ ...acc, [String(w._id)]: w }), {});

  const rows = grouped
    .map((g) => ({
      worker: workerMap[String(g._id)] || { _id: g._id, name: 'Removed worker' },
      present: g.present,
      halfDay: g.halfDay,
      absent: g.absent,
      days: g.days,
      wages: Math.round(g.wages * 100) / 100,
      unpaidWages: Math.round(g.unpaidWages * 100) / 100,
    }))
    .sort((a, b) => (a.worker.name || '').localeCompare(b.worker.name || ''));

  const totals = rows.reduce(
    (acc, r) => ({
      present: acc.present + r.present,
      halfDay: acc.halfDay + r.halfDay,
      absent: acc.absent + r.absent,
      wages: Math.round((acc.wages + r.wages) * 100) / 100,
      unpaidWages: Math.round((acc.unpaidWages + r.unpaidWages) * 100) / 100,
    }),
    { present: 0, halfDay: 0, absent: 0, wages: 0, unpaidWages: 0 }
  );

  return res.json({ from, to, totals, rows });
});

module.exports = {
  listAttendance,
  getDailySheet,
  markAttendance,
  bulkMarkAttendance,
  deleteAttendance,
  attendanceSummary,
};