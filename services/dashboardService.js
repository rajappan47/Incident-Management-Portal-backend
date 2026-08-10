// backend/services/dashboardService.js
const Incident = require('../models/Incident');
const logger = require('../utils/logger');

const createCustomError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getDashboardMetrics = async (user) => {

  if (!user) {
    throw createCustomError('User context is missing', 401);
  }
logger.debug(`Fetching dashboard metrics for user: ${user._id || user.id} (Role: ${user.role})`);
  let filter = {};

  // If End User, only show metrics for their own incidents
  if (user.role === 'End User') {
    filter.reportedBy = user._id;
  }

  const now = new Date();

  // 1. Total Count
  const totalIncidents = await Incident.countDocuments(filter);

  // 2. Counts by Status
  const newCount = await Incident.countDocuments({ ...filter, status: 'New' });
  const inProgressCount = await Incident.countDocuments({ ...filter, status: 'In Progress' });
  const onHoldCount = await Incident.countDocuments({ ...filter, status: 'On Hold' });
  const resolvedCount = await Incident.countDocuments({ ...filter, status: 'Resolved' });
  const closedCount = await Incident.countDocuments({ ...filter, status: 'Closed' });

  // 3. Open vs Closed total
  const totalOpen = newCount + inProgressCount + onHoldCount;

  // 4. Counts by Priority
  const criticalCount = await Incident.countDocuments({ ...filter, priority: 'Critical' });
  const highCount = await Incident.countDocuments({ ...filter, priority: 'High' });
  const mediumCount = await Incident.countDocuments({ ...filter, priority: 'Medium' });
  const lowCount = await Incident.countDocuments({ ...filter, priority: 'Low' });

  // 5. SLA Breached Incidents (Open incidents past dueBy target)
  const slaBreachedCount = await Incident.countDocuments({
    ...filter,
    status: { $nin: ['Resolved', 'Closed'] },
    dueBy: { $lt: now },
  });

  return {
    overview: {
      total: totalIncidents,
      open: totalOpen,
      resolved: resolvedCount,
      closed: closedCount,
      slaBreached: slaBreachedCount,
    },
    statusBreakdown: {
      New: newCount,
      InProgress: inProgressCount,
      OnHold: onHoldCount,
      Resolved: resolvedCount,
      Closed: closedCount,
    },
    priorityBreakdown: {
      Critical: criticalCount,
      High: highCount,
      Medium: mediumCount,
      Low: lowCount,
    },
  };
};

module.exports = { getDashboardMetrics };