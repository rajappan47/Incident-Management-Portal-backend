// backend/services/activityService.js
const mongoose = require('mongoose'); // ADD THIS
const Activity = require('../models/ActivityLog'); // Adjust model path if needed
const Incident = require('../models/Incident'); // ADD THIS - adjust path if needed
const createCustomError = require('../utils/customError');
const logger = require('../utils/logger'); 

const getActivityLogsByIncidentId = async (incidentId) => {

  if (!mongoose.Types.ObjectId.isValid(incidentId)) {
    throw createCustomError('Invalid Incident ID format', 400);
  }

  //  2. Check if incident exists
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw createCustomError('Incident not found', 404);
  }
logger.debug(`Fetching activity logs for incident: ${incidentId}`);
  return await Activity.find({ incidentId })
    .populate('performedBy', 'name email role')
    .sort({ createdAt: -1 }); // Latest logs first
};

module.exports = { getActivityLogsByIncidentId };