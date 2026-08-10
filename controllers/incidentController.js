const incidentService = require('../services/incidentService');
const User = require('../models/User');
const Incident = require('../models/Incident');
const mongoose = require('mongoose');

const logger = require('../utils/logger');

const createIncident = async (req, res, next) => {
  try {
    const { title, description, category, priority, assignedTo } = req.body;

    const incident = await incidentService.createIncident({
      title,
      description,
      category,
      priority,
      assignedTo, // Passed from Frontend Dropdown
      user: req.user,
      file: req.file,
    });

    res.status(201).json({
      message: 'Incident created successfully',
      incident,
    });
  } catch (error) {
   // res.status(400).json({ message: error.message });
   next(error)
  }
};

const getIncidents = async (req, res, next) => {
  try {
    const incidents = await incidentService.getIncidents(req.user, req.query);
    res.status(200).json(incidents);
  } catch (error) {
    next(error)
   // res.status(500).json({ message: error.message });
  }
};

const getIncidentAll = async (req, res,next) => {
  try {
    const incidents = await incidentService.getIncidentAll();

    res.status(200).json(incidents);
  } catch (error) {
    next(error)
    //res.status(500).json({ message: error.message });
  }
};

const getIncidentById = async (req, res,next) => {
  try {
    const incident = await incidentService.getIncidentById(req.params.id, req.user);
    res.status(200).json(incident);
  } catch (error) {
    next(error)
    //res.status(400).json({ message: error.message });
  }
};

const assignIncident = async (req, res,next) => {
  try {
    const { agentId } = req.body; // Can be a valid ObjectId OR null/undefined if unassigning
    const incidentId = req.params.id;
    const currentUserId = req.user._id;

    const updatedIncident = await incidentService.assignIncident(
      incidentId,
      agentId,
      currentUserId
    );

    res.status(200).json({
      message: agentId ? 'Incident assigned successfully' : 'Incident unassigned successfully',
      incident: updatedIncident,
    });
  } catch (error) {
    next(error);
    //console.error('Assign Incident Controller Error:', error);
    //res.status(400).json({ message: error.message });
  }
};

// ==========================================
// NEW: Reassign Incident within Team
// ==========================================
const reassignIncident = async (req, res, next) => {
  try {
    const incidentId = req.params.id;
    const { targetAgentId } = req.body;
    const currentUser = req.user;

    if (!targetAgentId) {
    const error = new Error('Target agent ID is required');
    error.statusCode = 400;
    throw error;
    }

    // 🟢 FIX: Call function via incidentService
    const updatedIncident = await incidentService.reassignWithinTeam(
      incidentId,
      targetAgentId,
      currentUser
    );

    return res.status(200).json({
      message: 'Incident reassigned successfully within team',
      incident: updatedIncident,
    });
  } catch (error) {
    next(error)
    // console.error('Reassign Incident Controller Error:', error);
    
    // // Use custom statusCode if set by service, default to 400
    // const statusCode = error.statusCode || 400;
    // return res.status(statusCode).json({ message: error.message || 'Failed to reassign incident' });
  }
};

// ==========================================
// NEW: Fetch Team Members for Reassignment
// ==========================================
// backend/controllers/incidentController.js

const getTeamMembers = async (req, res,next) => {
  try {
    // 🟢 Debug log: Open your terminal to inspect this!
    //console.log('LOGGED IN USER CONTEXT:', req.user);
    logger.debug(`LOGGED IN USER CONTEXT: ${JSON.stringify(req.user)}`);

    const currentUser = req.user;
    const teamMembers = await incidentService.getTeamMembers(currentUser);

    res.status(200).json(teamMembers);
  } catch (error) {
    next(error)
    // console.error('Get Team Members Error:', error);
    // res.status(400).json({ message: error.message });
  }
};

const updateStatus = async (req, res,next) => {
  try {
    const { status } = req.body;
    if (!status) {
      const error = new Error('Status is required');
      error.statusCode = 400;
      throw error;
    }

    const updatedIncident = await incidentService.updateIncidentStatus(
      req.params.id,
      status,
      req.user._id
    );

    res.status(200).json({
      message: 'Status updated successfully',
      incident: updatedIncident,
    });
  } catch (error) {
    next(error)
   // res.status(400).json({ message: error.message });
  }
};

