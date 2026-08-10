const { body, param } = require('express-validator');

// Validation rules for POST /api/categories (Creating a new category)
const createCategoryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Category name must be between 2 and 50 characters')
    .escape(),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 250 })
    .withMessage('Description cannot exceed 250 characters')
    .escape(),

  body('active')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean (true or false)'),
];

// Validation rules for PUT/PATCH /api/categories/:id (Updating a category)
const updateCategoryValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid Category ID format'),

  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ min: 2, max: 50 })
    .withMessage('Category name must be between 2 and 50 characters')
    .escape(),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 250 })
    .withMessage('Description cannot exceed 250 characters')
    .escape(),

  body('active')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean (true or false)'),
];

// Validation for URL route parameter (e.g. GET /:id or DELETE /:id)
const categoryIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid Category ID format'),
];

module.exports = {
  createCategoryValidation,
  updateCategoryValidation,
  categoryIdValidation,
};