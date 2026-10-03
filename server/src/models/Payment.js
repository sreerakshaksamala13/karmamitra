const mongoose = require('mongoose');

/**
 * A disbursement made to a worker (normally every Wednesday).
 * It covers a date range and links to the attendance rows it settles so that
 * those days are never paid twice.
 */
const paymentSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    attendance: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' }],
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    grossAmount: { type: Number, required: true, min: 0, default: 0 },
    deduction: { type: Number, min: 0, default: 0 }, // advance / loan recovered
    bonus: { type: Number, min: 0, default: 0 },
    netAmount: { type: Number, required: true, min: 0, default: 0 },
    method: { type: String, enum: ['cash', 'upi', 'bank'], default: 'cash' },
    status: { type: String, enum: ['pending', 'paid'], default: 'paid' },
    paidAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

paymentSchema.methods.recomputeNet = function recomputeNet() {
  const net = this.grossAmount + (this.bonus || 0) - (this.deduction || 0);
  this.netAmount = Math.max(0, Math.round(net * 100) / 100);
  return this.netAmount;
};

paymentSchema.index({ worker: 1, paidAt: -1 });
paymentSchema.index({ paidAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);