const mongoose = require('mongoose');
const { getActivityLogsByIncidentId } = require('../../services/activityService');
const Activity = require('../../models/ActivityLog');
const Incident = require('../../models/Incident');

// Mock Models
jest.mock('../../models/ActivityLog');
jest.mock('../../models/Incident');
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
}));

describe('activityService - getActivityLogsByIncidentId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should throw a 400 error if incidentId format is invalid', async () => {
    const invalidId = '123-invalid-id';

    await expect(getActivityLogsByIncidentId(invalidId)).rejects.toMatchObject({
      message: 'Invalid Incident ID format',
      statusCode: 400,
    });
  });

  test('should throw a 404 error if incident is not found', async () => {
    const validId = new mongoose.Types.ObjectId().toString();

    // Mock Incident.findById to return null
    Incident.findById.mockResolvedValue(null);

    await expect(getActivityLogsByIncidentId(validId)).rejects.toMatchObject({
      message: 'Incident not found',
      statusCode: 404,
    });

    expect(Incident.findById).toHaveBeenCalledWith(validId);
  });

  test('should return activity logs sorted by createdAt descending when incident exists', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    const fakeIncident = { _id: validId, title: 'Server Down' };
    const fakeLogs = [
      { action: 'CREATED', createdAt: new Date() },
      { action: 'UPDATED', createdAt: new Date() },
    ];

    // Mock Incident.findById
    Incident.findById.mockResolvedValue(fakeIncident);

    // Mock Activity.find chain (.populate().sort())
    const mockSort = jest.fn().mockResolvedValue(fakeLogs);
    const mockPopulate = jest.fn().mockReturnValue({ sort: mockSort });
    Activity.find.mockReturnValue({ populate: mockPopulate });

    const result = await getActivityLogsByIncidentId(validId);

    expect(Incident.findById).toHaveBeenCalledWith(validId);
    expect(Activity.find).toHaveBeenCalledWith({ incidentId: validId });
    expect(mockPopulate).toHaveBeenCalledWith('performedBy', 'name email role');
    expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(result).toEqual(fakeLogs);
  });
});