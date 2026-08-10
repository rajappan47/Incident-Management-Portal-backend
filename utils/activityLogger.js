// backend/utils/activityLogger.js
const ActivityLog = require('../models/ActivityLog');

const logActivity = async ({ incidentId, action, performedBy, oldValue = null, newValue = null }) => {
  try {
    await ActivityLog.create({
      incidentId,
      action,
      performedBy,
      oldValue,
      newValue,
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

module.exports = logActivity;