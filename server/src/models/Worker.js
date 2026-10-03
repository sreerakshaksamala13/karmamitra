const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    // Mason, Helper, Carpenter, Painter, Plumber, Electrician, etc.
    role: { type: String, trim: true, default: 'Helper' },
    dailyWage: { type: Number, required: true, min: 0, default: 0 },
    site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', default: null },
    joinDate: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    address: { type: String, trim: true, default: '' },
    idNumber: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

workerSchema.index({ name: 1 });
workerSchema.index({ active: 1, site: 1 });

module.exports = mongoose.model('Worker', workerSchema);