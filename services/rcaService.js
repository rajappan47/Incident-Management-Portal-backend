// backend/services/rcaService.js
const mongoose = require('mongoose');
const RCA = require('../models/RCA');
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

// 🩹 Translates raw Mongoose errors into clean HTTP errors instead of
// letting them fall through as an unhandled 500.
const wrapMongooseError = (err) => {
  if (err.statusCode) return err; // already one of our createCustomError instances
  if (err.name === 'ValidationError') {
    const firstMessage = Object.values(err.errors || {})[0]?.message || err.message;
    return createCustomError(firstMessage, 400);
  }
  if (err.name === 'CastError') {
    return createCustomError(`Invalid value for field "${err.path}"`, 400);
  }
  if (err.code === 11000) {
    return createCustomError(
      'An RCA record already exists for this incident. Update the existing record instead.',
      409
    );
  }
  return err;
};

/**
 * FR3-01 — Create a structured RCA record and attach it to an incident.
 * Per permissions table: only the Support Agent assigned to the incident may
 * author it. Admin's RCA role is approve/reject only (see approveRCA/rejectRCA).
 */
const createRCA = async ({
  incidentId: rawIncidentId,
  category,
  fiveWhys, // 🆕 FR3-04 — Guided 5-Whys template
  description,
  contributingFactors,
  correctiveActions,
  preventiveActions,
  user,
}) => {
  const incidentId = sanitizeId(rawIncidentId);
  if (!incidentId) {
    throw createCustomError('Invalid Incident ID format', 400);
  }

  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw createCustomError('Incident not found', 404);
  }

  // 🔒 Authorization: only the Support Agent assigned to this incident may author an RCA.
  const userId = (user._id || user.id).toString();
  const userRole = user.role?.trim();

  if (userRole !== 'Support Agent') {
    throw createCustomError('Only a Support Agent can author an RCA record', 403);
  }

  const assignedAgentId = incident.assignedTo?.toString();
  if (assignedAgentId !== userId) {
    throw createCustomError(
      'Not authorized to author an RCA on an incident not assigned to you',
      403
    );
  }

  // Prevent duplicate RCA records — an incident has at most one (1:1 via Incident.rcaId).
  const existing = await RCA.findOne({ incidentId });
  if (existing) {
    throw createCustomError(
      'An RCA record already exists for this incident. Update the existing record instead.',
      409
    );
  }

  let rca;
  try {
    rca = await RCA.create({
      incidentId,
      category,
      fiveWhys: {
        why1: fiveWhys?.why1,
        why2: fiveWhys?.why2 || '',
        why3: fiveWhys?.why3 || '',
        why4: fiveWhys?.why4 || '',
        why5: fiveWhys?.why5 || '',
      },
      description,
      contributingFactors,
      correctiveActions,
      preventiveActions,
      authorId: userId,
    });

    // Keep Incident.rcaId in sync
    incident.rcaId = rca._id;
    await incident.save();
  } catch (err) {
    throw wrapMongooseError(err);
  }

  await logActivity({
    incidentId: incident._id,
    action: 'RCA Record Created',
    performedBy: userId,
    newValue: category,
  });

  return rca;
};

/**
 * Fetch the RCA record for a given incident (used for viewing what was just created,
 * and to check whether one already exists). Full read-only display on the incident
 * detail page is FR3-07.
 */
const getRCAByIncidentId = async (rawIncidentId, user) => {
  const incidentId = sanitizeId(rawIncidentId);
  if (!incidentId) {
    throw createCustomError('Invalid Incident ID format', 400);
  }

  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw createCustomError('Incident not found', 404);
  }

  const rca = await RCA.findOne({ incidentId })
    .populate('authorId', 'name email role')
    .populate('reviewedBy', 'name email role');

  if (!rca) {
    throw createCustomError('No RCA record exists for this incident', 404);
  }

  // 🔒 Same visibility rule as incident detail: End Users only see their own incident's RCA
  const userId = (user._id || user.id).toString();
  const userRole = user.role?.trim();
  if (userRole === 'End User' || userRole === 'Customer') {
    const reporterId = incident.reportedBy?.toString();
    if (reporterId !== userId) {
      throw createCustomError('Not authorized to view this RCA record', 403);
    }
  }

  return rca;
};

// =====================================================================
// 🆕 FR3-02 — RCA Status Workflow: Draft → In Review → Approved
// =====================================================================

const findOwnedRCA = async (rawIncidentId) => {
  const incidentId = sanitizeId(rawIncidentId);
  if (!incidentId) {
    throw createCustomError('Invalid Incident ID format', 400);
  }
  const rca = await RCA.findOne({ incidentId });
  if (!rca) {
    throw createCustomError('No RCA record exists for this incident', 404);
  }
  return rca;
};

/**
 * FR3-02 — Edit an RCA while it's still a Draft (needed to act on
 * reviewer comments after a reject, or just to fix content pre-submit).
 * Only the Support Agent author may edit — Admin's role is approve/reject only.
 */
