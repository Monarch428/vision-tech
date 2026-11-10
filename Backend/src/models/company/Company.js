const { Schema, model } = require('mongoose');

const companySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  billingUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
}, { timestamps: true });

module.exports = model('Company', companySchema);
