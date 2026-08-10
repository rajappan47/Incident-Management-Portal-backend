const authService = require('../services/authService');


// backend/controllers/authController.js
const register = async (req, res, next) => {
  try {
    // Delegate password hashing & creation to authService
    const userData = await authService.registerUser(req.body);
    res.status(201).json(userData);
  } catch (error) {
    next(error)
    // console.error('Register Error:', error.message);
    // res.status(400).json({ message: error.message });
  }
};

const login = async (req, res,next) => {
  try {
    const userData = await authService.loginUser(req.body);
    res.status(200).json(userData);
  } catch (error) {
    next(error)
    // Returns status 401 with { message: "Invalid email or password" }
    // res.status(401).json({ message: error.message });
  }
};

const getMe = async (req, res,next) => {
 try {
    res.status(200).json(req.user);
  } catch (error) {
    // 🟢 CHANGED: Passes error to Centralized Handler
    next(error);
  }
};

module.exports = { register, login, getMe };