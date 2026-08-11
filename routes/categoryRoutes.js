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


/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: Retrieve all category records
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories fetched successfully
 */
// 1. Anyone logged in can see categories
router.get('/', getCategories);

/**
 * @openapi
 * /api/categories:
 *   post:
 *     summary: Create a new category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Hardware Issue
 *               description:
 *                 type: string
 *                 example: Physical hardware faults such as monitor, laptop, or keyboard repairs
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Validation error or duplicate category name
 *       401:
 *         description: Unauthorized / Missing or invalid token
 *       403:
 *         description: Forbidden - Requires Admin role
 */
// 2. Only Admins can create new categories (With Validation)
router.post(
  '/', 
  protect, 
  authorizeRoles('Admin'), 
  createCategoryValidation, 
  validate, 
  createCategory
);

/**
 * @openapi
 * /api/categories/{id}:
 *   put:
 *     summary: Update an existing category by ID (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The Category Mongo Object ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Hardware & Peripherals
 *               description:
 *                 type: string
 *                 example: Updated description for hardware tickets
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       400:
 *         description: Invalid Category ID format or validation failure
 *       404:
 *         description: Category not found
 */
// 3. Only Admins can update an existing category (With Validation)
router.put(
  '/:id', 
  protect, 
  authorizeRoles('Admin'), 
  updateCategoryValidation, 
  validate, 
  updateCategory
);

/**
 * @openapi
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete a category by ID (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The Category Mongo Object ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       400:
 *         description: Invalid Category ID format
 *       404:
 *         description: Category not found
 */
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