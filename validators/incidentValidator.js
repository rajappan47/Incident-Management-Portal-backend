// backend/validators/incidentValidator.js
const { body, param } = require('express-validator');

const createIncidentValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Incident title is required')
    .isLength({ min: 5, max: 150 })
    .withMessage('Title must be between 5 and 150 characters')
    .escape(),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Incident description is required')
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters long')
    .escape(),

  body('category')
    .notEmpty()
    .withMessage('Category ID is required')
    .isMongoId()
    .withMessage('Invalid Category ID format'),

  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage('Priority must be Low, Medium, High, or Critical'),
];

const incidentIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid Incident ID format'),
];

module.exports = { 
  createIncidentValidation,
  incidentIdValidation,
};