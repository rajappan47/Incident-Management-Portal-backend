// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { getMetrics } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');

// GET /api/dashboard/metrics
router.get('/metrics', protect, getMetrics);

module.exports = router;