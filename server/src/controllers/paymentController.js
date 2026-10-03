const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Attendance = require('../models/Attendance');
const Worker = require('../models/Worker');
const Site = require('../models/Site');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnedWorkerIds } = require('../utils/tenant');
const { todayString, assertDate } = require('./attendanceHelpers');

/**
 * GET /api/payments/dues?to=YYYY-MM-DD&site=
 * For every active worker: unpaid attendance rows and the total owed.
 * This is the screen opened every Wednesday.
 */
const getDues = asyncHandler(async (req, res) => {
  const to = req.query.to || todayString();
  assertDate(to, 'to');

  const match = {
    worker: { $in: await getOwnedWorkerIds(req.user._id) },
    paidInPayment: null,
    date: { $lte: to },
  };
  if (req.query.site) match.site = new mongoose.Types.ObjectId(req.query.site);

  const grouped = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$worker',
        grossAmount: { $sum: '$wageAmount' },
        days: { $sum: { $cond: [{ $ne: ['$status', 'absent'] }, 1, 0] } },
        presentDays: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        halfDays: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
        fromDate: { $min: '$date' },
        toDate: { $max: '$date' },
        attendanceIds: { $push: '$_id' },
      },
    },
  ]);

  const workerIds = grouped.map((g) => g._id);
  const workerFilter = { _id: { $in: workerIds }, createdBy: req.user._id };
  if (req.query.site) workerFilter.site = req.query.site;
  const workers = await Worker.find(workerFilter).populate('site', 'name').lean();
  const workerMap = workers.reduce((acc, w) => ({ ...acc, [String(w._id)]: w }), {});

  const rows = grouped
    .filter((g) => workerMap[String(g._id)])
    .map((g) => ({
      worker: workerMap[String(g._id)],
      grossAmount: Math.round(g.grossAmount * 100) / 100,
      presentDays: g.presentDays,
      halfDays: g.halfDays,
      fromDate: g.fromDate,
      toDate: g.toDate,
      attendanceCount: g.attendanceIds.length,
      attendanceIds: g.attendanceIds,
    }))
    .sort((a, b) => a.worker.name.localeCompare(b.worker.name));

  const totalDue = Math.round(rows.reduce((s, r) => s + r.grossAmount, 0) * 100) / 100;
  return res.json({ to, totalDue, workerCount: rows.length, rows });
});

/**
 * POST /api/payments
 * Settle a worker's unpaid days and record the disbursement.
 * Body: { worker, toDate?, fromDate?, deduction?, bonus?, method?, status?, notes?, paidAt? }
 */
const createPayment = asyncHandler(async (req, res) => {
  const {
    worker,
    fromDate,
    toDate = todayString(),
    deduction = 0,
    bonus = 0,
    method = 'cash',
    status = 'paid',
    notes = '',
    paidAt,
  } = req.body;

  assertDate(toDate, 'toDate');
  if (fromDate) assertDate(fromDate, 'fromDate');

  const workerDoc = await Worker.findOne({ _id: worker, createdBy: req.user._id });
  if (!workerDoc) return res.status(404).json({ message: 'Worker not found' });

  const match = { worker, paidInPayment: null, date: { $lte: toDate } };
  if (fromDate) match.date.$gte = fromDate;

  const unbilled = await Attendance.find(match);
  if (unbilled.length === 0) {
    return res.status(400).json({ message: 'Nothing to pay - this worker has no unpaid days.' });
  }

  const grossAmount = Math.round(unbilled.reduce((s, a) => s + a.wageAmount, 0) * 100) / 100;

  const payment = new Payment({
    worker,
    attendance: unbilled.map((a) => a._id),
    fromDate: fromDate || unbilled.reduce((min, a) => (a.date < min ? a.date : min), toDate),
    toDate,
    grossAmount,
    deduction,
    bonus,
    method,
    status,
    notes,
    paidAt: paidAt ? new Date(paidAt) : new Date(),
    createdBy: req.user._id,
  });
  payment.recomputeNet();
  await payment.save();

  // Link the days so they can never be paid twice.
  await Attendance.updateMany(
    { _id: { $in: payment.attendance } },
    { $set: { paidInPayment: payment._id } }
  );

  return res.status(201).json(await payment.populate('worker', 'name role phone site'));
});

/**
 * GET /api/payments?worker=&status=&from=&to=&site=
 */
const listPayments = asyncHandler(async (req, res) => {
  const { worker, status, from, to, site } = req.query;
  const filter = { createdBy: req.user._id };
  if (worker) filter.worker = worker;
  if (status) filter.status = status;

  if (to) {
    assertDate(to, 'to');
    const end = new Date(`${to}T23:59:59.999`);
    filter.paidAt = { ...(filter.paidAt || {}), $lte: end };
  }
  if (from) {
    assertDate(from, 'from');
    filter.paidAt = { ...(filter.paidAt || {}), $gte: new Date(`${from}T00:00:00.000`) };
  }

  if (site) {
    const siteExists = await Site.exists({ _id: site, createdBy: req.user._id });
    if (!siteExists) return res.status(404).json({ message: 'Site not found' });
    const workerIds = await Worker.find({ site, createdBy: req.user._id }).distinct('_id');
    filter.worker = { $in: workerIds };
  }

  const payments = await Payment.find(filter)
    .populate('worker', 'name role phone site')
    .sort({ paidAt: -1 });
  return res.json(payments);
});

/**
 * GET /api/payments/:id
 */
const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, createdBy: req.user._id })
    .populate('worker', 'name role phone site dailyWage')
    .populate('attendance', 'date status wageRate wageAmount');
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  return res.json(payment);
});

/**
 * PUT /api/payments/:id
 * Update payment information: deduction, bonus, method, status, notes, date,
 * or even the gross amount. Net is always recomputed.
 */
const updatePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!payment) return res.status(404).json({ message: 'Payment not found' });

  const editable = ['deduction', 'bonus', 'method', 'status', 'notes', 'grossAmount'];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) payment[field] = req.body[field];
  });
  if (req.body.paidAt !== undefined) payment.paidAt = new Date(req.body.paidAt);

  payment.recomputeNet();
  await payment.save();
  return res.json(await payment.populate('worker', 'name role phone site'));
});

/**
 * DELETE /api/payments/:id
 * Reverses a payment and releases its days back to "unpaid".
 */
const deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!payment) return res.status(404).json({ message: 'Payment not found' });

  await Attendance.updateMany(
    { _id: { $in: payment.attendance } },
    { $set: { paidInPayment: null } }
  );
  await payment.deleteOne();
  return res.json({ message: 'Payment reversed and days released', id: req.params.id });
});

module.exports = {
  getDues,
  createPayment,
  listPayments,
  getPayment,
  updatePayment,
  deletePayment,
};