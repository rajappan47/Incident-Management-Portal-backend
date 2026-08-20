// backend/services/incidentGroupingService.js
const mongoose = require('mongoose');
const Incident = require('../models/Incident');
const logActivity = require('../utils/activityLogger');

const createCustomError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sanitizeId = (id) => {
  if (!id) return null;
  const cleanStr = typeof id === 'string' ? id.split(':')[0].trim() : id.toString();
  return mongoose.Types.ObjectId.isValid(cleanStr) ? cleanStr : null;
};

// FR3-08's manual-link permission is reused here (Admin or Support Agent) —
// grouping incidents is the same class of cross-incident action as linking them.
const requireLinkPermission = (user) => {
  const role = user.role?.trim();
  if (role !== 'Admin' && role !== 'Support Agent') {
    throw createCustomError('Not authorized to manage incident grouping', 403);
  }
};

// Ungrouping (unmark / remove child) mirrors FR3-08's "unlink" restriction — Admin only.
const requireUnlinkPermission = (user) => {
  const role = user.role?.trim();
  if (role !== 'Admin') {
    throw createCustomError('Only an Admin can remove incident grouping', 403);
  }
};

/**
 * FR3-11 — Mark an incident as a major incident (parent).
 */
const markAsMajorIncident = async (rawIncidentId, user) => {
  requireLinkPermission(user);

  const incidentId = sanitizeId(rawIncidentId);
  if (!incidentId) throw createCustomError('Invalid Incident ID format', 400);

  const incident = await Incident.findById(incidentId);
  if (!incident) throw createCustomError('Incident not found', 404);

  if (incident.parentIncidentId) {
    throw createCustomError(
      'This incident is itself a child of another incident and cannot also be a parent',
      400
    );
  }

  if (incident.isParentIncident) {
    return incident; // already a major incident — idempotent no-op
  }

  incident.isParentIncident = true;
  await incident.save();

  await logActivity({
    incidentId: incident._id,
    action: 'Marked as Major Incident',
    performedBy: user._id || user.id,
  });

  return incident;
};

/**
 * FR3-11 — Unmark a major incident. Blocked while it still has children —
 * caller must remove/reassign children first, to avoid silently orphaning them.
 */
const unmarkAsMajorIncident = async (rawIncidentId, user) => {
  requireUnlinkPermission(user);

  const incidentId = sanitizeId(rawIncidentId);
  if (!incidentId) throw createCustomError('Invalid Incident ID format', 400);

  const incident = await Incident.findById(incidentId);
  if (!incident) throw createCustomError('Incident not found', 404);

  const childCount = await Incident.countDocuments({ parentIncidentId: incidentId });
  if (childCount > 0) {
    throw createCustomError(
      `Cannot unmark: this incident still has ${childCount} child incident(s). Remove them first.`,
      400
    );
  }

  incident.isParentIncident = false;
  await incident.save();

  await logActivity({
    incidentId: incident._id,
    action: 'Unmarked as Major Incident',
    performedBy: user._id || user.id,
  });

  return incident;
};

/**
 * FR3-11 — Attach a child incident under a parent (major incident).
 * Keeps the hierarchy flat: a child cannot itself have children.
 */
const addChildIncident = async (rawParentId, rawChildId, user) => {
  requireLinkPermission(user);

  const parentId = sanitizeId(rawParentId);
  const childId = sanitizeId(rawChildId);
  if (!parentId) throw createCustomError('Invalid parent Incident ID format', 400);
  if (!childId) throw createCustomError('Invalid child Incident ID format', 400);
  if (parentId === childId) throw createCustomError('An incident cannot be its own child', 400);

  const [parent, child] = await Promise.all([
    Incident.findById(parentId),
    Incident.findById(childId),
  ]);
  if (!parent) throw createCustomError('Parent incident not found', 404);
  if (!child) throw createCustomError('Child incident not found', 404);

  if (parent.parentIncidentId) {
    throw createCustomError(
      'The parent you selected is itself a child of another incident — grouping stays flat (one level).',
      400
    );
  }
  if (child.isParentIncident) {
    throw createCustomError(
      'The incident you selected is itself a major incident with its own children — grouping stays flat (one level).',
      400
    );
  }
  if (child.parentIncidentId && child.parentIncidentId.toString() === parentId) {
    return { parent, child }; // already grouped under this parent — idempotent no-op
  }
  if (child.parentIncidentId) {
    throw createCustomError(
      'This incident already belongs to a different parent. Remove it from that group first.',
      409
    );
  }

  child.parentIncidentId = parentId;
  await child.save();

  if (!parent.isParentIncident) {
    parent.isParentIncident = true;
    await parent.save();
  }

  const userId = user._id || user.id;
  await logActivity({
    incidentId: parent._id,
    action: `Child Incident Added (#${child._id.toString().slice(-6)})`,
    performedBy: userId,
  });
  await logActivity({
    incidentId: child._id,
    action: `Grouped Under Major Incident #${parent._id.toString().slice(-6)}`,
    performedBy: userId,
  });

  return { parent, child };
};

