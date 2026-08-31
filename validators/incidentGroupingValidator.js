// backend/validators/incidentGroupingValidator.js
const { body, param } = require('express-validator');

const groupIncidentIdValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
];

const addChildValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
  body('childIncidentId').isMongoId().withMessage('Invalid child Incident ID format'),
];

const removeChildValidation = [
  param('id').isMongoId().withMessage('Invalid Incident ID format'),
  param('childId').isMongoId().withMessage('Invalid child Incident ID format'),
];

module.exports = {
  groupIncidentIdValidation,
  addChildValidation,
  removeChildValidation,
};