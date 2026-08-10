const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

const validate = require('../middlewares/validationMiddleware');
const { registerValidation, loginValidation } = require('../validators/authValidator');

// Validate fields before invoking register or login
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.get('/me', protect, getMe);

module.exports = router;