// backend/controllers/userController.js
const userService = require('../services/userService');
//const User = require('../models/User');

// @desc    Get all users (supports optional role filter)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res, next) => {
  try {
    //  CHANGED: Delegates filtering to service instead of calling direct User.find
    const users = await userService.getAllUsers(req.query);
    res.status(200).json(users);
  } catch (error) {
    // CHANGED: Forwards error to Centralized Handler
    next(error);
  }
};

// @desc    Create a new user (Admin created)
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res, next) => {
  try {
    //  CHANGED: Delegates creation and DB lookup entirely to userService
    const newUser = await userService.createUserService(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    //  CHANGED: Forwards error to Centralized Handler
    next(error);
  }
};

// @desc    Update user details & role (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
// @desc    Update user details (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    // CHANGED: Delegates User find/save logic to userService
    const updatedUser = await userService.updateUserService(id, req.body);
    res.status(200).json(updatedUser);
  } catch (error) {
    //  CHANGED: Forwards error to Centralized Handler
    next(error);
  }
};

// @desc    Delete a user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentAdminId = req.user ? req.user._id : null;

    // CHANGED: Delegates deletion and self-delete check to userService
    const result = await userService.deleteUserService(id, currentAdminId);
    res.status(200).json(result);
  } catch (error) {
    //  CHANGED: Forwards error to Centralized Handler
    next(error);
  }
};

const getAgentsByCategory = async (req, res, next) => {
  try {
    const { category } = req.query;
    //  CHANGED: Delegates DB query to userService
    const agents = await userService.getAgentsByCategoryService(category);
    res.status(200).json(agents);
  } catch (error) {
    //  CHANGED: Forwards error to Centralized Handler
    next(error);
  }
};



module.exports = {
  getUsers,
  createUser, // <-- Added so userRoutes.js router.post('/') can access it!
  updateUser,
  deleteUser,
  getAgentsByCategory,


};