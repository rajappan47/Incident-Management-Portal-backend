const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const { protect, authorizeRoles } = require('../middlewares/authMiddleware');
// Middleware to lock down all routes to Admin only
router.use(protect, authorizeRoles('Admin'));

// ==========================================
// USER MANAGEMENT ENDPOINTS
// ==========================================

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: Get all registered users (Admin only)
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users fetched successfully
 *       401:
 *         description: Unauthorized / Token missing
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/users', async (req, res) => res.json(await adminService.getAllUsers()));
/**
 * @openapi
 * /api/admin/users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *               role:
 *                 type: string
 *                 enum: [Admin, Agent, User]
 *                 example: Agent
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Missing or invalid request parameters
 */
router.post('/users', async (req, res) => res.status(201).json(await adminService.createUser(req.body)));
/**
 * @openapi
 * /api/admin/users/{id}/toggle-status:
 *   patch:
 *     summary: Toggle user active status (Admin only)
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User status toggled successfully
 *       404:
 *         description: User not found
 */
router.patch('/users/:id/toggle-status', async (req, res) => res.json(await adminService.toggleUserStatus(req.params.id)));
// ==========================================
// CATEGORY MASTER ENDPOINTS
// ==========================================

/**
 * @openapi
 * /api/admin/categories:
 *   get:
 *     summary: Get all categories (Admin view)
 *     tags: [Admin - Category Master]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category list retrieved
 */

// Category Master
router.get('/categories', async (req, res) => res.json(await adminService.getCategories()));

/**
 * @openapi
 * /api/admin/categories:
 *   post:
 *     summary: Create a new category (Admin only)
 *     tags: [Admin - Category Master]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Network & Security
 *               description:
 *                 type: string
 *                 example: Network connectivity and firewall tickets
 *     responses:
 *       201:
 *         description: Category created successfully
 */
router.post('/categories', async (req, res) => res.status(201).json(await adminService.createCategory(req.body)));

/**
 * @openapi
 * /api/admin/categories/{id}/toggle:
 *   patch:
 *     summary: Toggle category status (Admin only)
 *     tags: [Admin - Category Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category status toggled successfully
 */

router.patch('/categories/:id/toggle', async (req, res) => res.json(await adminService.toggleCategoryStatus(req.params.id)));

// ==========================================
// PRIORITY MASTER (SLA TARGETS) ENDPOINTS
// ==========================================

/**
 * @openapi
 * /api/admin/priorities:
 *   get:
 *     summary: Get all priority tiers & SLA targets
 *     tags: [Admin - Priority & SLA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of priorities and SLA targets
 */
// Priority Master (SLA targets)
router.get('/priorities', async (req, res) => res.json(await adminService.getPriorities()));

/**
 * @openapi
 * /api/admin/priorities:
 *   post:
 *     summary: Create new priority SLA tier
 *     tags: [Admin - Priority & SLA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, responseTimeHours, resolutionTimeHours]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Critical
 *               responseTimeHours:
 *                 type: number
 *                 example: 1
 *               resolutionTimeHours:
 *                 type: number
 *                 example: 4
 *     responses:
 *       201:
 *         description: Priority tier created
 */

router.post('/priorities', async (req, res) => res.status(201).json(await adminService.createPriority(req.body)));
/**
 * @openapi
 * /api/admin/priorities/{id}:
 *   put:
 *     summary: Update priority SLA targets
 *     tags: [Admin - Priority & SLA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Priority ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               responseTimeHours:
 *                 type: number
 *                 example: 2
 *               resolutionTimeHours:
 *                 type: number
 *                 example: 8
 *     responses:
 *       200:
 *         description: SLA updated successfully
 */
router.put('/priorities/:id', async (req, res) => res.json(await adminService.updatePrioritySLA(req.params.id, req.body)));

module.exports = router;