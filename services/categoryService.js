const Category = require('../models/Category');
const createCustomError = require('../utils/customError');
const mongoose = require('mongoose'); // Fixed: Added missing import
const logger = require('../utils/logger'); // FR2-02: Structured logger

// Create a new category (Admin only)
const createCategory = async (name, description) => {

  if (!name) {
    //  CHANGED: 400 Bad Request if name is missing
    throw createCustomError('Category name is required', 400);
  }

  const existing = await Category.findOne({ name });
  if (existing) {
    throw createCustomError('Category already exists', 400);
  }
 const newCategory = await Category.create({ name, description });
  logger.debug(`Category created: ${newCategory._id} (${name})`);
  return newCategory;
};

// Get all active categories for dropdown lists
const getCategories = async () => {
  return await Category.find({ active: true });
};


const updateCategory = async (id, { name, description }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    //  CHANGED: 400 Bad Request for invalid ID format
    throw createCustomError('Invalid Category ID format', 400);
  }

  const category = await Category.findByIdAndUpdate(
    id,
    { name, description },
    { new: true, runValidators: true }
  );

  if (!category) {
    //  CHANGED: 404 Not Found if record missing
    throw createCustomError('Category not found', 404);
  }
  logger.debug(`Category updated: ${id}`);

  return category;
};

//  ADDED: Delete category service function (Moved from controller)
const deleteCategory = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    //  CHANGED: 400 Bad Request for invalid ID format
    throw createCustomError('Invalid Category ID format', 400);
  }

  const category = await Category.findByIdAndDelete(id);

  if (!category) {
    //  CHANGED: 404 Not Found if record missing
    throw createCustomError('Category not found', 404);
  }
  logger.debug(`Category removed: ${id}`);
  return { message: 'Category removed successfully' };
};

module.exports = { createCategory, getCategories, updateCategory, deleteCategory };