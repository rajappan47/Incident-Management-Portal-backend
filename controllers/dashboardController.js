// backend/controllers/dashboardController.js
const dashboardService = require('../services/dashboardService');

const getMetrics = async (req, res,next) => {
  try {
    const metrics = await dashboardService.getDashboardMetrics(req.user);
    res.status(200).json(metrics);
  } catch (error) {
    next(error)
    //res.status(500).json({ message: error.message });
  }
};

module.exports = { getMetrics };