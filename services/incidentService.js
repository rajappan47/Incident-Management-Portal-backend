const Incident = require('../models/Incident');
const Attachment = require('../models/Attachment');
const User = require('../models/User');
const calculateSLA = require('../utils/calculateSLA');
const logActivity = require('../utils/activityLogger');
const { sendNotification } = require('./notificationService');
const { Parser } = require('json2csv');
const mongoose = require('mongoose');
const logger = require('../utils/logger');


const createCustomError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Create Incident & Notify Reporter
// services/incidentService.js

const createIncident = async ({ title, description, category, priority, assignedTo, user, file }) => {
  // 1. Calculate SLA resolution due date
  const dueBy = await calculateSLA(priority || 'Medium');

  // 2. Prepare Incident Data
  const incidentData = {
    title,
    description,
    category,
    priority: priority || 'Medium',
    reportedBy: user._id || user.id,
    dueBy,
  };

  // 🔒 Customer optional direct assignment during creation
  if (assignedTo) {
    incidentData.assignedTo = assignedTo;
    incidentData.status = 'In Progress'; // Auto update status if agent assigned
  }

  // 3. Create Incident Record
  const incident = await Incident.create(incidentData);

  // 4. Handle File Attachment if provided
  if (file) {
    await Attachment.create({
      incidentId: incident._id,
      fileName: file.originalname,
      filePath: file.path,
      uploadedBy: user._id || user.id,
    });
  }

  // 5. Record Activity Log
  await logActivity({
    incidentId: incident._id,
    action: assignedTo ? 'Incident Created & Agent Assigned' : 'Incident Created',
    performedBy: user._id || user.id,
  });

  return incident;
};

// Get incidents based on user role and query filters
const getIncidents = async (user, query) => {
  const { status, priority, category, search, all, scope } = query;
  let filter = {};

  // Treat both `all=true` and `scope=all` as an explicit request to see everything
  const wantsAllTickets = all === 'true' || all === true || scope === 'all';

  // 🔒 1. Role-based Visibility Guards
  if (user.role === 'End User' || user.role === 'Customer') {
    // End Users / Customers must ALWAYS see only their own tickets,
    // regardless of any "all" flag — do not relax this one.
    filter.reportedBy = user._id;
  } else if (user.role === 'Support Agent') {
    // Support Agent: default view = only tickets assigned to them,
    // but "All Tickets" tab explicitly requests the full list.
    if (!wantsAllTickets) {
      filter.assignedTo = user._id;
    }
    // when wantsAllTickets is true, filter stays {} for this branch → all tickets visible
  }
  // Admins: no restriction, filter stays {} always

  // 2. Filter criteria
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;

  // 3. Keyword search on title or description
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  // 4. Query Database with Populate & Sorting
  return await Incident.find(filter)
    .populate('category', 'name')
    .populate('reportedBy', 'name email')
    .populate('assignedTo', 'name email team')
    .sort({ createdAt: -1 });
};

const getIncidentAll = async () => {
  return await Incident.find()
    .populate('category', 'name')
    .populate('reportedBy', 'name email')
    .populate('assignedTo', 'name email team')
    .sort({ createdAt: -1 });
};



// Get single incident by ID
const getIncidentById = async (rawId, user) => {
  // 1. Clean rawId to strip any trailing colons or line numbers (e.g., "65baf46...:1" -> "65baf46...")
  const id = typeof rawId === 'string' ? rawId.split(':')[0].trim() : rawId;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    // const error = new Error('Invalid Incident ID format');
    // error.statusCode = 400;
    // throw error;
    throw createCustomError('Invalid Incident ID format', 400);
  }

  const incident = await Incident.findById(id)
    .populate('category', 'name description')
    .populate('reportedBy', 'name email role')
    .populate('assignedTo', 'name email role team');

  if (!incident) {
    // const error = new Error('Incident not found');
    // error.statusCode = 404;
    throw createCustomError('Incident not found',404);
  }

  const userId = (user._id || user.id).toString();
  const userRole = user.role?.trim();

  // 🔒 1. End User Guard: Can only view tickets they reported
  if (userRole === 'End User' || userRole === 'Customer') {
    const reporterId = incident.reportedBy?._id?.toString() || incident.reportedBy?.toString();
    if (reporterId !== userId) {
      // const error = new Error('Not authorized to view this incident');
      // error.statusCode = 403;
      throw createCustomError('Not authorized to view this incident',403);
    }
  }

  // 🔒 2. Support Agent Guard: Can view tickets assigned to them OR tickets in their team
  if (userRole === 'Support Agent') {
    const assignedAgentId = incident.assignedTo?._id?.toString() || incident.assignedTo?.toString();
    const isAssignedToMe = assignedAgentId === userId;
    
    // Check if ticket belongs to the agent's team (either ticket team or assigned agent team)
    const agentTeam = user.team;
    const incidentTeam = incident.team || incident.assignedTo?.team;
    const isSameTeam = agentTeam && incidentTeam && agentTeam === incidentTeam;

    // Allow if assigned directly OR if part of the same support team
    if (!isAssignedToMe && !isSameTeam) {
      // const error = new Error('Not authorized to view this incident. You can only view tickets assigned to you or your team.');
      // error.statusCode = 403;
      throw createCustomError('Not authorized to view this incident. You can only view tickets assigned to you or your team.',403);
    }
  }

  // Admins bypass all checks and can view any incident
  return incident;
};