// @desc    Export incidents to CSV
// @route   GET /api/incidents/export/csv
// @access  Private
const exportCSV = async (req, res,next) => {
try {
    // Make sure req.user contains the full user object (including _id, role, etc.)
    const csvData = await incidentService.exportIncidentsToCSV(req.user, req.query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="incidents_${req.user.role}_${Date.now()}.csv"`);

    return res.status(200).send(csvData);
  } catch (error) {
    next(error)
    // console.error('CSV Export Controller Error:', error);
    // return res.status(500).json({ message: 'Failed to export CSV: ' + error.message });
  }
};

// GET /api/incidents/active
const getActiveIncidentsPrioritySorted = async (req, res, next) => {
  try {
    const activeIncidents = await Incident.aggregate([
      // 1. Exclude Closed / Resolved tickets
      { 
        $match: { 
          status: { $nin: ['Closed', 'Resolved'] } 
        } 
      },
      // 2. Map string priorities to numerical weights for ordering
      {
        $addFields: {
          priorityOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$priority', 'Critical'] }, then: 1 },
                { case: { $eq: ['$priority', 'High'] }, then: 2 },
                { case: { $eq: ['$priority', 'Medium'] }, then: 3 },
                { case: { $eq: ['$priority', 'Low'] }, then: 4 },
              ],
              default: 5
            }
          }
        }
      },
      // 3. Sort Critical -> High -> Medium -> Low, then by newest
      { $sort: { priorityOrder: 1, createdAt: -1 } },
      // 4. Populate user details
      {
        $lookup: {
          from: 'users',
          localField: 'reportedBy',
          foreignField: '_id',
          as: 'reportedBy'
        }
      },
      { $unwind: { path: '$reportedBy', preserveNullAndEmptyArrays: true } }
    ]);

    res.status(200).json(activeIncidents);
  } catch (error) {
    next(error)
    // res.status(500).json({ message: error.message });
  }
};

// GET /api/incidents/closed
const getClosedIncidents = async (req, res,next) => {
  try {
    const closedIncidents = await Incident.find({ 
      status: { $in: ['Closed', 'Resolved'] } 
    })
      .populate('reportedBy', 'name email')
      .sort({ updatedAt: -1 });

    res.status(200).json(closedIncidents);
  } catch (error) {
    next(error)
    // res.status(500).json({ message: error.message });
  }
};

// GET /api/users/agents-by-category?categoryId=xxx (or categoryName=xxx)
const getAgentsByCategory = async (req, res,next) => {
  try {
    const { categoryId, categoryName } = req.query;
    
    let filter = { role: 'Support Agent' };

    // Check if category is matched by ID or Name stored in User.categories
    if (categoryId || categoryName) {
      filter.categories = { $in: [categoryId, categoryName] };
    }

    const agents = await User.find(filter).select('_id name email team categories');
    res.status(200).json(agents);
  } catch (error) {
    next(error)
    // res.status(500).json({ message: error.message });
  }
};

const updateSubUserPermissions = async (req, res,next) => {
  try {
    const { subUserId } = req.params;
    const { permissions } = req.body; // Array of allowed strings e.g., ['tickets:create']
    const parentId = req.user._id;

    // Verify sub-user belongs to logged in Parent User
    const subUser = await User.findOne({ _id: subUserId, parentUser: parentId });
    if (!subUser) {
      const error = new Error('Sub-user not found or unauthorized');
      error.statusCode = 404;
      throw error;    }

    subUser.permissions = permissions;
    await subUser.save();

    res.status(200).json({
      message: 'Permissions updated successfully',
      permissions: subUser.permissions
    });
  } catch (error) {
    next(error)
    //res.status(500).json({ message: error.message });
  }
};



module.exports = {
  getAgentsByCategory,
  updateSubUserPermissions,
  createIncident,
  getIncidents,
  getIncidentAll,
  getIncidentById,
  assignIncident,
  reassignIncident,
  getTeamMembers,
  updateStatus,
  exportCSV,
  getClosedIncidents,
  getActiveIncidentsPrioritySorted,
};