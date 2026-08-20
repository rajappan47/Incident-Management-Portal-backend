// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { getMetrics, getTopRootCauses, getAgentPerformance } = require('../controllers/dashboardController'); // 🆕 V3 — FR3-15 / FR3-17 now consolidated here
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

/**
 * @openapi
 * /api/dashboard/top-root-causes:
 *   get:
 *     summary: Ranked list of the most frequent root cause categories from
 *       Approved RCAs over a given period (FR3-15)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 5
 *     responses:
 *       200:
 *         description: Top root causes retrieved successfully
 */
// GET /api/dashboard/top-root-causes — 🆕 FR3-15
router.get('/top-root-causes', protect, getTopRootCauses);

/**
 * @openapi
 * /api/dashboard/agent-performance:
 *   get:
 *     summary: Average resolution time and SLA compliance %, by agent or team (FR3-17)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [agent, team]
 *           default: agent
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Performance data retrieved successfully
 */
// GET /api/dashboard/agent-performance — 🆕 FR3-17
router.get('/agent-performance', protect, getAgentPerformance);

module.exports = router;