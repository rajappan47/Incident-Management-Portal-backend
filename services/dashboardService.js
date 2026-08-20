// backend/services/dashboardService.js
const Incident = require('../models/Incident');
const logger = require('../utils/logger');
const RCA = require('../models/RCA'); 

const createCustomError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getDashboardMetrics = async (user) => {

  if (!user) {
    throw createCustomError('User context is missing', 401);
  }
logger.debug(`Fetching dashboard metrics for user: ${user._id || user.id} (Role: ${user.role})`);
  let filter = {};

  // If End User, only show metrics for their own incidents
  if (user.role === 'End User') {
    filter.reportedBy = user._id;
  }

  const now = new Date();

  // 1. Total Count
  const totalIncidents = await Incident.countDocuments(filter);

  // 2. Counts by Status
  const newCount = await Incident.countDocuments({ ...filter, status: 'New' });
  const inProgressCount = await Incident.countDocuments({ ...filter, status: 'In Progress' });
  const onHoldCount = await Incident.countDocuments({ ...filter, status: 'On Hold' });
  const resolvedCount = await Incident.countDocuments({ ...filter, status: 'Resolved' });
  const closedCount = await Incident.countDocuments({ ...filter, status: 'Closed' });

  // 3. Open vs Closed total
  const totalOpen = newCount + inProgressCount + onHoldCount;

  // 4. Counts by Priority
  const criticalCount = await Incident.countDocuments({ ...filter, priority: 'Critical' });
  const highCount = await Incident.countDocuments({ ...filter, priority: 'High' });
  const mediumCount = await Incident.countDocuments({ ...filter, priority: 'Medium' });
  const lowCount = await Incident.countDocuments({ ...filter, priority: 'Low' });

  // 5. SLA Breached Incidents (Open incidents past dueBy target)
  const slaBreachedCount = await Incident.countDocuments({
    ...filter,
    status: { $nin: ['Resolved', 'Closed'] },
    dueBy: { $lt: now },
  });

  return {
    overview: {
      total: totalIncidents,
      open: totalOpen,
      resolved: resolvedCount,
      closed: closedCount,
      slaBreached: slaBreachedCount,
    },
    statusBreakdown: {
      New: newCount,
      InProgress: inProgressCount,
      OnHold: onHoldCount,
      Resolved: resolvedCount,
      Closed: closedCount,
    },
    priorityBreakdown: {
      Critical: criticalCount,
      High: highCount,
      Medium: mediumCount,
      Low: lowCount,
    },
  };
};

async function getTopRootCauses({ startDate, endDate, limit = 5 } = {}, user) {
  const match = { status: 'Approved' };
 
  if (startDate || endDate) {
    match.approvedAt = {};
    if (startDate) match.approvedAt.$gte = new Date(startDate);
    if (endDate) match.approvedAt.$lte = new Date(endDate);
  }
 
  // 🩹 FIX — per the doc's opening note: "Admin/Manager use and, where noted,
  // a team-scoped view for Agents." RCA has no team field of its own, so
  // this scopes via the incident it belongs to.
  if (user?.role === 'Support Agent' && user.team) {
    const User = require('../models/User');
    const teamUserIds = (await User.find({ team: user.team }).select('_id')).map((u) => u._id);
    const teamIncidentIds = (
      await Incident.find({ assignedTo: { $in: teamUserIds } }).select('_id')
    ).map((i) => i._id);
    match.incidentId = { $in: teamIncidentIds };
  }
 
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
 
  const results = await RCA.aggregate([
    { $match: match },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: safeLimit },
  ]);
 
  const totalApprovedInRange = await RCA.countDocuments(match);
 
  return {
    totalApprovedRCAs: totalApprovedInRange,
    topCauses: results.map((r) => ({
      category: r._id,
      count: r.count,
      percent: totalApprovedInRange ? Math.round((r.count / totalApprovedInRange) * 100) : 0,
    })),
  };
}

