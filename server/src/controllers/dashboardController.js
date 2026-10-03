const mongoose = require('mongoose');
const Worker = require('../models/Worker');
const Site = require('../models/Site');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnedWorkerIds } = require('../utils/tenant');
const { todayString } = require('./attendanceHelpers');

function startOfWeek(dateStr) {
  // Monday-based week so the Wednesday payout sits mid-week.
  const d = new Date(`${dateStr}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - day);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * GET /api/dashboard?date=YYYY-MM-DD
 * Everything the home screen needs in a single round-trip.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const date = req.query.date || todayString();
  const workerIds = await getOwnedWorkerIds(req.user._id);

  const [activeWorkers, totalWorkers, activeSites, todayRows, unpaidAgg, weekAgg] =
    await Promise.all([
      Worker.countDocuments({ createdBy: req.user._id, active: true }),
      Worker.countDocuments({ createdBy: req.user._id }),
      Site.countDocuments({ createdBy: req.user._id, active: true }),
      Attendance.find({ date, worker: { $in: workerIds } }).lean(),
      Attendance.aggregate([
        { $match: { worker: { $in: workerIds }, paidInPayment: null } },
        { $group: { _id: null, total: { $sum: '$wageAmount' }, days: { $sum: 1 } } },
      ]),
      (() => {
        const from = new Date(`${startOfWeek(date)}T00:00:00.000`);
        return Payment.aggregate([
          { $match: { createdBy: req.user._id, paidAt: { $gte: from } } },
          { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
        ]);
      })(),
    ]);

  const today = {
    date,
    present: todayRows.filter((r) => r.status === 'present').length,
    halfDay: todayRows.filter((r) => r.status === 'half-day').length,
    absent: todayRows.filter((r) => r.status === 'absent').length,
    marked: todayRows.length,
    unmarked: Math.max(0, activeWorkers - todayRows.length),
    totalWage:
      Math.round(todayRows.reduce((s, r) => s + r.wageAmount, 0) * 100) / 100,
  };

  // Recent payments for the activity list.
  const recentPayments = await Payment.find({ createdBy: req.user._id })
    .populate('worker', 'name role')
    .sort({ paidAt: -1 })
    .limit(5)
    .lean();

  return res.json({
    date,
    weekStart: startOfWeek(date),
    counts: {
      activeWorkers,
      inactiveWorkers: Math.max(0, totalWorkers - activeWorkers),
      totalWorkers,
      activeSites,
    },
    today,
    outstanding: {
      total: Math.round((unpaidAgg[0]?.total || 0) * 100) / 100,
      days: unpaidAgg[0]?.days || 0,
    },
    thisWeekPaid: {
      total: Math.round((weekAgg[0]?.total || 0) * 100) / 100,
      payments: weekAgg[0]?.count || 0,
    },
    recentPayments,
  });
});

module.exports = { getDashboard, startOfWeek };