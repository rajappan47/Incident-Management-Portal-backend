const mongoose = require('mongoose');
const {
  addComment,
  getIncidentTimeline,
  getCommentsByIncidentId,
} = require('../../services/commentService');
const Comment = require('../../models/Comment');
const ActivityLog = require('../../models/ActivityLog');
const Incident = require('../../models/Incident');

// Mocks
jest.mock('../../models/Comment');
jest.mock('../../models/ActivityLog');
jest.mock('../../models/Incident');
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
}));

describe('commentService Test Suite', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // ADD COMMENT
  // ==========================================
  describe('addComment', () => {
    test('should throw 400 error for invalid incident ID format', async () => {
      await expect(
        addComment({ incidentId: 'invalid_id', userId: 'user_1', message: 'Test' })
      ).rejects.toMatchObject({
        message: 'Invalid Incident ID format',
        statusCode: 400,
      });
    });

    test('should throw 404 error if incident is not found', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      Incident.findById.mockResolvedValue(null);

      await expect(
        addComment({ incidentId: validId, userId: 'user_1', message: 'Test' })
      ).rejects.toMatchObject({
        message: 'Incident not found',
        statusCode: 404,
      });
    });

    test('should add comment and populate author details successfully', async () => {
      const validIncidentId = new mongoose.Types.ObjectId().toString();
      const fakeIncident = { _id: validIncidentId };
      
      const mockPopulate = jest.fn().mockResolvedValue({
        _id: 'comment_123',
        incidentId: validIncidentId,
        authorId: { _id: 'user_1', name: 'John Doe', email: 'john@example.com', role: 'Support Agent' },
        message: 'Investigating issue',
        isInternal: false,
      });

      const fakeCommentInstance = {
        populate: mockPopulate,
      };

      Incident.findById.mockResolvedValue(fakeIncident);
      Comment.create.mockResolvedValue(fakeCommentInstance);

      const result = await addComment({
        incidentId: validIncidentId,
        userId: 'user_1',
        message: 'Investigating issue',
        isInternal: false,
      });

      expect(Incident.findById).toHaveBeenCalledWith(validIncidentId);
      expect(Comment.create).toHaveBeenCalledWith({
        incidentId: validIncidentId,
        authorId: 'user_1',
        message: 'Investigating issue',
        isInternal: false,
      });
      expect(mockPopulate).toHaveBeenCalledWith('authorId', 'name email role');
      expect(result.authorId.name).toBe('John Doe');
    });
  });

  // ==========================================
  // GET INCIDENT TIMELINE
  // ==========================================
  describe('getIncidentTimeline', () => {
    test('should throw 400 error for invalid incident ID format', async () => {
      await expect(
        getIncidentTimeline('invalid_id', 'Admin')
      ).rejects.toMatchObject({
        message: 'Invalid Incident ID format',
        statusCode: 400,
      });
    });

    test('should exclude internal comments when requested by an End User', async () => {
      const validIncidentId = new mongoose.Types.ObjectId().toString();
      const fakeComments = [{ message: 'Public comment' }];
      const fakeActivities = [{ action: 'STATUS_UPDATED' }];

      // Mock Comment chain
      const mockCommentSort = jest.fn().mockResolvedValue(fakeComments);
      const mockCommentPopulate = jest.fn().mockReturnValue({ sort: mockCommentSort });
      Comment.find.mockReturnValue({ populate: mockCommentPopulate });

      // Mock ActivityLog chain
      const mockActivitySort = jest.fn().mockResolvedValue(fakeActivities);
      const mockActivityPopulate = jest.fn().mockReturnValue({ sort: mockActivitySort });
      ActivityLog.find.mockReturnValue({ populate: mockActivityPopulate });

      const result = await getIncidentTimeline(validIncidentId, 'End User');

      expect(Comment.find).toHaveBeenCalledWith({ incidentId: validIncidentId, isInternal: false });
      expect(ActivityLog.find).toHaveBeenCalledWith({ incidentId: validIncidentId });
      expect(result).toEqual({ comments: fakeComments, activities: fakeActivities });
    });

    test('should include internal comments when requested by Support / Admin role', async () => {
      const validIncidentId = new mongoose.Types.ObjectId().toString();
      const fakeComments = [{ message: 'Public comment' }, { message: 'Internal note', isInternal: true }];
      const fakeActivities = [{ action: 'STATUS_UPDATED' }];

      // Mock Comment chain
      const mockCommentSort = jest.fn().mockResolvedValue(fakeComments);
      const mockCommentPopulate = jest.fn().mockReturnValue({ sort: mockCommentSort });
      Comment.find.mockReturnValue({ populate: mockCommentPopulate });

      // Mock ActivityLog chain
      const mockActivitySort = jest.fn().mockResolvedValue(fakeActivities);
      const mockActivityPopulate = jest.fn().mockReturnValue({ sort: mockActivitySort });
      ActivityLog.find.mockReturnValue({ populate: mockActivityPopulate });

      const result = await getIncidentTimeline(validIncidentId, 'Admin');

      expect(Comment.find).toHaveBeenCalledWith({ incidentId: validIncidentId });
      expect(result.comments.length).toBe(2);
    });
  });

  // ==========================================
  // GET COMMENTS BY INCIDENT ID
  // ==========================================
  describe('getCommentsByIncidentId', () => {
    test('should throw 400 error for invalid incident ID format', async () => {
      await expect(getCommentsByIncidentId('invalid_id')).rejects.toMatchObject({
        message: 'Invalid Incident ID format',
        statusCode: 400,
      });
    });

    test('should throw 404 error if incident is not found', async () => {
      const validIncidentId = new mongoose.Types.ObjectId().toString();
      Incident.findById.mockResolvedValue(null);

      await expect(getCommentsByIncidentId(validIncidentId)).rejects.toMatchObject({
        message: 'Incident not found',
        statusCode: 404,
      });
    });

    test('should return all comments populated with author info sorted by createdAt', async () => {
      const validIncidentId = new mongoose.Types.ObjectId().toString();
      const fakeIncident = { _id: validIncidentId };
      const fakeComments = [{ message: 'Comment 1' }, { message: 'Comment 2' }];

      Incident.findById.mockResolvedValue(fakeIncident);

      const mockSort = jest.fn().mockResolvedValue(fakeComments);
      const mockPopulate = jest.fn().mockReturnValue({ sort: mockSort });
      Comment.find.mockReturnValue({ populate: mockPopulate });

      const result = await getCommentsByIncidentId(validIncidentId);

      expect(Incident.findById).toHaveBeenCalledWith(validIncidentId);
      expect(Comment.find).toHaveBeenCalledWith({ incidentId: validIncidentId });
      expect(mockPopulate).toHaveBeenCalledWith('authorId', 'name email role');
      expect(mockSort).toHaveBeenCalledWith({ createdAt: 1 });
      expect(result).toEqual(fakeComments);
    });
  });
});