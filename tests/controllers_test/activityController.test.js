const { getIncidentActivities } = require('../../controllers/activityController');
const activityService = require('../../services/activityService');

// Mock activityService
jest.mock('../../services/activityService');

describe('activityController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('getIncidentActivities', () => {
    test('should return 200 and list of activity logs for a valid incident ID', async () => {
      const mockActivities = [
        {
          _id: 'act_1',
          incidentId: 'inc_123',
          action: 'Incident Created',
          performedBy: 'user_1',
          createdAt: '2026-08-12T10:00:00.000Z',
        },
        {
          _id: 'act_2',
          incidentId: 'inc_123',
          action: 'Agent Assigned',
          performedBy: 'admin_1',
          createdAt: '2026-08-12T10:15:00.000Z',
        },
      ];

      req.params.id = 'inc_123';
      activityService.getActivityLogsByIncidentId.mockResolvedValue(mockActivities);

      await getIncidentActivities(req, res, next);

      expect(activityService.getActivityLogsByIncidentId).toHaveBeenCalledWith('inc_123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockActivities);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass service error to next middleware when retrieval fails', async () => {
      req.params.id = 'inc_invalid';
      const mockError = new Error('Activity logs not found');
      activityService.getActivityLogsByIncidentId.mockRejectedValue(mockError);

      await getIncidentActivities(req, res, next);

      expect(activityService.getActivityLogsByIncidentId).toHaveBeenCalledWith('inc_invalid');
      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});