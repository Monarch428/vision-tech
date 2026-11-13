const { Schema, model } = require('mongoose');

const accountSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  provider: { type: String, enum: ['tactical-rmm', 'bitdefender'], required: true },
  externalId: { type: String, required: true },
  siteIds: { type: [Number], default: [] },
  verifiedAt: { type: Date, required: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

accountSchema.index({ company: 1, provider: 1 }, { unique: true });
accountSchema.index({ provider: 1, externalId: 1 }, { unique: true });
accountSchema.index({ siteIds: 1 }, {
  unique: true,
  partialFilterExpression: { 'siteIds.0': { $exists: true } },
});

module.exports = model('CompanyProviderAccount', accountSchema);
