// backend/services/userService.js
const User = require('../models/User');
const mongoose = require('mongoose'); //FIXED: Added missing mongoose import
const createCustomError = require('../utils/customError');

// Get list of all users with search & role filter
const getAllUsers = async (query) => {
  const { role, search } = query;
  let filter = {};

  if (role) filter.role = role;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  return await User.find(filter).select('-password').sort({ createdAt: -1 });
};

const createUserService = async ({ name, email, password, role }) => {
  if (!name || !email || !password) {
    // 🟢 CHANGED: Explicit 400 Bad Request error
    throw createCustomError('Name, email, and password are required', 400);
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    // 🟢 CHANGED: Explicit 400 Bad Request error
    throw createCustomError('User already exists with this email', 400);
  }

  const user = await User.create({
    name,
    email,
    password, // Handled by pre-save hook in User model
    role: role || 'End User',
  });

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};



// Update User Role or Active Status
const updateUserRoleOrStatus = async (userId, { role, isActive }) => {

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw createCustomError('Invalid User ID format', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createCustomError('User not found', 404);
  }

  if (role) {
    const allowedRoles = ['End User', 'Support Agent', 'Admin'];
    if (!allowedRoles.includes(role)) {
throw createCustomError(`Invalid role. Must be one of: ${allowedRoles.join(', ')}`, 400);    }
    user.role = role;
  }

  if (typeof isActive === 'boolean') {
    user.isActive = isActive;
  }

  await user.save();
  return await User.findById(userId).select('-password');
};

const updateUserService = async (userId, updateData) => {

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw createCustomError('Invalid User ID format', 400);
  }
  const { name, role } = updateData;

  const user = await User.findById(userId);
  if (!user) {
throw createCustomError('User not found', 404);
  }

  if (name) user.name = name;
  if (role) user.role = role;

  if (role) {
    const allowedRoles = ['End User', 'Support Agent', 'Admin'];
    if (!allowedRoles.includes(role)) {
      // CHANGED: Explicit 400 Bad Request error
      throw createCustomError(`Invalid role. Must be one of: ${allowedRoles.join(', ')}`, 400);
    }
    user.role = role;
  }
  const updatedUser = await user.save();

  return {
    _id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
  };
};

const deleteUserService = async (userId, currentAdminId) => {
  //  ADDED: MongoDB ObjectId format validation
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw createCustomError('Invalid User ID format', 400);
  }

  if (currentAdminId && userId === currentAdminId.toString()) {
    // CHANGED: Explicit 400 Bad Request error
    throw createCustomError('You cannot delete your own admin account', 400);
  }

  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    // CHANGED: Explicit 404 Not Found error
    throw createCustomError('User not found', 404);
  }

  return { message: 'User removed successfully' };
};

const getAgentsByCategoryService = async (category) => {
  if (!category) {
    //  CHANGED: Explicit 400 Bad Request error
    throw createCustomError('Category parameter is required.', 400);
  }

  return await User.find({
    role: 'Support Agent',
    categories: { $in: [category] },
  }).select('_id name email team categories');
};

module.exports = { getAllUsers, getAgentsByCategoryService, createUserService, updateUserRoleOrStatus ,updateUserService, deleteUserService};