const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Worker = require('../models/Worker');
const asyncHandler = require('../utils/asyncHandler');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value, field = 'date') {
  if (!DATE_RE.test(value || '')) {
    const err = new Error(`${field} must be in YYYY-MM-DD format`);
    err.status = 400;
    throw err;
  }
}

/** Today in the server's local time as YYYY-MM-DD (never UTC-shifted). */
function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Upsert one attendance row, guarding against editing a day that is paid.
 */
async function upsertAttendance({ workerDoc, date, status, wageRate, site, notes, userId }) {
  const existing = await Attendance.findOne({ worker: workerDoc._id, date });
  if (existing && existing.paidInPayment) {
    const err = new Error('This day is already covered by a payment.');
    err.status = 409;
    throw err;
  }

  const payload = {
    worker: workerDoc._id,
    date,
    status: status || 'present',
    wageRate: wageRate == null ? workerDoc.dailyWage : wageRate,
    site: site === undefined ? workerDoc.site : site,
    notes: notes || '',
    markedBy: userId,
  };

  if (existing) {
    existing.set(payload);
    return existing.save();
  }
  return Attendance.create(payload);
}

module.exports = { assertDate, todayString, upsertAttendance };