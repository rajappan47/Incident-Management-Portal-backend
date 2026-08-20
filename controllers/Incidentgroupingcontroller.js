const incidentGroupingService = require('../services/Incidentgroupingservice');

// PATCH /api/incidents/:id/mark-major
const markAsMajorIncident = async (req, res, next) => {
  try {
    const incident = await incidentGroupingService.markAsMajorIncident(req.params.id, req.user);
    res.status(200).json({ message: 'Incident marked as major incident', incident });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/incidents/:id/unmark-major
const unmarkAsMajorIncident = async (req, res, next) => {
  try {
    const incident = await incidentGroupingService.unmarkAsMajorIncident(req.params.id, req.user);
    res.status(200).json({ message: 'Incident unmarked as major incident', incident });
  } catch (error) {
    next(error);
  }
};

// POST /api/incidents/:id/children
const addChild = async (req, res, next) => {
  try {
    const { childIncidentId } = req.body;
    const result = await incidentGroupingService.addChildIncident(
      req.params.id,
      childIncidentId,
      req.user
    );
    res.status(201).json({ message: 'Child incident added successfully', ...result });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/incidents/:id/children/:childId
const removeChild = async (req, res, next) => {
  try {
    await incidentGroupingService.removeChildIncident(
      req.params.id,
      req.params.childId,
      req.user
    );
    res.status(200).json({ message: 'Child incident removed successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/incidents/:id/group
const getGroup = async (req, res, next) => {
  try {
    const group = await incidentGroupingService.getIncidentGroup(req.params.id);
    res.status(200).json(group);
  } catch (error) {
    next(error);
  }
};

// GET /api/incidents/major-incidents-overview
const getMajorIncidentsOverview = async (req, res, next) => {
  try {
    const overview = await incidentGroupingService.getMajorIncidentsOverview(req.user);
    res.status(200).json(overview);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markAsMajorIncident,
  unmarkAsMajorIncident,
  addChild,
  removeChild,
  getGroup,
  getMajorIncidentsOverview,
};