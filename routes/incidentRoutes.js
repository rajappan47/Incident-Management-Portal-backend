const express = require('express');
const router = express.Router();

// Controllers
const incidentController = require('../controllers/incidentController');
const { getIncidentActivities } = require('../controllers/activityController');
const {
  addComment,
  getTimeline,
  getIncidentComments,
} = require('../controllers/commentController');

// Middlewares
const { protect, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const validate = require('../middlewares/validationMiddleware');

// Validators
const {
  createIncidentValidation,
  incidentIdValidation,
} = require('../validators/incidentValidator');


const {
  createCommentValidation, //Add this import
} = require('../validators/commentValidator');


// ==========================================
// 1. STATIC ROUTES (Must come FIRST)
// ==========================================

/**
 * @openapi
 * /api/incidents/team-members:
 *   get:
 *     summary: Retrieve list of available team members/agents
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team members retrieved successfully
 *       401:
 */
// GET /api/incidents/team-members
router.get('/team-members', protect, incidentController.getTeamMembers);

/**
 * @openapi
 * /api/incidents/All:
 *   get:
 *     summary: Retrieve all incidents (System-wide view)
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All incidents retrieved successfully
 *       401:
 *         description: Unauthorized
 */
// GET /api/incidents/All
router.get('/All', protect, incidentController.getIncidentAll);

/**
 * @openapi
 * /api/incidents/export/csv:
 *   get:
 *     summary: Export incidents dataset as CSV (Admin only)
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file generated and downloaded successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
// GET /api/incidents/export/csv
router.get('/export/csv', protect, authorizeRoles('Admin'), incidentController.exportCSV);

/**
 * @openapi
 * /api/incidents:
 *   get:
 *     summary: Retrieve filtered incident tickets assigned to or created by user
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (e.g., Open, In Progress, Resolved)
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *         description: Filter by priority (e.g., Low, Medium, High, Critical)
 *     responses:
 *       200:
 *         description: Incidents retrieved successfully
 *       401:
 *         description: Unauthorized
 */
// GET /api/incidents/
router.get('/', protect, incidentController.getIncidents);


// ==========================================
// 2. DYNAMIC /:id ROUTES (Must come AFTER static routes)
// ==========================================
/**
 * @openapi
 * /api/incidents:
 *   post:
 *     summary: Report a new incident ticket (Supports file upload)
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, description, category, priority]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Unable to connect to VPN
 *               description:
 *                 type: string
 *                 example: Received timeout error when attempting to connect to corporate network.
 *               category:
 *                 type: string
 *                 example: Network & Security
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High, Critical]
 *                 example: High
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional log file or screenshot attachment
 *     responses:
 *       201:
 *         description: Incident reported successfully
 *       400:
 *         description: Validation failure or invalid request body
 *       401:
 *         description: Unauthorized
 */
// POST /api/incidents/ (Create Incident with upload & validation)
router.post(
  '/',
  protect,
  upload.single('attachment'),
  createIncidentValidation,
  validate,
  incidentController.createIncident
);
/**
 * @openapi
 * /api/incidents/{id}:
 *   get:
 *     summary: Get incident details by ID
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident Mongo Object ID
 *     responses:
 *       200:
 *         description: Incident details fetched
 *       400:
 *         description: Invalid Incident ID format
 *       404:
 *         description: Incident not found
 */
// GET /api/incidents/:id
router.get('/:id', protect, incidentIdValidation, validate, incidentController.getIncidentById);
/**
 * @openapi
 * /api/incidents/{id}/reassign:
 *   put:
 *     summary: Reassign an incident ticket to another team member or department
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident Mongo Object ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignedTo]
 *             properties:
 *               assignedTo:
 *                 type: string
 *                 description: User ID of the new assignee
 *                 example: 651a2b3c4d5e6f7a8b9c0d1e
 *               reason:
 *                 type: string
 *                 example: Requires specialized network team attention
 *     responses:
 *       200:
 *         description: Incident reassigned successfully
 *       404:
 *         description: Incident or User not found
 */
// PUT /api/incidents/:id/reassign
router.put('/:id/reassign', protect, incidentIdValidation, validate, incidentController.reassignIncident);
/**
 * @openapi
 * /api/incidents/{id}/status:
 *   patch:
 *     summary: Update incident resolution status
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident Mongo Object ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Open, In Progress, Resolved, Closed]
 *                 example: In Progress
 *     responses:
 *       200:
 *         description: Incident status updated successfully
 */
// PATCH /api/incidents/:id/status
router.patch('/:id/status', protect, incidentIdValidation, validate, incidentController.updateStatus);
/**
 * @openapi
 * /api/incidents/{id}/assign:
 *   patch:
 *     summary: Assign incident to an agent
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident Mongo Object ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignedTo]
 *             properties:
 *               assignedTo:
 *                 type: string
 *                 example: 651a2b3c4d5e6f7a8b9c0d1e
 *     responses:
 *       200:
 *         description: Incident assigned successfully
 */
// PATCH /api/incidents/:id/assign
router.patch('/:id/assign', protect, incidentIdValidation, validate, incidentController.assignIncident);


// ==========================================
// 3. NESTED SUB-RESOURCES FOR /:id
// ==========================================
/**
 * @openapi
 * /api/incidents/{id}/comments:
 *   post:
 *     summary: Add a comment to an incident
 *     tags: [Incidents - Comments & Timeline]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident Mongo Object ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [comment]
 *             properties:
 *               comment:
 *                 type: string
 *                 example: Investigated network switch configuration; rebooting primary router now.
 *     responses:
 *       201:
 *         description: Comment added successfully
 */
// POST /api/incidents/:id/comments
router.post(
  '/:id/comments', 
  protect, 
  createCommentValidation, 
  validate, 
  addComment
);
/**
 * @openapi
 * /api/incidents/{id}/comments:
 *   get:
 *     summary: Get all comments for a specific incident
 *     tags: [Incidents - Comments & Timeline]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident Mongo Object ID
 *     responses:
 *       200:
 *         description: Comments list fetched
 */
// GET /api/incidents/:id/comments - Get all comments for an incident
router.get(
  '/:id/comments', 
  protect, 
  incidentIdValidation, 
  validate, 
  getIncidentComments
);
/**
 * @openapi
 * /api/incidents/{id}/timeline:
 *   get:
 *     summary: Retrieve unified chronological timeline for an incident
 *     tags: [Incidents - Comments & Timeline]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident Mongo Object ID
 *     responses:
 *       200:
 *         description: Unified timeline retrieved successfully
 */
// GET /api/incidents/:id/timeline - Get unified timeline
router.get(
  '/:id/timeline', 
  protect, 
  incidentIdValidation, 
  validate, 
  getTimeline
);
/**
 * @openapi
 * /api/incidents/{id}/activities:
 *   get:
 *     summary: Retrieve activity audit logs for an incident
 *     tags: [Incidents - Comments & Timeline]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident Mongo Object ID
 *     responses:
 *       200:
 *         description: Activity logs retrieved
 */
// GET /api/incidents/:id/activities - Get activity logs
router.get(
  '/:id/activities', 
  protect, 
  incidentIdValidation, 
  validate, 
  getIncidentActivities
);
module.exports = router;