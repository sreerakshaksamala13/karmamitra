const mongoose = require('mongoose');

const workAssignmentSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'],
    },
    site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', default: null },
    siteName: { type: String, required: true, trim: true },
    workers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true }],
      validate: {
        validator: (workers) => workers.length >= 1,
        message: 'A dispatch must include at least one worker',
      },
    },
    customerCharge: { type: Number, required: true, min: 0 },
    collectionStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    collectedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

workAssignmentSchema.index({ createdBy: 1, date: -1 });
workAssignmentSchema.index({ createdBy: 1, date: 1, workers: 1 }, { unique: true });

module.exports = mongoose.model('WorkAssignment', workAssignmentSchema);