// Assign Support Agent to Incident & Notify Agent (Admin Mode)
const assignIncident = async (incidentId, agentId, assignedByUserId) => {
  // 1. Verify incident exists
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw createCustomError('Incident not found',404);
  }

  let agent = null;

  // 2. If agentId is provided, verify agent exists and has appropriate role
  if (agentId) {
    agent = await User.findById(agentId);
    if (!agent) {
      throw createCustomError('Assigned agent not found',404);
    }
    if (agent.role !== 'Support Agent' && agent.role !== 'Admin') {
      throw createCustomError('Selected user is not authorized as a Support Agent or Admin',400);
    }

    incident.assignedTo = agentId;
  } else {
    // If agentId is null/undefined (cleared in UI), unassign the agent
    incident.assignedTo = null;
  }

  // 3. Update status to 'In Progress' if currently 'New' or 'Open'
  if (agentId && (incident.status === 'New' || incident.status === 'Open')) {
    incident.status = 'In Progress';
  }

  // 4. Save updated incident
  await incident.save();

  // 5. Record Activity Log
  await logActivity({
    incidentId: incident._id,
    action: agentId ? 'Agent Assigned' : 'Agent Unassigned',
    performedBy: assignedByUserId,
    newValue: agent ? agent.name : 'Unassigned',
  });

  // 6. 🔔 Send Email Notification to Assigned Support Agent
  if (agent && agent.email) {
    sendNotification({
      recipientEmail: agent.email,
      subject: `[Assignment] You have been assigned to Incident #${incident._id.toString().slice(-6)}`,
      message: `Hello ${agent.name},\n\nYou have been assigned to handle ticket: "${incident.title}".`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #28a745;">📌 New Incident Assigned to You</h2>
          <p>Hello <strong>${agent.name}</strong>,</p>
          <p>You have been assigned as the lead agent for the following incident:</p>
          <ul>
            <li><strong>Title:</strong> ${incident.title}</li>
            <li><strong>Priority:</strong> ${incident.priority}</li>
            <li><strong>SLA Due Date:</strong> ${new Date(incident.dueBy).toLocaleString()}</li>
          </ul>
          <p>Please review and update the ticket status in the portal.</p>
        </div>
      `,
    });
  }

  // 7. Return fully populated incident
  return await Incident.findById(incidentId)
    .populate('reportedBy', 'name email role')
    .populate('assignedTo', 'name email role team')
    .populate('category', 'name description');
};

// Reassign Incident within Team (Support Agent Mode)
const sanitizeId = (id) => {
  if (!id) return null;
  const cleanStr = typeof id === 'string' ? id.split(':')[0].trim() : id.toString();
  return mongoose.Types.ObjectId.isValid(cleanStr) ? cleanStr : null;
};

/**
 * Service: Reassign an incident within the same team
 */
const reassignWithinTeam = async (rawIncidentId, rawTargetAgentId, currentUser) => {
  // 1. Sanitize IDs
  const incidentId = sanitizeId(rawIncidentId);
  const targetAgentId = sanitizeId(rawTargetAgentId);

  if (!incidentId) {
    // const err = new Error('Invalid Incident ID format');
    // err.statusCode = 400;
    throw createCustomError('Invalid Incident ID format',400);
  }

  if (!targetAgentId) {
    // const err = new Error('Invalid Target Agent ID format');
    // err.statusCode = 400;
    throw createCustomError('Invalid Target Agent ID format',400);
  }

  // 2. Fetch Target Agent and Incident concurrently
  const [targetAgent, incident] = await Promise.all([
    User.findById(targetAgentId),
    Incident.findById(incidentId)
  ]);

  // Validate Incident existence
  if (!incident) {
    // const err = new Error('Incident not found');
    // err.statusCode = 404;
    throw createCustomError('Incident not found',404);
  }

  // Validate Target Agent existence and role
  if (!targetAgent || !['Support Agent', 'agent'].includes(targetAgent.role?.trim())) {
    // const err = new Error('Target support agent not found or invalid role');
    // err.statusCode = 400;
    throw createCustomError('Target support agent not found or invalid role',400);
  }

  // 🔒 3. STATUS CHECK: Flexible space-insensitive comparison
  // Normalizes 'In Progress' / 'InProgress' and 'Hold On' / 'On Hold'
  const allowedStatuses = ['inprogress', 'in progress', 'hold on', 'on hold'];
  const currentStatusNormalized = incident.status?.toLowerCase()?.trim();

  if (!allowedStatuses.includes(currentStatusNormalized)) {
    // const err = new Error(
    //   `Cannot reassign ticket with status "${incident.status}". Reassignment is only allowed for "In Progress" or "On Hold" tickets.`
    // );
    // err.statusCode = 400;
    throw createCustomError( `Cannot reassign ticket with status "${incident.status}". Reassignment is only allowed for "In Progress" or "On Hold" tickets.`
    ,400);
  }

  // 🔒 4. TEAM MATCHING & AUTHORIZATION: Ensure Support Agents only reassign within their team
  const userRole = currentUser.role?.trim();
  if (userRole === 'Support Agent') {
    const currentTeam = currentUser.team?.toString()?.toLowerCase()?.trim();
    const targetTeam = targetAgent.team?.toString()?.toLowerCase()?.trim();

    if (!currentTeam || currentTeam !== targetTeam) {
      // const err = new Error(
      //   `You can only reassign tickets to agents within your team (${currentUser.team || 'None'}).`
      // );
      // err.statusCode = 403;
      throw createCustomError(`You can only reassign tickets to agents within your team (${currentUser.team || 'None'}).`,403);
    }
  }

  // 5. Update the Incident
  const updatedIncident = await Incident.findByIdAndUpdate(
    incidentId,
    { assignedTo: targetAgentId },
    { new: true }
  )
    .populate('assignedTo', 'name email team')
    .populate('reportedBy', 'name email');

  // 6. Record Activity Log
  try {
    await logActivity({
      incidentId: updatedIncident._id,
      action: 'Incident Reassigned in Team',
      performedBy: currentUser._id || currentUser.id,
      newValue: targetAgent.name,
    });
  } catch (logErr) {
    //console.warn('Activity logging warning:', logErr.message);
    logger.warn(`Activity logging warning: ${logErr.message}`);
  }

  // 7. Send Email Notification
  if (targetAgent.email) {
    sendNotification({
      recipientEmail: targetAgent.email,
      subject: `[Reassigned] Ticket #${updatedIncident._id.toString().slice(-6)} reassigned to you`,
      message: `Hello ${targetAgent.name},\n\nTicket "${updatedIncident.title}" has been reassigned to you by ${currentUser.name}.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #28a745;">🔄 Ticket Reassigned to You</h2>
          <p>Hello <strong>${targetAgent.name}</strong>,</p>
          <p>The ticket <strong>"${updatedIncident.title}"</strong> has been reassigned to you by <strong>${currentUser.name}</strong>.</p>
        </div>
      `,
    }).catch((err) => {
      logger.error(`Failed to send reassignment email: ${err.message}`);
    }
  );
  }

  return updatedIncident;
};