/**
 * FR3-11 — Detach a child from its parent.
 */
const removeChildIncident = async (rawParentId, rawChildId, user) => {
  requireUnlinkPermission(user);

  const parentId = sanitizeId(rawParentId);
  const childId = sanitizeId(rawChildId);
  if (!parentId) throw createCustomError('Invalid parent Incident ID format', 400);
  if (!childId) throw createCustomError('Invalid child Incident ID format', 400);

  const child = await Incident.findById(childId);
  if (!child) throw createCustomError('Child incident not found', 404);

  if (!child.parentIncidentId || child.parentIncidentId.toString() !== parentId) {
    throw createCustomError('This incident is not a child of the specified parent', 400);
  }

  child.parentIncidentId = null;
  await child.save();

  const userId = user._id || user.id;
  await logActivity({
    incidentId: parentId,
    action: `Child Incident Removed (#${child._id.toString().slice(-6)})`,
    performedBy: userId,
  });
  await logActivity({
    incidentId: child._id,
    action: 'Removed From Major Incident Group',
    performedBy: userId,
  });

  return true;
};

/**
 * FR3-11 / FR3-12 / FR3-13 — full grouping picture for an incident:
 * whether it's a parent (with live-queried children) or a child (with its parent).
 */
const getIncidentGroup = async (rawIncidentId) => {
  const incidentId = sanitizeId(rawIncidentId);
  if (!incidentId) throw createCustomError('Invalid Incident ID format', 400);

  const incident = await Incident.findById(incidentId);
  if (!incident) throw createCustomError('Incident not found', 404);

  const children = await Incident.find({ parentIncidentId: incidentId }).select(
    'title status priority'
  );

  let parent = null;
  if (incident.parentIncidentId) {
    parent = await Incident.findById(incident.parentIncidentId).select('title status priority');
  }

  return {
    isParentIncident: incident.isParentIncident,
    parent,
    children,
  };
};

module.exports = {
  markAsMajorIncident,
  unmarkAsMajorIncident,
  addChildIncident,
  removeChildIncident,
  getIncidentGroup,
  getMajorIncidentsOverview,
};

// =====================================================================
// 🆕 V3 — FR3-16: Correlation & Major Incident Overview widget
// Active major incidents (not Resolved/Closed) with a count of children
// (FR3-11) and correlation links (FR3-08), shown separately since they're
// different relationship types — combining them into one number would
// hide which kind of connection is actually driving the count.
// =====================================================================
async function getMajorIncidentsOverview(user) {
  // Lazy require to avoid a circular dependency at module-load time
  // (IncidentLink doesn't import this service, but keeping the require
  // local here mirrors how the rest of this file only pulls in what a
  // given function needs).
  const IncidentLink = require('../models/IncidentLink');

  // 🩹 FIX: query ALL major incidents first, not just ones whose own status
  // is open. "Active" is decided per-incident below, based on the parent's
  // status OR whether it still has an unresolved child — a parent can be
  // marked Resolved while a child is still In Progress (the FR3-13 prompt
  // is opt-in, not enforced), and that combination should still show up
  // here as work that isn't actually finished.
  const majorFilter = { isParentIncident: true };

  // 🩹 FIX — team-scoped view for Support Agents, per the doc's opening note.
  if (user?.role === 'Support Agent' && user.team) {
    const User = require('../models/User');
    const teamUserIds = (await User.find({ team: user.team }).select('_id')).map((u) => u._id);
    majorFilter.assignedTo = { $in: teamUserIds };
  }

  const allMajors = await Incident.find(majorFilter).select(
    'title status priority createdAt'
  );

  const overviewWithInactive = await Promise.all(
    allMajors.map(async (major) => {
      const [childCount, openChildCount, linkCount] = await Promise.all([
        Incident.countDocuments({ parentIncidentId: major._id }),
        Incident.countDocuments({
          parentIncidentId: major._id,
          status: { $nin: ['Resolved', 'Closed'] },
        }),
        IncidentLink.countDocuments({
          $or: [{ fromIncidentId: major._id }, { toIncidentId: major._id }],
        }),
      ]);

      const parentIsOpen = !['Resolved', 'Closed'].includes(major.status);
      const isActive = parentIsOpen || openChildCount > 0;

      return {
        incident: major,
        childCount,
        openChildCount,
        correlationLinkCount: linkCount,
        totalConnected: childCount + linkCount,
        isActive,
      };
    })
  );

  const overview = overviewWithInactive.filter((row) => row.isActive);

  overview.sort((a, b) => b.totalConnected - a.totalConnected);

  return overview;
}