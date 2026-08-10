const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const { protect, authorizeRoles } = require('../middlewares/authMiddleware');
// Middleware to lock down all routes to Admin only
router.use(protect, authorizeRoles('Admin'));

// User Management
router.get('/users', async (req, res) => res.json(await adminService.getAllUsers()));
router.post('/users', async (req, res) => res.status(201).json(await adminService.createUser(req.body)));
router.patch('/users/:id/toggle-status', async (req, res) => res.json(await adminService.toggleUserStatus(req.params.id)));

// Category Master
router.get('/categories', async (req, res) => res.json(await adminService.getCategories()));
router.post('/categories', async (req, res) => res.status(201).json(await adminService.createCategory(req.body)));
router.patch('/categories/:id/toggle', async (req, res) => res.json(await adminService.toggleCategoryStatus(req.params.id)));

// Priority Master (SLA targets)
router.get('/priorities', async (req, res) => res.json(await adminService.getPriorities()));
router.post('/priorities', async (req, res) => res.status(201).json(await adminService.createPriority(req.body)));
router.put('/priorities/:id', async (req, res) => res.json(await adminService.updatePrioritySLA(req.params.id, req.body)));

module.exports = router;