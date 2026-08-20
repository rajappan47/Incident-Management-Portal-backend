// backend/controllers/dashboardController.js
const dashboardService = require('../services/dashboardService');

const getMetrics = async (req, res, next) => {
  try {
    const metrics = await dashboardService.getDashboardMetrics(req.user);
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
    //res.status(500).json({ message: error.message });
  }
};

// GET /api/dashboard/top-root-causes — 🆕 FR3-15
const getTopRootCauses = async (req, res, next) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const result = await dashboardService.getTopRootCauses({ startDate, endDate, limit }, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// GET /api/dashboard/agent-performance — 🆕 FR3-17
const getAgentPerformance = async (req, res, next) => {
  try {
    const { groupBy, startDate, endDate } = req.query;
    const result = await dashboardService.getAgentPerformance({ groupBy, startDate, endDate }, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// NOTE: FR3-16 (Major Incident Overview) deliberately does NOT live here.
// It's served from /api/incidents/major-incidents-overview via
// incidentGroupingController.js, since that logic queries Incident +
// IncidentLink directly and already existed there. Duplicating it into
// dashboardService as "getMajorOverview" (as a previous edit attempted)
// pointed at a function that was never defined — that's what was crashing.
// If you want it under /api/dashboard instead, say so and I'll move it
// properly rather than leave two half-built copies.

module.exports = { getMetrics, getTopRootCauses, getAgentPerformance };