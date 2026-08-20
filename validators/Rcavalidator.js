// backend/validators/rcaValidator.js
// NOTE: Written for express-validator, matching how createIncidentValidation /
// incidentIdValidation are used in incidentRoutes.js. If you're on a different
// validation library, the field list below still applies — just swap the syntax.
const { body, param } = require('express-validator');
const { RCA_CATEGORIES } = require('../models/RCA');

const createRCAValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
  body('category')
    .notEmpty()
    .withMessage('Root cause category is required')
    .isIn(RCA_CATEGORIES)
    .withMessage(`Category must be one of: ${RCA_CATEGORIES.join(', ')}`),

    // 🆕 FR3-04: Validation for Guided 5-Whys
  body('fiveWhys.why1')
    .trim()
    .notEmpty()
    .withMessage('Initial cause (Why 1) is required for the guided RCA template')
    .isLength({ max: 2000 })
    .withMessage('Why 1 response is too long'),
  body('fiveWhys.why2').optional().trim().isLength({ max: 2000 }),
  body('fiveWhys.why3').optional().trim().isLength({ max: 2000 }),
  body('fiveWhys.why4').optional().trim().isLength({ max: 2000 }),
  body('fiveWhys.why5').optional().trim().isLength({ max: 2000 }),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Root cause description is required')
    .isLength({ max: 5000 })
    .withMessage('Description is too long'),
  body('contributingFactors').optional().trim().isLength({ max: 5000 }),
  body('correctiveActions').optional().trim().isLength({ max: 5000 }),
  body('preventiveActions').optional().trim().isLength({ max: 5000 }),
];

const rcaIncidentIdValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
];

// 🆕 FR3-02 — same field rules as create, but nothing is required
// (partial edits allowed while still a Draft)
const updateRCAValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
  body('category').optional().isIn(RCA_CATEGORIES).withMessage(
    `Category must be one of: ${RCA_CATEGORIES.join(', ')}`
  ),
  body('fiveWhys.why1').optional().trim().notEmpty().withMessage('Why 1 cannot be empty'),
  body('fiveWhys.why2').optional().trim().isLength({ max: 2000 }),
  body('fiveWhys.why3').optional().trim().isLength({ max: 2000 }),
  body('fiveWhys.why4').optional().trim().isLength({ max: 2000 }),
  body('fiveWhys.why5').optional().trim().isLength({ max: 2000 }),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('contributingFactors').optional().trim().isLength({ max: 5000 }),
  body('correctiveActions').optional().trim().isLength({ max: 5000 }),
  body('preventiveActions').optional().trim().isLength({ max: 5000 }),
];

// 🆕 FR3-02 — reject requires comments (acceptance criteria: "sent back with comments")
const rejectRCAValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
  body('comments')
    .trim()
    .notEmpty()
    .withMessage('Comments are required when sending an RCA back for revision'),
];

module.exports = {
  createRCAValidation,
  rcaIncidentIdValidation,
  updateRCAValidation,
  rejectRCAValidation,
};