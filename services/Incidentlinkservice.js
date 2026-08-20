// backend/services/incidentLinkService.js
const mongoose = require('mongoose');
const IncidentLink = require('../models/IncidentLink');
const { RELATIONSHIP_TYPES } = require('../models/IncidentLink');
const Incident = require('../models/Incident');
const logActivity = require('../utils/activityLogger');
const { textSimilarity } = require('../utils/textSimilarity');
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

const wrapMongooseError = (err) => {
  if (err.statusCode) return err;
  if (err.name === 'ValidationError') {
    const firstMessage = Object.values(err.errors || {})[0]?.message || err.message;
    return createCustomError(firstMessage, 400);
  }
  if (err.name === 'CastError') {
    return createCustomError(`Invalid value for field "${err.path}"`, 400);
  }
  return err;
};

/**
 * FR3-08 — Manually link two incidents with a relationship type.
 * Per permissions table: Admin (full access) or Support Agent ("suggest and
 * confirm incident links") may create a link. Not restricted to the assigned
 * agent — linking is a cross-incident action, not incident-ownership-specific.
 */
const createLink = async (rawFromId, rawToId, relationshipType, user) => {
  const fromIncidentId = sanitizeId(rawFromId);
  const toIncidentId = sanitizeId(rawToId);

  if (!fromIncidentId) {
    throw createCustomError('Invalid Incident ID format', 400);
  }
  if (!toIncidentId) {
    throw createCustomError('Invalid target Incident ID format', 400);
  }
  if (fromIncidentId === toIncidentId) {
    throw createCustomError('Cannot link an incident to itself', 400);
  }
  if (!RELATIONSHIP_TYPES.includes(relationshipType)) {
    throw createCustomError(
      `Relationship type must be one of: ${RELATIONSHIP_TYPES.join(', ')}`,
      400
    );
  }

  const userRole = user.role?.trim();
  if (userRole !== 'Admin' && userRole !== 'Support Agent') {
    throw createCustomError('Not authorized to link incidents', 403);
  }

  const [fromIncident, toIncident] = await Promise.all([
    Incident.findById(fromIncidentId),
    Incident.findById(toIncidentId),
  ]);
  if (!fromIncident) throw createCustomError('Incident not found', 404);
  if (!toIncident) throw createCustomError('Target incident not found', 404);

  // Duplicate-link guard. For 'Caused-By', direction is a distinct claim
  // (A caused-by B is not the same statement as B caused-by A), so only an
  // exact direction match counts as a duplicate. 'Related'/'Duplicate' are
  // symmetric — either direction is the same link.
  const existingQuery =
    relationshipType === 'Caused-By'
      ? { fromIncidentId, toIncidentId, relationshipType }
      : {
          relationshipType,
          $or: [
            { fromIncidentId, toIncidentId },
            { fromIncidentId: toIncidentId, toIncidentId: fromIncidentId },
          ],
        };

  const existing = await IncidentLink.findOne(existingQuery);
  if (existing) {
    throw createCustomError('This link already exists between these incidents', 409);
  }

  let link;
  try {
    link = await IncidentLink.create({
      fromIncidentId,
      toIncidentId,
      relationshipType,
      linkedBy: user._id || user.id,
    });
  } catch (err) {
    throw wrapMongooseError(err);
  }

  const userId = user._id || user.id;

  // Log on both incidents so the link shows up in each one's audit history.
  await logActivity({
    incidentId: fromIncidentId,
    action: `Linked to Incident #${toIncident._id.toString().slice(-6)} (${relationshipType})`,
    performedBy: userId,
  });
  await logActivity({
    incidentId: toIncidentId,
    action: `Linked to Incident #${fromIncident._id.toString().slice(-6)} (${
      relationshipType === 'Caused-By' ? 'Causes' : relationshipType
    })`,
    performedBy: userId,
  });

  return link;
};

/**
 * FR3-08 — "the link is visible from both incidents": fetch every link
 * touching this incident, from either side, and normalize the shape so the
 * frontend always sees "the other incident" + a relationship label already
 * phrased correctly for the incident being viewed (handles Caused-By inversion).
 */
