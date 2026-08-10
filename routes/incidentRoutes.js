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

// GET /api/incidents/team-members
router.get('/team-members', protect, incidentController.getTeamMembers);

// GET /api/incidents/All
router.get('/All', protect, incidentController.getIncidentAll);

// GET /api/incidents/export/csv
router.get('/export/csv', protect, authorizeRoles('Admin'), incidentController.exportCSV);

// GET /api/incidents/
router.get('/', protect, incidentController.getIncidents);


// ==========================================
// 2. DYNAMIC /:id ROUTES (Must come AFTER static routes)
// ==========================================

// POST /api/incidents/ (Create Incident with upload & validation)
router.post(
  '/',
  protect,
  upload.single('attachment'),
  createIncidentValidation,
  validate,
  incidentController.createIncident
);

// GET /api/incidents/:id
router.get('/:id', protect, incidentIdValidation, validate, incidentController.getIncidentById);

// PUT /api/incidents/:id/reassign
router.put('/:id/reassign', protect, incidentIdValidation, validate, incidentController.reassignIncident);

// PATCH /api/incidents/:id/status
router.patch('/:id/status', protect, incidentIdValidation, validate, incidentController.updateStatus);

// PATCH /api/incidents/:id/assign
router.patch('/:id/assign', protect, incidentIdValidation, validate, incidentController.assignIncident);


// ==========================================
// 3. NESTED SUB-RESOURCES FOR /:id
// ==========================================

// POST /api/incidents/:id/comments
router.post(
  '/:id/comments', 
  protect, 
  createCommentValidation, 
  validate, 
  addComment
);

// GET /api/incidents/:id/comments - Get all comments for an incident
router.get(
  '/:id/comments', 
  protect, 
  incidentIdValidation, 
  validate, 
  getIncidentComments
);

// GET /api/incidents/:id/timeline - Get unified timeline
router.get(
  '/:id/timeline', 
  protect, 
  incidentIdValidation, 
  validate, 
  getTimeline
);

// GET /api/incidents/:id/activities - Get activity logs
router.get(
  '/:id/activities', 
  protect, 
  incidentIdValidation, 
  validate, 
  getIncidentActivities
);
module.exports = router;