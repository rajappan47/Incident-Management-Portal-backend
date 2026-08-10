const mongoose = require('mongoose'); //  ADDED: Required for Mongoose ID validation
const User = require('../models/User');
const Category = require('../models/Category');
const Priority = require('../models/Priority');
const bcrypt = require('bcryptjs');
const createCustomError = require('../utils/customError');
const logger = require('../utils/logger'); //FR2-02: Structured Winston Logger

// --- USER MANAGEMENT ---

// Admin creates a user
const createUser = async ({ name, email, password, role }) => {
if (!name || !email || !password) {
    //  CHANGED: Explicit 400 Bad Request for missing required fields
    throw createCustomError('Name, email, and password are required', 400);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) throw createCustomError('User with this email already exists', 400);

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role || 'End User',
    isActive: true
  });
logger.debug(`Admin created user: ${user._id} | Role: ${user.role} | Email: ${user.email}`);
  return { _id: user._id, name: user.name, email: user.email, role: user.role };
};

// Admin toggles user status (Activate / Deactivate)
const toggleUserStatus = async (userId) => {

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw createCustomError('Invalid User ID format', 400);
  }

  const user = await User.findById(userId);
  if (!user) throw createCustomError('User not found', 404);

  user.status = 'inactive';
  await user.save();
  logger.debug(`Admin deactivated user account: ${user._id}`);
  return { _id: user._id, name: user.name, status: user.status };
};

const getAllUsers = async () => {
  return await User.find({}).select('-password').sort({ createdAt: -1 });
};

// --- CATEGORY MASTER MANAGEMENT ---

const createCategory = async ({ name, description }) => {

  if (!name) {
    // CHANGED: Explicit 400 Bad Request if category name missing
    throw createCustomError('Category name is required', 400);
  }
  logger.debug(`Admin created category: ${newCategory._id} (${name})`);

  return await Category.create({ name, description });
};

const getCategories = async () => {
  return await Category.find({}).sort({ name: 1 });
};

const toggleCategoryStatus = async (id) => {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createCustomError('Invalid Category ID format', 400);
  }

  const category = await Category.findById(id);
  if (!category) throw createCustomError('Category not found', 404);
  category.active = false;

  const updatedCategory = await category.save();

  // FR2-02: Structured debug log for category status toggle
  logger.debug(`Admin deactivated category: ${id}`);

  return updatedCategory;
};

// --- PRIORITY MASTER & SLA MANAGEMENT ---

const createPriority = async ({ name, slaHours, colorCode }) => {

  const newPriority = await Priority.create({ name, slaHours, colorCode });

  //  FR2-02: Structured debug log for priority creation
  logger.debug(`Admin created priority level: ${newPriority._id} (${name})`);

  return newPriority;
};

const getPriorities = async () => {
  return await Priority.find({}).sort({ slaHours: 1 });
};

const updatePrioritySLA = async (id, { slaHours, colorCode }) => {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createCustomError('Invalid Priority ID format', 400);
  }

  const priority = await Priority.findById(id);
  if (!priority) throw createCustomError('Priority level not found', 404);
  if (slaHours !== undefined) priority.slaHours = slaHours;
  if (colorCode) priority.colorCode = colorCode;
 
  const updatedPriority = await priority.save();

  // FR2-02: Structured debug log for SLA update
  logger.debug(`Admin updated priority SLA: ${id}`);

  return updatedPriority;
};

module.exports = {
  createUser,
  toggleUserStatus,
  getAllUsers,
  createCategory,
  getCategories,
  toggleCategoryStatus,
  createPriority,
  getPriorities,
  updatePrioritySLA
};