const getLinksForIncident = async (rawIncidentId) => {
  const incidentId = sanitizeId(rawIncidentId);
  if (!incidentId) {
    throw createCustomError('Invalid Incident ID format', 400);
  }

  const links = await IncidentLink.find({
    $or: [{ fromIncidentId: incidentId }, { toIncidentId: incidentId }],
  })
    .populate('fromIncidentId', 'title status priority')
    .populate('toIncidentId', 'title status priority')
    .populate('linkedBy', 'name email')
    .sort({ createdAt: -1 });

  return links
    .filter((link) => link.fromIncidentId && link.toIncidentId) // guard against a deleted incident on either side
    .map((link) => {
      const isFrom = link.fromIncidentId._id.toString() === incidentId;
      const otherIncident = isFrom ? link.toIncidentId : link.fromIncidentId;

      let relationshipLabel = link.relationshipType;
      if (link.relationshipType === 'Caused-By') {
        relationshipLabel = isFrom ? 'Caused By' : 'Causes';
      }

      return {
        linkId: link._id,
        otherIncident,
        relationshipType: relationshipLabel,
        linkedBy: link.linkedBy,
        createdAt: link.createdAt,
      };
    });
};

/**
 * FR3-08 — remove a link. Per permissions table, "unlink" is explicitly an
 * Admin action.
 */
const deleteLink = async (rawLinkId, user) => {
  const linkId = sanitizeId(rawLinkId);
  if (!linkId) {
    throw createCustomError('Invalid link ID format', 400);
  }

  const userRole = user.role?.trim();
  if (userRole !== 'Admin') {
    throw createCustomError('Only an Admin can unlink incidents', 403);
  }

  const link = await IncidentLink.findById(linkId);
  if (!link) {
    throw createCustomError('Incident link not found', 404);
  }

  await IncidentLink.deleteOne({ _id: linkId });

  const userId = user._id || user.id;
  await logActivity({
    incidentId: link.fromIncidentId,
    action: 'Incident Link Removed',
    performedBy: userId,
  });
  await logActivity({
    incidentId: link.toIncidentId,
    action: 'Incident Link Removed',
    performedBy: userId,
  });

  return true;
};

/**
 * FR3-09 — suggest possible links for an incident based on:
 *  - matching category
 *  - a configurable time window (CORRELATION_TIME_WINDOW_HOURS env var, default 24h)
 *  - title/description similarity
 * Already-linked incidents are excluded so suggestions don't repeat confirmed links.
 */
const getCorrelationSuggestions = async (rawIncidentId) => {
  const incidentId = sanitizeId(rawIncidentId);
  if (!incidentId) {
    throw createCustomError('Invalid Incident ID format', 400);
  }

  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw createCustomError('Incident not found', 404);
  }

  // 🔧 Configurable time window per FR3-09 — set CORRELATION_TIME_WINDOW_HOURS
  // in .env to change it. Defaults to 24 hours either side of this incident's
  // creation time.
  const windowHours = Number(process.env.CORRELATION_TIME_WINDOW_HOURS) || 24;
  const windowMs = windowHours * 60 * 60 * 1000;
  const createdAt = incident.createdAt.getTime();
  const windowStart = new Date(createdAt - windowMs);
  const windowEnd = new Date(createdAt + windowMs);

  const candidates = await Incident.find({
    _id: { $ne: incident._id },
    category: incident.category,
    createdAt: { $gte: windowStart, $lte: windowEnd },
  }).select('title description status priority category createdAt');

  // Exclude incidents already linked to this one — don't suggest a link that exists.
  const existingLinks = await IncidentLink.find({
    $or: [{ fromIncidentId: incident._id }, { toIncidentId: incident._id }],
  }).select('fromIncidentId toIncidentId');

  const alreadyLinkedIds = new Set(
    existingLinks.map((l) =>
      (l.fromIncidentId.toString() === incidentId ? l.toIncidentId : l.fromIncidentId).toString()
    )
  );

  // 🔧 Minimum score to surface as a suggestion — category+time already
  // narrowed the pool, so this just filters out near-zero title overlap.
  const minScore = Number(process.env.CORRELATION_MIN_SCORE_PERCENT) || 15;

  const suggestions = candidates
    .filter((c) => !alreadyLinkedIds.has(c._id.toString()))
    .map((c) => {
      const titleSimilarity = textSimilarity(incident.title, c.title);
      const descriptionSimilarity = textSimilarity(incident.description, c.description);
      // Title weighted higher — a matching title is a stronger correlation signal.
      const score = titleSimilarity * 0.7 + descriptionSimilarity * 0.3;

      return {
        incident: c,
        titleSimilarityPercent: Math.round(titleSimilarity * 100),
        descriptionSimilarityPercent: Math.round(descriptionSimilarity * 100),
        scorePercent: Math.round(score * 100),
        matchedCriteria: {
          sameCategory: true, // guaranteed by the query itself
          withinTimeWindow: true, // guaranteed by the query itself
        },
      };
    })
    .filter((s) => s.scorePercent >= minScore)
    .sort((a, b) => b.scorePercent - a.scorePercent)
    .slice(0, 10);

  return { windowHours, suggestions };
};

module.exports = {
  createLink,
  getLinksForIncident,
  deleteLink,
  getCorrelationSuggestions,
};