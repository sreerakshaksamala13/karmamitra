const mongoose = require('mongoose');

/**
 * One row per worker per day.
 * `date` is stored as a YYYY-MM-DD string on purpose so that "today" never
 * shifts around because of time-zones between the phone and the server.
 */
const attendanceSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', default: null },
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'],
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'half-day'],
      default: 'present',
    },
    // Wage rate used for this specific day (can differ from the worker default).
    wageRate: { type: Number, required: true, min: 0, default: 0 },
    // Computed from wageRate + status. This is what the worker is owed.
    wageAmount: { type: Number, required: true, min: 0, default: 0 },
    // Set when this day has been covered by a payment, prevents double paying.
    paidInPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    notes: { type: String, trim: true, default: '' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const STATUS_FACTOR = { present: 1, 'half-day': 0.5, absent: 0 };

attendanceSchema.pre('validate', function computeWage(next) {
  const factor = STATUS_FACTOR[this.status] ?? 1;
  this.wageAmount = Math.round(this.wageRate * factor * 100) / 100;
  next();
});

attendanceSchema.index({ worker: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ paidInPayment: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);