const updateRCADraft = async (rawIncidentId, updates, user) => {
  const rca = await findOwnedRCA(rawIncidentId);

  if (rca.status !== 'Draft') {
    throw createCustomError(
      `RCA cannot be edited while status is "${rca.status}". Only Draft records can be edited.`,
      400
    );
  }

  const userId = (user._id || user.id).toString();
  const isAuthor = rca.authorId.toString() === userId;

  if (!isAuthor) {
    throw createCustomError('Not authorized to edit this RCA record', 403);
  }

  const editableFields = [
    'category',
    'fiveWhys', // 🆕 FR3-04
    'description',
    'contributingFactors',
    'correctiveActions',
    'preventiveActions',
  ];
  editableFields.forEach((field) => {
    if (updates[field] !== undefined) rca[field] = updates[field];
  });

  try {
    await rca.save();
  } catch (err) {
    throw wrapMongooseError(err);
  }

  await logActivity({
    incidentId: rca.incidentId,
    action: 'RCA Draft Updated',
    performedBy: userId,
  });

  return rca;
};

/**
 * FR3-02 — Draft → In Review.
 * Only the Support Agent author may submit — Admin's role is approve/reject only.
 */
const submitForReview = async (rawIncidentId, user) => {
  const rca = await findOwnedRCA(rawIncidentId);

  if (rca.status !== 'Draft') {
    throw createCustomError(
      `Only a Draft RCA can be submitted for review (current status: "${rca.status}")`,
      400
    );
  }

  const userId = (user._id || user.id).toString();
  const isAuthor = rca.authorId.toString() === userId;

  if (!isAuthor) {
    throw createCustomError('Not authorized to submit this RCA record', 403);
  }

  rca.status = 'In Review';
  rca.rejectionComments = ''; // clear any prior rejection note on resubmission
  await rca.save();

  await logActivity({
    incidentId: rca.incidentId,
    action: 'RCA Submitted for Review',
    performedBy: userId,
    oldValue: 'Draft',
    newValue: 'In Review',
  });

  return rca;
};

/**
 * FR3-02 / FR3-05 — In Review → Approved. Admin/Manager only.
 */
const approveRCA = async (rawIncidentId, user) => {
  const rca = await findOwnedRCA(rawIncidentId);

  const userRole = user.role?.trim();
  if (userRole !== 'Admin') {
    throw createCustomError('Only an Admin can approve an RCA record', 403);
  }

  if (rca.status !== 'In Review') {
    throw createCustomError(
      `Only an "In Review" RCA can be approved (current status: "${rca.status}")`,
      400
    );
  }

  const userId = (user._id || user.id).toString();

  rca.status = 'Approved';
  rca.reviewedBy = userId;
  rca.approvedAt = new Date();
  await rca.save();

  await logActivity({
    incidentId: rca.incidentId,
    action: 'RCA Approved',
    performedBy: userId,
    oldValue: 'In Review',
    newValue: 'Approved',
  });

  return rca;
};

/**
 * FR3-02 / FR3-05 — In Review → Draft, with reviewer comments. Admin/Manager only.
 */
const rejectRCA = async (rawIncidentId, comments, user) => {
  const rca = await findOwnedRCA(rawIncidentId);

  const userRole = user.role?.trim();
  if (userRole !== 'Admin') {
    throw createCustomError('Only an Admin can send back an RCA record', 403);
  }

  if (rca.status !== 'In Review') {
    throw createCustomError(
      `Only an "In Review" RCA can be sent back (current status: "${rca.status}")`,
      400
    );
  }

  if (!comments || !comments.trim()) {
    throw createCustomError('Comments are required when sending an RCA back for revision', 400);
  }

  const userId = (user._id || user.id).toString();

  rca.status = 'Draft';
  rca.reviewedBy = userId;
  rca.rejectionComments = comments.trim();
  await rca.save();

  await logActivity({
    incidentId: rca.incidentId,
    action: 'RCA Sent Back for Revision',
    performedBy: userId,
    oldValue: 'In Review',
    newValue: 'Draft',
  });

  return rca;
};

// =====================================================================
// 🩹 ONE-TIME REPAIR — fixes incidents whose rcaId link never got saved
// due to the earlier Mongoose 7 pre('save') bug. Safe to run repeatedly;
// it just re-syncs every RCA -> Incident link using this app's own live
// DB connection, so there's no risk of touching the wrong database.
// =====================================================================
const repairRCALinks = async () => {
  const allRCAs = await RCA.find({});
  let fixedCount = 0;
  const details = [];

  for (const rcaDoc of allRCAs) {
    const incident = await Incident.findById(rcaDoc.incidentId);
    if (!incident) {
      details.push({ rcaId: rcaDoc._id, incidentId: rcaDoc.incidentId, result: 'incident not found' });
      continue;
    }
    const alreadyLinked = incident.rcaId && incident.rcaId.toString() === rcaDoc._id.toString();
    if (!alreadyLinked) {
      incident.rcaId = rcaDoc._id;
      await incident.save();
      fixedCount++;
      details.push({ rcaId: rcaDoc._id, incidentId: incident._id, result: 'fixed' });
    } else {
      details.push({ rcaId: rcaDoc._id, incidentId: incident._id, result: 'already linked' });
    }
  }

  return { totalRCAs: allRCAs.length, fixedCount, details };
};

module.exports = {
  createRCA,
  getRCAByIncidentId,
  updateRCADraft,
  submitForReview,
  approveRCA,
  rejectRCA,
  repairRCALinks,
};