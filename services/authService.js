const User = require('../models/User');
const { hashPassword, comparePassword, generateToken } = require('../utils/authUtils');

const createCustomError = require('../utils/customError');
const logger = require('../utils/logger'); 


const registerUser = async ({ name, email, password, role, team, categories }) => {


  if (!email || !password || !name) {
    // CHANGED: 400 Bad Request for missing required fields
    throw createCustomError('Name, email, and password are required', 400);
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw createCustomError('User already exists', 400);
  }

  const userRole = role || 'End User';

  // Support Agents need a Team and at least one Category
  if (userRole === 'Support Agent') {
    if (!team) throw createCustomError('Support Agents must belong to a team.', 400);
    if (!categories || categories.length === 0) {
throw createCustomError('Support Agents must have at least one assigned category.', 400);    }
  }

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: userRole,
    team: userRole === 'Support Agent' ? team : null,
    categories: userRole === 'Support Agent' ? categories : [],
  });

  const token = generateToken(user._id, user.role);
logger.debug(`New user registered: ${user._id} | Role: ${user.role} | Email: ${user.email}`);
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    team: user.team,
    categories: user.categories,
    token,
  };
};

// backend/services/authService.js
 // Adjust paths if needed

const loginUser = async ({ email, password }) => {

  if (!email || !password) {
    // CHANGED: 400 Bad Request for missing credentials
    throw createCustomError('Please provide email and password', 400);
  }
  // 1. Check if user exists
  const user = await User.findOne({ email });
  if (!user) {
    logger.warn(`Failed login attempt for email: ${email} (User not found)`);
throw createCustomError('Invalid email or password', 401);  }

  // 2. Check if account is active
  if (user.status === 'inactive' || user.isActive === false) {
    logger.warn(`Deactivated account login attempt: ${user._id} (${user.email})`);
throw createCustomError('Your account is deactivated. Please contact an Admin.', 403);  }

  // 3. Compare passwords
  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    logger.warn(`Failed login attempt for email: ${email} (Invalid password)`);
throw createCustomError('Invalid email or password', 401);  }

  // 4. Generate JWT token
  const token = generateToken(user._id, user.role);
logger.debug(`User logged in successfully: ${user._id} | Role: ${user.role}`);
  // 5. Return user details + permissions
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isSubUser: user.isSubUser || false,
    parentId: user.parentId || null,
    permissions: user.permissions || {},
    token,
  };
};


module.exports = { registerUser, loginUser };