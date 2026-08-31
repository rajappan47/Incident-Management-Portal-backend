// backend/validators/incidentLinkValidator.js
const { body, param } = require('express-validator');
const { RELATIONSHIP_TYPES } = require('../models/IncidentLink');

const createLinkValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
  body('toIncidentId').isMongoId().withMessage('Invalid target Incident ID format'),
  body('relationshipType')
    .notEmpty()
    .withMessage('Relationship type is required')
    .isIn(RELATIONSHIP_TYPES)
    .withMessage(`Relationship type must be one of: ${RELATIONSHIP_TYPES.join(', ')}`),
];

const deleteLinkValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
  param('linkId').isMongoId().withMessage('Invalid link ID format'),
];

const incidentIdOnlyValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
];

module.exports = {
  createLinkValidation,
  deleteLinkValidation,
  incidentIdOnlyValidation,
};