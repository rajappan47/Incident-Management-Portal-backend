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
const rcaController = require('../controllers/rcaController'); // 🆕 V3 — RCA
const incidentLinkController = require('../controllers/Incidentlinkcontroller'); // 🆕 V3 — FR3-08 / FR3-09
const incidentGroupingController = require('../controllers/Incidentgroupingcontroller'); // 🆕 V3 — FR3-11

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

const {
  createRCAValidation,
  rcaIncidentIdValidation,
  updateRCAValidation,   // 🆕 FR3-02
  rejectRCAValidation,   // 🆕 FR3-02
}= require('../validators/rcaValidator'); // 🆕 V3 — RCA

const {
  createLinkValidation,
  deleteLinkValidation,
  incidentIdOnlyValidation,
} = require('../validators/incidentLinkValidator'); // 🆕 V3 — FR3-08 / FR3-09

const {
  groupIncidentIdValidation,
  addChildValidation,
  removeChildValidation,
} = require('../validators/incidentGroupingValidator'); // 🆕 V3 — FR3-11


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
 * /api/incidents/maintenance/fix-rca-links:
 *   get:
 *     summary: 🩹 ONE-TIME REPAIR — re-syncs Incident.rcaId for any RCA whose link
 *       never saved due to the earlier Mongoose 7 pre('save') bug. Admin only.
 *       Safe to run more than once. Remove this route once you've confirmed
 *       your data is fixed — it's a maintenance utility, not a permanent API.
 *     tags: [Incidents - RCA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Repair summary — how many RCA links were fixed
 */
router.get(
  '/maintenance/fix-rca-links',
  protect,
  authorizeRoles('Admin'),
  rcaController.repairRCALinks
);

/**
 * @openapi
 * /api/incidents/major-incidents-overview:
 *   get:
 *     summary: Active major incidents with their child/correlation link counts (FR3-16)
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview retrieved successfully
 */
// GET /api/incidents/major-incidents-overview — 🆕 FR3-16
// NOTE: deliberately placed here, in the STATIC ROUTES section, not appended
// with the other grouping routes further down — this is a plain top-level
// path (no :id), so like /All and /export/csv it must be registered before
// the dynamic GET /:id route below, or Express would try to match
// "major-incidents-overview" as an incident ID and 400 on the validator.
router.get(
  '/major-incidents-overview',
  protect,
  incidentGroupingController.getMajorIncidentsOverview
);

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

/**
 * @openapi
 * /api/incidents/{id}/rca:
 *   post:
 *     summary: Create a structured RCA record for an incident (FR3-01)
 *     tags: [Incidents - RCA]
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
 *             required: [category, description]
 *             properties:
 *               category:
 *                 type: string
 *                 example: Configuration Error
 *               description:
 *                 type: string
 *                 example: Load balancer health check misconfigured after last deploy.
 *               contributingFactors:
 *                 type: string
 *               correctiveActions:
 *                 type: string
 *               preventiveActions:
 *                 type: string
 *     responses:
 *       201:
 *         description: RCA record created successfully
 *       403:
 *         description: Not authorized to author an RCA on this incident
 *       404:
 *         description: Incident not found
 *       409:
 *         description: RCA record already exists for this incident
 */
// POST /api/incidents/:id/rca — 🆕 FR3-01
router.post(
  '/:id/rca',
  protect,
  authorizeRoles('Support Agent'), // Admin's RCA role is approve/reject only, per permissions table
  createRCAValidation,
  validate,
  rcaController.createRCA
);

/**
 * @openapi
 * /api/incidents/{id}/rca:
 *   get:
 *     summary: Get the RCA record attached to an incident
 *     tags: [Incidents - RCA]
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
 *         description: RCA record fetched
 *       404:
 *         description: No RCA record exists for this incident
 */
// GET /api/incidents/:id/rca — 🆕 FR3-01
router.get(
  '/:id/rca',
  protect,
  rcaIncidentIdValidation,
  validate,
  rcaController.getRCAByIncident
);

/**
 * @openapi
 * /api/incidents/{id}/rca:
 *   put:
 *     summary: Edit an RCA record while it is still a Draft (FR3-02)
 *     tags: [Incidents - RCA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: RCA draft updated
 *       400:
 *         description: RCA is not in Draft status
 *       403:
 *         description: Not authorized
 */
// PUT /api/incidents/:id/rca — 🆕 FR3-02
router.put(
  '/:id/rca',
  protect,
  authorizeRoles('Support Agent'), // Admin's RCA role is approve/reject only, per permissions table
  updateRCAValidation,
  validate,
  rcaController.updateRCA
);

/**
 * @openapi
 * /api/incidents/{id}/rca/submit:
 *   patch:
 *     summary: Submit a Draft RCA for review (FR3-02)
 *     tags: [Incidents - RCA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: RCA moved to In Review
 *       400:
 *         description: RCA is not currently a Draft
 */
// PATCH /api/incidents/:id/rca/submit — 🆕 FR3-02
router.patch(
  '/:id/rca/submit',
  protect,
  authorizeRoles('Support Agent'), // Admin's RCA role is approve/reject only, per permissions table
  rcaIncidentIdValidation,
  validate,
  rcaController.submitRCA
);

/**
 * @openapi
 * /api/incidents/{id}/rca/approve:
 *   patch:
 *     summary: Approve an In Review RCA (FR3-02 / FR3-05). Admin only.
 *     tags: [Incidents - RCA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: RCA approved
 *       403:
 *         description: Admin role required
 */
// PATCH /api/incidents/:id/rca/approve — 🆕 FR3-02
router.patch(
  '/:id/rca/approve',
  protect,
  authorizeRoles('Admin'),
  rcaIncidentIdValidation,
  validate,
  rcaController.approveRCA
);

/**
 * @openapi
 * /api/incidents/{id}/rca/reject:
 *   patch:
 *     summary: Send an In Review RCA back to Draft with comments (FR3-02 / FR3-05). Admin only.
 *     tags: [Incidents - RCA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [comments]
 *             properties:
 *               comments:
 *                 type: string
 *                 example: Contributing factors section needs more detail before approval.
 *     responses:
 *       200:
 *         description: RCA sent back to Draft
 *       403:
 *         description: Admin role required
 */
// PATCH /api/incidents/:id/rca/reject — 🆕 FR3-02
router.patch(
  '/:id/rca/reject',
  protect,
  authorizeRoles('Admin'),
  rejectRCAValidation,
  validate,
  rcaController.rejectRCA
);

/**
 * @openapi
 * /api/incidents/{id}/links:
 *   post:
 *     summary: Manually link this incident to another (FR3-08). Admin or Support Agent.
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toIncidentId, relationshipType]
 *             properties:
 *               toIncidentId:
 *                 type: string
 *                 example: 651a2b3c4d5e6f7a8b9c0d1e
 *               relationshipType:
 *                 type: string
 *                 enum: [Related, Duplicate, Caused-By]
 *     responses:
 *       201:
 *         description: Link created successfully
 *       409:
 *         description: This link already exists between these incidents
 */
// POST /api/incidents/:id/links — 🆕 FR3-08
router.post(
  '/:id/links',
  protect,
  authorizeRoles('Admin', 'Support Agent'),
  createLinkValidation,
  validate,
  incidentLinkController.createLink
);

/**
 * @openapi
 * /api/incidents/{id}/links:
 *   get:
 *     summary: Get every incident linked to this one, from either direction (FR3-08)
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Linked incidents retrieved
 */
// GET /api/incidents/:id/links — 🆕 FR3-08
router.get(
  '/:id/links',
  protect,
  incidentIdOnlyValidation,
  validate,
  incidentLinkController.getLinks
);

/**
 * @openapi
 * /api/incidents/{id}/links/{linkId}:
 *   delete:
 *     summary: Remove a link between two incidents (FR3-08). Admin only ("unlink").
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Link removed successfully
 *       403:
 *         description: Admin role required
 */
// DELETE /api/incidents/:id/links/:linkId — 🆕 FR3-08
router.delete(
  '/:id/links/:linkId',
  protect,
  authorizeRoles('Admin'),
  deleteLinkValidation,
  validate,
  incidentLinkController.deleteLink
);

/**
 * @openapi
 * /api/incidents/{id}/correlation-suggestions:
 *   get:
 *     summary: Suggest possible links for this incident based on category, a
 *       configurable time window, and title/description similarity (FR3-09)
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Correlation suggestions retrieved
 */
// GET /api/incidents/:id/correlation-suggestions — 🆕 FR3-09
router.get(
  '/:id/correlation-suggestions',
  protect,
  incidentIdOnlyValidation,
  validate,
  incidentLinkController.getSuggestions
);

/**
 * @openapi
 * /api/incidents/{id}/mark-major:
 *   patch:
 *     summary: Mark an incident as a major incident / parent (FR3-11). Admin or Support Agent.
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Incident marked as major incident
 */
// PATCH /api/incidents/:id/mark-major — 🆕 FR3-11
router.patch(
  '/:id/mark-major',
  protect,
  authorizeRoles('Admin', 'Support Agent'),
  groupIncidentIdValidation,
  validate,
  incidentGroupingController.markAsMajorIncident
);

/**
 * @openapi
 * /api/incidents/{id}/unmark-major:
 *   patch:
 *     summary: Unmark a major incident (FR3-11). Admin only. Blocked while children exist.
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Incident unmarked as major incident
 *       400:
 *         description: Incident still has children — remove them first
 */
// PATCH /api/incidents/:id/unmark-major — 🆕 FR3-11
router.patch(
  '/:id/unmark-major',
  protect,
  authorizeRoles('Admin'),
  groupIncidentIdValidation,
  validate,
  incidentGroupingController.unmarkAsMajorIncident
);

/**
 * @openapi
 * /api/incidents/{id}/children:
 *   post:
 *     summary: Attach a child incident under this major incident (FR3-11). Admin or Support Agent.
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [childIncidentId]
 *             properties:
 *               childIncidentId:
 *                 type: string
 *                 example: 651a2b3c4d5e6f7a8b9c0d1e
 *     responses:
 *       201:
 *         description: Child incident added successfully
 */
// POST /api/incidents/:id/children — 🆕 FR3-11
router.post(
  '/:id/children',
  protect,
  authorizeRoles('Admin', 'Support Agent'),
  addChildValidation,
  validate,
  incidentGroupingController.addChild
);

/**
 * @openapi
 * /api/incidents/{id}/children/{childId}:
 *   delete:
 *     summary: Detach a child incident from its parent (FR3-11). Admin only.
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Child incident removed successfully
 */
// DELETE /api/incidents/:id/children/:childId — 🆕 FR3-11
router.delete(
  '/:id/children/:childId',
  protect,
  authorizeRoles('Admin'),
  removeChildValidation,
  validate,
  incidentGroupingController.removeChild
);

/**
 * @openapi
 * /api/incidents/{id}/group:
 *   get:
 *     summary: Get the parent/children grouping picture for an incident (FR3-11 / FR3-12 / FR3-13)
 *     tags: [Incidents - Correlation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Grouping info retrieved
 */
// GET /api/incidents/:id/group — 🆕 FR3-11 / FR3-12 / FR3-13
router.get(
  '/:id/group',
  protect,
  groupIncidentIdValidation,
  validate,
  incidentGroupingController.getGroup
);

/**
 * @openapi
 * /api/incidents/{id}/rca/attachments:
 *   post:
 *     summary: Attach supporting evidence (logs, screenshots) to an RCA record (FR3-06).
 *       Reuses the same upload mechanism as incident creation.
 *     tags: [Incidents - RCA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               attachment:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Evidence attached successfully
 *       400:
 *         description: RCA is not in Draft status, or no file was uploaded
 */
// POST /api/incidents/:id/rca/attachments — 🆕 FR3-06
router.post(
  '/:id/rca/attachments',
  protect,
  authorizeRoles('Support Agent'), // same authoring restriction as the rest of FR3-01/FR3-02
  upload.single('attachment'),
  rcaIncidentIdValidation,
  validate,
  rcaController.uploadRCAAttachment
);
 
/**
 * @openapi
 * /api/incidents/{id}/rca/attachments:
 *   get:
 *     summary: List evidence attached to an RCA record (FR3-06)
 *     tags: [Incidents - RCA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Attachments retrieved
 */
// GET /api/incidents/:id/rca/attachments — 🆕 FR3-06
router.get(
  '/:id/rca/attachments',
  protect,
  rcaIncidentIdValidation,
  validate,
  rcaController.getRCAAttachments
);
 
/**
 * @openapi
 * /api/incidents/{id}/rca/attachments/{attachmentId}:
 *   delete:
 *     summary: Remove an evidence attachment from an RCA record (FR3-06)
 *     tags: [Incidents - RCA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Evidence removed successfully
 */
// DELETE /api/incidents/:id/rca/attachments/:attachmentId — 🆕 FR3-06
router.delete(
  '/:id/rca/attachments/:attachmentId',
  protect,
  authorizeRoles('Support Agent'),
  rcaIncidentIdValidation,
  validate,
  rcaController.deleteRCAAttachment
);

module.exports = router;