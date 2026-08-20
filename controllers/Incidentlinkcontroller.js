const incidentLinkService = require('../services/incidentLinkService');

// POST /api/incidents/:id/links
const createLink = async (req, res, next) => {
  try {
    const { toIncidentId, relationshipType } = req.body;
    const link = await incidentLinkService.createLink(
      req.params.id,
      toIncidentId,
      relationshipType,
      req.user
    );
    res.status(201).json({
      message: 'Incident link created successfully',
      link,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/incidents/:id/links
const getLinks = async (req, res, next) => {
  try {
    const links = await incidentLinkService.getLinksForIncident(req.params.id);
    res.status(200).json(links);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/incidents/:id/links/:linkId
const deleteLink = async (req, res, next) => {
  try {
    await incidentLinkService.deleteLink(req.params.linkId, req.user);
    res.status(200).json({ message: 'Incident link removed successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/incidents/:id/correlation-suggestions
const getSuggestions = async (req, res, next) => {
  try {
    const result = await incidentLinkService.getCorrelationSuggestions(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLink,
  getLinks,
  deleteLink,
  getSuggestions,
};