const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true, default: '' },
    clientName: { type: String, trim: true, default: '' },
    clientPhone: { type: String, trim: true, default: '' },
    startDate: { type: Date, default: Date.now },
    dailyRateToClient: { type: Number, min: 0, default: 0 },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

siteSchema.index({ name: 1 });

module.exports = mongoose.model('Site', siteSchema);