// Fetch team members for the logged-in Support Agent
const getTeamMembers = async (currentUser) => {
  // Extract user ID safely
  const currentUserId = currentUser._id || currentUser.id;

  let query = {
    role: 'Support Agent',
    _id: { $ne: currentUserId } // Always exclude the current user
  };

  // If Support Agent has a team assigned, filter by team
  if (currentUser.role === 'Support Agent' && currentUser.team) {
    query.team = currentUser.team;
  }

  // Fetch agents and ALWAYS include 'role' in .select() to prevent Frontend filter bugs!
  const teamMembers = await User.find(query).select('_id name email team role categories');
  
  return teamMembers;
};
// Update Incident Status Workflow & Notify Reporter
const updateIncidentStatus = async (incidentId, status, updatedByUserId) => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw createCustomError('Incident not found',404);
  }

  const allowedStatuses = ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed'];
  if (!allowedStatuses.includes(status)) {
    throw createCustomError(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,400);
  }

  const oldStatus = incident.status;
  incident.status = status;
  await incident.save();

  // Record Activity Log
  await logActivity({
    incidentId: incident._id,
    action: 'Status Updated',
    performedBy: updatedByUserId,
    oldValue: oldStatus,
    newValue: status,
  });

  // 🔔 Send Email Notification to Reporter on Status Transition
  await incident.populate('reportedBy', 'name email');

  if (incident.reportedBy?.email) {
    sendNotification({
      recipientEmail: incident.reportedBy.email,
      subject: `[Status Update] Incident #${incident._id.toString().slice(-6)} is now ${status}`,
      message: `Hello ${incident.reportedBy.name},\n\nThe status of your incident "${incident.title}" has been updated to "${status}".`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #17a2b8;">🔄 Ticket Status Updated</h2>
          <p>Hello <strong>${incident.reportedBy.name}</strong>,</p>
          <p>The status of your support ticket <strong>"${incident.title}"</strong> has changed:</p>
          <p style="font-size: 16px;">
            Status: <del style="color: #888;">${oldStatus}</del> ➡️ <strong style="color: #007bff;">${status}</strong>
          </p>
        </div>
      `,
    });
  }

  return incident;
};

// Export filtered or full incidents to CSV
const exportIncidentsToCSV = async (user, query) => {
 const incidents = await getIncidents(user, query);

  // 2. Safeguard: If no records found for this user/role, return basic empty CSV headers
  if (!incidents || incidents.length === 0) {
    return 'Incident ID,Title,Category,Priority,Status,Reported By (Name),Reported By (Email),Assigned Agent,SLA Due Date,Created At\n';
  }

  // 3. Map fields properly for non-admin users as well
  const fields = [
    { label: 'Incident ID', value: '_id' },
    { label: 'Title', value: 'title' },
    { label: 'Category', value: (row) => row.category?.name || 'N/A' },
    { label: 'Priority', value: 'priority' },
    { label: 'Status', value: 'status' },
    { label: 'Reported By (Name)', value: (row) => row.reportedBy?.name || 'N/A' },
    { label: 'Reported By (Email)', value: (row) => row.reportedBy?.email || 'N/A' },
    { label: 'Assigned Agent', value: (row) => row.assignedTo?.name || 'Unassigned' },
    { label: 'SLA Due Date', value: (row) => (row.dueBy ? new Date(row.dueBy).toLocaleString() : 'N/A') },
    { label: 'Created At', value: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(incidents);

  return csv;
};

// 🆕 NEW — FR2-09: Escalation Notification
// Finds overdue tickets that haven't been escalated yet,
// and notifies the assignee + Admins (acting as "manager")
const escalateOverdueIncidents = async () => {
  const now = new Date();

  const overdueIncidents = await Incident.find({
    dueBy: { $lt: now },
    //isEscalated: { $ne: true },
    status: { $nin: ['Resolved', 'Closed'] },
  })
    .populate('assignedTo', 'name email')
    .populate('reportedBy', 'name email');

  if (overdueIncidents.length === 0) {
    logger.info('[Escalation] No overdue incidents to escalate.');
    return { escalatedCount: 0 };
  }

  const admins = await User.find({ role: 'Admin' }).select('name email');

  let escalatedCount = 0;

  for (const incident of overdueIncidents) {
    const recipients = [];

    if (incident.assignedTo?.email) {
      recipients.push(incident.assignedTo.email);
    }

    admins.forEach((admin) => {
      if (admin.email) recipients.push(admin.email);
    });

    for (const email of recipients) {
      await sendNotification({
        recipientEmail: email,
        subject: `[ESCALATION] Incident #${incident._id.toString().slice(-6)} is overdue`,
        message: `The ticket "${incident.title}" has breached its SLA and needs urgent attention.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #ff4d4f;">⏰ SLA Breach — Escalation Notice</h2>
            <p>The following ticket has passed its SLA due date and is still open:</p>
            <ul>
              <li><strong>Title:</strong> ${incident.title}</li>
              <li><strong>Priority:</strong> ${incident.priority}</li>
              <li><strong>Status:</strong> ${incident.status}</li>
              <li><strong>SLA Due Date:</strong> ${new Date(incident.dueBy).toLocaleString()}</li>
              <li><strong>Assigned To:</strong> ${incident.assignedTo?.name || 'Unassigned'}</li>
            </ul>
            <p>Please take action as soon as possible.</p>
          </div>
        `,
      }).catch((err) => {
        logger.error(`[Escalation] Failed to email ${email}: ${err.message}`);
      });
    }

    incident.isEscalated = true;
    incident.escalatedAt = now;
    await incident.save();

    await logActivity({
      incidentId: incident._id,
      action: 'Incident Escalated (SLA Breach)',
      performedBy: null,
      newValue: 'Escalated',
    });

    escalatedCount++;
  }

  logger.info(`[Escalation] Escalated ${escalatedCount} overdue incident(s).`);
  return { escalatedCount };
};


module.exports = {
  createIncident,
  getIncidents,
  getIncidentAll,
  getIncidentById,
  assignIncident,
  reassignWithinTeam,
  getTeamMembers,
  updateIncidentStatus,
  exportIncidentsToCSV,
  escalateOverdueIncidents,
};