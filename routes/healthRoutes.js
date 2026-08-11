const express = require('express');
const router = express.Router();
const { getHealthStatus } = require('../controllers/healthController');

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Retrieve system health and database connectivity status
 *     tags: [Health Check]
 *     security: []
 *     responses:
 *       200:
 *         description: API and Database are fully operational
 *       503:
 *         description: Database disconnected or service degraded
 */
router.get('/', getHealthStatus);

module.exports = router;