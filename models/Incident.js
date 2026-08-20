// backend/models/Incident.js
const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
      required: true,
    },
    status: {
      type: String,
      enum: ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed'],
      default: 'New',
      required: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    dueBy: {
      type: Date, // Derived automatically based on priority SLA hours
    },
      isEscalated: {
      type: Boolean,
      default: false,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
      rcaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RCA',
      default: null,
    },
    rcaRequired: {
      // Derived from priority — kept in sync via pre-save hook below.
      // Critical/High => true (FR3-03 closure gate applies to these).
      type: Boolean,
      default: false,
    },
        isParentIncident: {
      // Explicit flag per data model spec. NOTE: the actual list of children
      // is always fetched by querying { parentIncidentId: this._id } live —
      // this flag is a quick-check label for UI, not the source of truth.
      type: Boolean,
      default: false,
    },
    parentIncidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      default: null,
    },

  },
  {
    timestamps: true, // Auto-generates createdAt and updatedAt
  }
);

incidentSchema.virtual('isOverdue').get(function () {
  // Resolved/Closed tickets are no longer overdue
  if (['Resolved', 'Closed'].includes(this.status)) {
    return false;
  }
  return new Date() > new Date(this.dueBy);
});


// Keep rcaRequired in sync whenever priority is set/changed
incidentSchema.pre('save', function () {
  if (this.isModified('priority') || this.isNew) {
    this.rcaRequired = ['Critical', 'High'].includes(this.priority);
  }
});

//  NEW — START (Pagination & Indexing requirement)
incidentSchema.index({ status: 1 });
incidentSchema.index({ priority: 1 });
incidentSchema.index({ assignedTo: 1 });
incidentSchema.index({ createdAt: -1 });
//  NEW — END


module.exports = mongoose.model('Incident', incidentSchema);