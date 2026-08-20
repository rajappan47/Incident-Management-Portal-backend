// backend/models/Attachment.js
const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  incidentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  // 🆕 V3 — FR3-06: RCA Evidence Attachments. Optional — existing incident
  // attachments (uploaded via POST /api/incidents) leave this null and are
  // completely unaffected. incidentId is still always set (an RCA always
  // belongs to an incident), so any existing query that filters by
  // incidentId continues to return exactly what it did before; this field
  // just lets RCA-specific evidence be distinguished from general incident
  // attachments when needed.
  rcaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RCA',
    default: null,
  },
});

module.exports = mongoose.model('Attachment', attachmentSchema);