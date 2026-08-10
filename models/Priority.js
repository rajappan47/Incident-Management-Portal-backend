const mongoose = require('mongoose');

const PrioritySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., Low, Medium, High, Critical
  slaHours: { type: Number, required: true }, // Resolution target in hours (FR-14 linkage)
  colorCode: { type: String, default: '#808080' }, // UI badge color code
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Priority', PrioritySchema);