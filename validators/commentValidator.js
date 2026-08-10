const { body, param } = require('express-validator');

// Rules for adding a new comment
const createCommentValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid Incident ID format in URL'),

  body('message')
    .trim()
    .notEmpty()
    .withMessage('Comment message cannot be empty')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
    .escape(), // Sanitization against XSS
];

// Rules for fetching comments or timeline by Incident ID
const getIncidentCommentsValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid Incident ID format in URL'),
];

module.exports = {
  createCommentValidation,
  getIncidentCommentsValidation,
};