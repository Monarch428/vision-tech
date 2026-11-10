const { Schema, model } = require('mongoose');

const memberSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], required: true },
}, { timestamps: true });

module.exports = model('CompanyMember', memberSchema);
