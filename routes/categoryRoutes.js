const express = require('express');
const router = express.Router();

// Controllers
const { 
  createCategory, 
  getCategories, 
  updateCategory, 
  deleteCategory 
} = require('../controllers/categoryController');

// Middlewares
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validationMiddleware'); //  Added validation error handler

// Validators
const {
  createCategoryValidation,
  updateCategoryValidation,
  categoryIdValidation,
} = require('../validators/categoryValidator'); //  Added category validators

// 1. Anyone logged in can see categories
router.get('/', getCategories);

// 2. Only Admins can create new categories (With Validation)
router.post(
  '/', 
  protect, 
  authorizeRoles('Admin'), 
  createCategoryValidation, 
  validate, 
  createCategory
);

// 3. Only Admins can update an existing category (With Validation)
router.put(
  '/:id', 
  protect, 
  authorizeRoles('Admin'), 
  updateCategoryValidation, 
  validate, 
  updateCategory
);

// 4. Only Admins can delete a category (With Validation)
router.delete(
  '/:id', 
  protect, 
  authorizeRoles('Admin'), 
  categoryIdValidation, 
  validate, 
  deleteCategory
);

module.exports = router;