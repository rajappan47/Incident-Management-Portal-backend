// backend/controllers/commentController.js
const commentService = require('../services/commentService');

const createCustomError = require('../utils/customError');

const addComment = async (req, res, next) => {
  try {
    const { message, isInternal } = req.body;
    const { id: incidentId } = req.params;

    if (!message) {
throw createCustomError('Comment message is required', 400);    }

    const comment = await commentService.addComment({
      incidentId,
      userId: req.user._id,
      message,
      isInternal: req.user.role === 'End User' ? false : Boolean(isInternal),
    });

    res.status(201).json({
      message: 'Comment added successfully',
      comment,
    });
  } catch (error) {
    next(error)
    // res.status(400).json({ message: error.message });
  }
};

const getTimeline = async (req, res,next) => {
  try {
    const { id: incidentId } = req.params;
    const timeline = await commentService.getIncidentTimeline(incidentId, req.user.role);

    res.status(200).json(timeline);
  } catch (error) {
    next(error)
    // res.status(400).json({ message: error.message });
  }
};

const getIncidentComments = async (req, res,next) => {
  try {
    const comments = await commentService.getCommentsByIncidentId(req.params.id);
    res.status(200).json(comments);
  } catch (error) {
    next(error)
    // res.status(400).json({ message: error.message });
  }
};

module.exports = { addComment, getTimeline, getIncidentComments };