// =====================================================================
// 🆕 V3 — FR3-15: Top Root Causes Widget
// Ranked view of the most frequent root cause categories from Approved
// RCAs over a selected period (matches by approvedAt, not createdAt —
// the ranking should reflect when the cause was confirmed, not drafted).
// =====================================================================
async function getAgentPerformance({ groupBy = 'agent', startDate, endDate } = {}, user) {
  const User = require('../models/User');
 
  const match = { status: { $in: ['Resolved', 'Closed'] }, assignedTo: { $ne: null } };
  if (startDate || endDate) {
    match.updatedAt = {};
    if (startDate) match.updatedAt.$gte = new Date(startDate);
    if (endDate) match.updatedAt.$lte = new Date(endDate);
  }
 
  // 🩹 FIX — team-scoped view for Support Agents, per the doc's opening note.
  if (user?.role === 'Support Agent' && user.team) {
    const teamUserIds = (await User.find({ team: user.team }).select('_id')).map((u) => u._id);
    match.assignedTo = { $in: teamUserIds };
  }
 
  const resolvedIncidents = await Incident.find(match)
    .select('assignedTo dueBy createdAt updatedAt')
    .populate('assignedTo', 'name team');
 
  // Bucket by agent first — team rollup is derived from the same buckets
  // below, so an incident is never double-counted between the two views.
  const agentBuckets = new Map(); // agentId -> { name, team, resolutionMsList, violatedCount, total }
 
  resolvedIncidents.forEach((inc) => {
    const agent = inc.assignedTo;
    if (!agent) return;
    const agentId = agent._id.toString();
 
    if (!agentBuckets.has(agentId)) {
      agentBuckets.set(agentId, {
        id: agentId,
        name: agent.name || 'Unknown Agent',
        team: agent.team || 'Unassigned Team',
        resolutionMsList: [],
        violatedCount: 0,
        total: 0,
      });
    }
 
    const bucket = agentBuckets.get(agentId);
    bucket.total += 1;
 
    const resolutionMs = new Date(inc.updatedAt) - new Date(inc.createdAt);
    if (resolutionMs >= 0) bucket.resolutionMsList.push(resolutionMs);
 
    if (inc.dueBy && new Date(inc.updatedAt) > new Date(inc.dueBy)) {
      bucket.violatedCount += 1;
    }
  });
 
  const avgOf = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0);
 
  const agentRows = Array.from(agentBuckets.values()).map((b) => ({
    id: b.id,
    name: b.name,
    team: b.team,
    ticketsResolved: b.total,
    avgResolutionMs: Math.round(avgOf(b.resolutionMsList)),
    slaCompliancePercent: b.total ? Math.round(((b.total - b.violatedCount) / b.total) * 100) : 100,
  }));
 
  if (groupBy === 'team') {
    const teamBuckets = new Map();
    agentRows.forEach((row) => {
      if (!teamBuckets.has(row.team)) {
        teamBuckets.set(row.team, { team: row.team, ticketsResolved: 0, resolutionMsSum: 0, compliantSum: 0 });
      }
      const t = teamBuckets.get(row.team);
      t.ticketsResolved += row.ticketsResolved;
      t.resolutionMsSum += row.avgResolutionMs * row.ticketsResolved;
      t.compliantSum += Math.round((row.slaCompliancePercent / 100) * row.ticketsResolved);
    });
 
    return Array.from(teamBuckets.values())
      .map((t) => ({
        team: t.team,
        ticketsResolved: t.ticketsResolved,
        avgResolutionMs: t.ticketsResolved ? Math.round(t.resolutionMsSum / t.ticketsResolved) : 0,
        slaCompliancePercent: t.ticketsResolved ? Math.round((t.compliantSum / t.ticketsResolved) * 100) : 100,
      }))
      .sort((a, b) => b.ticketsResolved - a.ticketsResolved);
  }
 
  return agentRows.sort((a, b) => b.ticketsResolved - a.ticketsResolved);
}

module.exports = { getDashboardMetrics, getTopRootCauses, getAgentPerformance };
