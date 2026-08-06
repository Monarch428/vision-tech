const mongoose = require("mongoose");

const LogFileSchema = new mongoose.Schema(
  {
    public_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    secure_url: { type: String, required: true },
    format: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LogFile", LogFileSchema);