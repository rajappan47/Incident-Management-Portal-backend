const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

const validate = require('../middlewares/validationMiddleware');
const { registerValidation, loginValidation } = require('../validators/authValidator');

// Validate fields before invoking register or login
/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *               role:
 *                 type: string
 *                 enum: [User, Agent, Admin]
 *                 example: User
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or Email already exists
 */
router.post('/register', registerValidation, validate, register);
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user & receive JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Authentication successful, returns JWT token & user info
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginValidation, validate, login);
/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized / Token missing or invalid
 */
router.get('/me', protect, getMe);

module.exports = router;