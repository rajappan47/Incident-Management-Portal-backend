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

module.exports = mongoose.model('Incident', incidentSchema);