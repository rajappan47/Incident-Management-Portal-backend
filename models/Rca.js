// backend/models/RCA.js
const mongoose = require('mongoose');

// Controlled vocabulary for root cause category (BRD Section 12 — NFR Data Quality:
// "RCA fields use controlled vocabularies ... so dashboard aggregation stays meaningful")
// 🔧 ADJUST THIS LIST to match your org's actual root-cause taxonomy if you have one.
const RCA_CATEGORIES = [
  'Human Error',
  'Process Gap',
  'System / Technical Failure',
  'Configuration Error',
  'Third-Party / Vendor Issue',
  'Documentation Gap',
  'Capacity / Performance',
  'Other',
];

const rcaSchema = new mongoose.Schema(
  {
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      required: [true, 'Incident reference is required'],
      unique: true, // one RCA record per incident (1:1, matches Incident.rcaId)
    },
    category: {
      type: String,
      enum: {
        values: RCA_CATEGORIES,
        message: 'Category must be one of the approved root cause categories',
      },
      required: [true, 'Root cause category is required'],
    },
    // 🆕 FR3-04: Guided 5-Whys Template Fields
    fiveWhys: {
      why1: {
        type: String,
        required: [true, 'Initial cause (Why 1) is required for guided RCA analysis'],
        trim: true,
      },
      why2: { type: String, trim: true, default: '' },
      why3: { type: String, trim: true, default: '' },
      why4: { type: String, trim: true, default: '' },
      why5: { type: String, trim: true, default: '' },
    },
    description: {
      type: String,
      required: [true, 'Root cause description is required'],
      trim: true,
    },
    contributingFactors: {
      type: String,
      trim: true,
      default: '',
    },
    correctiveActions: {
      type: String,
      trim: true,
      default: '',
    },
    preventiveActions: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      // Full Draft → In Review → Approved workflow is FR3-02.
      // FR3-01 just needs the field to exist and default correctly.
      type: String,
      enum: ['Draft', 'In Review', 'Approved'],
      default: 'Draft',
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    // 🆕 FR3-02 — comments left when an Admin sends an RCA back to Draft
    rejectionComments: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true, // gives createdAt / updatedAt automatically
  }
);

// Indexes per BRD Section 13 — supports FR3-15 (Top Root Causes) dashboard aggregation
rcaSchema.index({ category: 1 });
rcaSchema.index({ status: 1 });

module.exports = mongoose.model('RCA', rcaSchema);
module.exports.RCA_CATEGORIES = RCA_CATEGORIES;