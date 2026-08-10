// backend/services/commentService.js
const mongoose = require('mongoose'); // 👈 ADDED: Required for mongoose.Types.ObjectId validation
const Comment = require('../models/Comment');
const ActivityLog = require('../models/ActivityLog');
const Incident = require('../models/Incident');
const logActivity = require('../utils/activityLogger');

const logger = require('../utils/logger');
const createCustomError = require('../utils/customError');

// Add a comment to an incident
const addComment = async ({ incidentId, userId, message, isInternal = false }) => {
  if (!mongoose.Types.ObjectId.isValid(incidentId)) {
    throw createCustomError('Invalid Incident ID format', 400);
  }

  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw createCustomError('Incident not found', 404);
  }

  const comment = await Comment.create({
    incidentId,
    authorId: userId,
    message,
    isInternal,
  });
logger.debug(`Comment added to incident: ${incidentId} by user: ${userId} (Internal: ${isInternal})`);
  return await comment.populate('authorId', 'name email role');
};

// Get all comments and activity logs for an incident
const getIncidentTimeline = async (incidentId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(incidentId)) {
    throw createCustomError('Invalid Incident ID format', 400);
  }
logger.debug(`Fetching timeline for incident: ${incidentId} under role: ${userRole}`);
  // Build comment filter: End Users cannot view internal notes
  let commentFilter = { incidentId };
  if (userRole === 'End User') {
    commentFilter.isInternal = false;
  }

  const comments = await Comment.find(commentFilter)
    .populate('authorId', 'name email role')
    .sort({ createdAt: 1 });

  const activities = await ActivityLog.find({ incidentId })
    .populate('performedBy', 'name email role')
    .sort({ createdAt: 1 });

  return { comments, activities };
};

/**
 * Fetch all comments associated with a specific Incident ID
 * @param {string} incidentId - The ID of the incident
 * @returns {Promise<Array>} Array of populated comment objects
 */
const getCommentsByIncidentId = async (incidentId) => {
  // 1. Verify ID format before querying Mongo
  if (!mongoose.Types.ObjectId.isValid(incidentId)) {
    throw createCustomError('Invalid Incident ID format', 400);
  }

  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw createCustomError('Incident not found', 404);;
  }

  // 2. Populate 'authorId' (matching your Comment schema)
  return await Comment.find({ incidentId })
    .populate('authorId', 'name email role')
    .sort({ createdAt: 1 });
};

module.exports = { 
  addComment, 
  getIncidentTimeline, 
  getCommentsByIncidentId 
};