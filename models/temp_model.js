// backend/models/IncidentLink.js
const mongoose = require('mongoose');

const RELATIONSHIP_TYPES = ['Related', 'Duplicate', 'Caused-By'];

const incidentLinkSchema = new mongoose.Schema(
  {
    // The incident the link was created FROM. For 'Caused-By', this is the
    // incident that "was caused by" toIncidentId — direction matters here.
    // For 'Related'/'Duplicate', direction is cosmetic (symmetric relationship),
    // but we still store it directionally for a consistent schema.
    fromIncidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      required: [true, 'Source incident is required'],
    },
    toIncidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      required: [true, 'Target incident is required'],
    },
    relationshipType: {
      type: String,
      enum: {
        values: RELATIONSHIP_TYPES,
        message: 'Relationship type must be Related, Duplicate, or Caused-By',
      },
      required: [true, 'Relationship type is required'],
    },
    linkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Query pattern is always "give me every link touching incident X" —
// index both sides so that lookup is fast regardless of which side X is on.
incidentLinkSchema.index({ fromIncidentId: 1 });
incidentLinkSchema.index({ toIncidentId: 1 });

module.exports = mongoose.model('IncidentLink', incidentLinkSchema);
module.exports.RELATIONSHIP_TYPES = RELATIONSHIP_TYPES;