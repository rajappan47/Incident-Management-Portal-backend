const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser 
} = require('../controllers/userController');
const User = require('../models/User');
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Retrieve list of all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users fetched successfully
 *       401:
 *         description: Unauthorized / Missing or invalid token
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/', protect, authorizeRoles('Admin'), getUsers);
/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *               role:
 *                 type: string
 *                 enum: [End User, Support Agent, Admin]
 *                 example: Support Agent
 *               team:
 *                 type: string
 *                 example: Tier 2 Support
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Hardware Issue", "Network & Security"]
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input parameters or email already registered
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/', protect, authorizeRoles('Admin'), createUser); // Now createUser is defined!
/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Update an existing user by ID (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The User Mongo Object ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Smith
 *               email:
 *                 type: string
 *                 example: janesmith@example.com
 *               role:
 *                 type: string
 *                 enum: [End User, Support Agent, Admin]
 *                 example: Support Agent
 *               team:
 *                 type: string
 *                 example: Escalations
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put('/:id', protect, authorizeRoles('Admin'), updateUser);
/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user by ID (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The User Mongo Object ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete('/:id', protect, authorizeRoles('Admin'), deleteUser);
/**
 * @openapi
 * /api/users/agents-by-category:
 *   get:
 *     summary: Get support agents filtered by category ID or Category Name
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter agents handling this Category ID
 *       - in: query
 *         name: categoryName
 *         schema:
 *           type: string
 *         description: Filter agents handling this Category Name
 *     responses:
 *       200:
 *         description: List of matching support agents
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error fetching agents
 */
router.get('/agents-by-category', protect, async (req, res) => {
  try {
    const { categoryId, categoryName } = req.query;

    let filter = { role: 'Support Agent' };

    // Match category by ID or Category Name in User's handled categories array
    if (categoryId || categoryName) {
      filter.categories = { $in: [categoryId, categoryName] };
    }

    const agents = await User.find(filter).select('_id name email team categories');
    res.status(200).json(agents);
  } catch (error) {
    console.error('Fetch agents error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;