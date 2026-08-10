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

router.get('/', protect, authorizeRoles('Admin'), getUsers);
router.post('/', protect, authorizeRoles('Admin'), createUser); // Now createUser is defined!
router.put('/:id', protect, authorizeRoles('Admin'), updateUser);
router.delete('/:id', protect, authorizeRoles('Admin'), deleteUser);

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