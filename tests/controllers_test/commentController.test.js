const {
  addComment,
  getTimeline,
  getIncidentComments,
} = require('../../controllers/commentController');
const commentService = require('../../services/commentService');
const createCustomError = require('../../utils/customError');

// Mocks
jest.mock('../../services/commentService');
jest.mock('../../utils/customError', () => jest.fn((msg, status) => {
  const err = new Error(msg);
  err.statusCode = status;
  return err;
}));

describe('commentController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      params: {},
      user: {
        _id: 'user_123',
        role: 'Support Agent',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // --- 1. addComment ---
  describe('addComment', () => {
    test('should return 201 and created comment when valid message is provided', async () => {
      req.params = { id: 'inc_101' };
      req.body = { message: 'We are investigating this issue.', isInternal: true };

      const mockCreatedComment = {
        _id: 'com_1',
        incidentId: 'inc_101',
        userId: 'user_123',
        message: 'We are investigating this issue.',
        isInternal: true,
      };

      commentService.addComment.mockResolvedValue(mockCreatedComment);

      await addComment(req, res, next);

      expect(commentService.addComment).toHaveBeenCalledWith({
        incidentId: 'inc_101',
        userId: 'user_123',
        message: 'We are investigating this issue.',
        isInternal: true,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Comment added successfully',
        comment: mockCreatedComment,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should force isInternal to false if the user role is "End User"', async () => {
      req.params = { id: 'inc_101' };
      req.user = { _id: 'user_456', role: 'End User' };
      req.body = { message: 'Any updates?', isInternal: true }; // Attempting true

      commentService.addComment.mockResolvedValue({
        _id: 'com_2',
        message: 'Any updates?',
        isInternal: false,
      });

      await addComment(req, res, next);

      expect(commentService.addComment).toHaveBeenCalledWith({
        incidentId: 'inc_101',
        userId: 'user_456',
        message: 'Any updates?',
        isInternal: false, // Overridden by controller logic
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('should throw a custom 400 error and pass to next if message is missing', async () => {
      req.params = { id: 'inc_101' };
      req.body = { message: '' }; // Empty message

      await addComment(req, res, next);

      expect(createCustomError).toHaveBeenCalledWith('Comment message is required', 400);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(commentService.addComment).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should pass service error to next middleware when service fails', async () => {
      req.params = { id: 'inc_101' };
      req.body = { message: 'Test message' };
      const mockError = new Error('Incident not found');

      commentService.addComment.mockRejectedValue(mockError);

      await addComment(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // --- 2. getTimeline ---
  describe('getTimeline', () => {
    test('should return 200 and incident timeline filtered by user role', async () => {
      req.params = { id: 'inc_101' };
      req.user = { role: 'Support Agent' };

      const mockTimeline = [
        { type: 'comment', message: 'Issue reported' },
        { type: 'status_change', from: 'Open', to: 'In Progress' },
      ];

      commentService.getIncidentTimeline.mockResolvedValue(mockTimeline);

      await getTimeline(req, res, next);

      expect(commentService.getIncidentTimeline).toHaveBeenCalledWith('inc_101', 'Support Agent');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockTimeline);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware when timeline fetch fails', async () => {
      req.params = { id: 'invalid_inc' };
      const mockError = new Error('Database query error');

      commentService.getIncidentTimeline.mockRejectedValue(mockError);

      await getTimeline(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // --- 3. getIncidentComments ---
  describe('getIncidentComments', () => {
    test('should return 200 and array of comments for given incident ID', async () => {
      req.params = { id: 'inc_101' };
      const mockComments = [
        { _id: 'com_1', message: 'Comment 1' },
        { _id: 'com_2', message: 'Comment 2' },
      ];

      commentService.getCommentsByIncidentId.mockResolvedValue(mockComments);

      await getIncidentComments(req, res, next);

      expect(commentService.getCommentsByIncidentId).toHaveBeenCalledWith('inc_101');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockComments);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware when fetching comments fails', async () => {
      req.params = { id: 'inc_101' };
      const mockError = new Error('Failed to retrieve comments');

      commentService.getCommentsByIncidentId.mockRejectedValue(mockError);

      await getIncidentComments(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});