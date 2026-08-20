// backend/tests/incidentStatus.test.js

const { updateIncidentStatus } = require('../services/incidentService');
const Incident = require('../models/Incident');
const logActivity = require('../utils/activityLogger');
const { sendNotification } = require('../services/notificationService');

// Mock everything external — we only want to test updateIncidentStatus's OWN logic
jest.mock('../models/Incident');
jest.mock('../utils/activityLogger');
jest.mock('../services/notificationService');
jest.mock('../utils/logger');

describe('updateIncidentStatus', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should throw error if incident does not exist', async () => {
    Incident.findById.mockResolvedValue(null);

    await expect(
      updateIncidentStatus('fake_id', 'In Progress', 'user_1')
    ).rejects.toThrow('Incident not found');
  });

  test('should throw error if status is not a valid allowed status', async () => {
    const fakeIncident = {
      _id: 'incident_1',
      status: 'New',
      save: jest.fn(),
      populate: jest.fn(),
    };
    Incident.findById.mockResolvedValue(fakeIncident);

    await expect(
      updateIncidentStatus('incident_1', 'InvalidStatus', 'user_1')
    ).rejects.toThrow('Invalid status. Must be one of: New, In Progress, On Hold, Resolved, Closed');
  });

  test('should successfully update status from New to In Progress', async () => {
    const fakeIncident = {
      _id: 'incident_1',
      title: 'Database issue',
      status: 'New',
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockResolvedValue(true),
      reportedBy: { name: 'John Doe', email: 'john@test.com' },
    };
    Incident.findById.mockResolvedValue(fakeIncident);

    const result = await updateIncidentStatus('incident_1', 'In Progress', 'user_1');

    // Status should actually be changed on the object
    expect(fakeIncident.status).toBe('In Progress');

    // save() should have been called to persist the change
    expect(fakeIncident.save).toHaveBeenCalled();

    // Activity log should record old and new status
    expect(logActivity).toHaveBeenCalledWith({
      incidentId: 'incident_1',
      action: 'Status Updated',
      performedBy: 'user_1',
      oldValue: 'New',
      newValue: 'In Progress',
    });

    // Email notification should be sent to reporter
    expect(sendNotification).toHaveBeenCalled();

    expect(result).toBe(fakeIncident);
  });

  test('should update status to Resolved', async () => {
    const fakeIncident = {
      _id: 'incident_2',
      title: 'VM issue',
      status: 'In Progress',
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockResolvedValue(true),
      reportedBy: { name: 'Jane Doe', email: 'jane@test.com' },
    };
    Incident.findById.mockResolvedValue(fakeIncident);

    await updateIncidentStatus('incident_2', 'Resolved', 'user_2');

    expect(fakeIncident.status).toBe('Resolved');
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValue: 'In Progress',
        newValue: 'Resolved',
      })
    );
  });

  test('should not send email if reporter has no email', async () => {
    const fakeIncident = {
      _id: 'incident_3',
      title: 'No email test',
      status: 'On Hold',
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockResolvedValue(true),
      reportedBy: null, // no reporter info
    };
    Incident.findById.mockResolvedValue(fakeIncident);

    await updateIncidentStatus('incident_3', 'Closed', 'user_3');

    expect(sendNotification).not.toHaveBeenCalled();
  });

});