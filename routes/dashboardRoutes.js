// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { getMetrics } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');


/**
 * @openapi
 * /api/dashboard/metrics:
 *   get:
 *     summary: Retrieve aggregate dashboard metrics and analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalIncidents:
 *                   type: number
 *                   example: 120
 *                 openIncidents:
 *                   type: number
 *                   example: 45
 *                 resolvedIncidents:
 *                   type: number
 *                   example: 65
 *                 closedIncidents:
 *                   type: number
 *                   example: 10
 *       401:
 *         description: Unauthorized / Missing or invalid token
 */
// GET /api/dashboard/metrics
router.get('/metrics', protect, getMetrics);

module.exports = router;