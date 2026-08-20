const {
  createIncident,
  getIncidents,
  getIncidentAll,
  getIncidentById,
  assignIncident,
  reassignWithinTeam,
  getTeamMembers,
  updateIncidentStatus,
  exportIncidentsToCSV,
  escalateOverdueIncidents,
} = require('../../services/incidentService');

const Incident = require('../../models/Incident');
const Attachment = require('../../models/Attachment');
const User = require('../../models/User');
const calculateSLA = require('../../utils/calculateSLA');
const logActivity = require('../../utils/activityLogger');
const { sendNotification } = require('../../services/notificationService');
const mongoose = require('mongoose');

// Mocks
jest.mock('../../models/Incident');
jest.mock('../../models/Attachment');
jest.mock('../../models/User');
jest.mock('../../utils/calculateSLA');
jest.mock('../../utils/activityLogger');
jest.mock('../../services/notificationService');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('incidentService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. createIncident ---
  describe('createIncident', () => {
    test('should create incident without file attachment', async () => {
      const mockDueDate = new Date('2026-08-15');
      calculateSLA.mockResolvedValue(mockDueDate);

      const mockUser = { _id: 'user_1' };
      const input = {
        title: 'Network Down',
        description: 'Internet issue',
        category: 'Network',
        priority: 'High',
        user: mockUser,
      };

      const mockCreatedIncident = { _id: 'inc_1', ...input, dueBy: mockDueDate };
      Incident.create.mockResolvedValue(mockCreatedIncident);

      const result = await createIncident(input);

      expect(calculateSLA).toHaveBeenCalledWith('High');
      expect(Incident.create).toHaveBeenCalledWith({
        title: 'Network Down',
        description: 'Internet issue',
        category: 'Network',
        priority: 'High',
        reportedBy: 'user_1',
        dueBy: mockDueDate,
      });
      expect(Attachment.create).not.toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith({
        incidentId: 'inc_1',
        action: 'Incident Created',
        performedBy: 'user_1',
      });
      expect(result).toEqual(mockCreatedIncident);
    });

    test('should create incident with agent assigned and file attachment', async () => {
      const mockDueDate = new Date('2026-08-15');
      calculateSLA.mockResolvedValue(mockDueDate);

      const mockUser = { id: 'user_2' };
      const mockFile = { originalname: 'logs.txt', path: '/uploads/logs.txt' };
      const input = {
        title: 'Bug in portal',
        description: 'Error 500',
        assignedTo: 'agent_1',
        user: mockUser,
        file: mockFile,
      };

      const mockCreatedIncident = { _id: 'inc_2', ...input };
      Incident.create.mockResolvedValue(mockCreatedIncident);
      Attachment.create.mockResolvedValue({});

      await createIncident(input);

      expect(Incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'Medium', // default fallback
          assignedTo: 'agent_1',
          status: 'In Progress',
        })
      );
      expect(Attachment.create).toHaveBeenCalledWith({
        incidentId: 'inc_2',
        fileName: 'logs.txt',
        filePath: '/uploads/logs.txt',
        uploadedBy: 'user_2',
      });
      expect(logActivity).toHaveBeenCalledWith({
        incidentId: 'inc_2',
        action: 'Incident Created & Agent Assigned',
        performedBy: 'user_2',
      });
    });
  });

  // --- 2. getIncidents ---
  describe('getIncidents', () => {
    const buildQueryMock = (result) => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(result),
      };
      return mockQuery;
    };

    test('should apply reportedBy filter for End User', async () => {
      const mockUser = { role: 'End User', _id: 'user_1' };
      const query = { status: 'New', search: 'printer' };
      const mockQuery = buildQueryMock([{ _id: 'inc_1' }]);
      Incident.find.mockReturnValue(mockQuery);

      await getIncidents(mockUser, query);

      expect(Incident.find).toHaveBeenCalledWith({
        reportedBy: 'user_1',
        status: 'New',
        $or: [
          { title: { $regex: 'printer', $options: 'i' } },
          { description: { $regex: 'printer', $options: 'i' } },
        ],
      });
    });

    test('should restrict Support Agent to assigned tickets by default', async () => {
      const mockUser = { role: 'Support Agent', _id: 'agent_1' };
      const mockQuery = buildQueryMock([]);
      Incident.find.mockReturnValue(mockQuery);

      await getIncidents(mockUser, {});

      expect(Incident.find).toHaveBeenCalledWith({ assignedTo: 'agent_1' });
    });

    test('should allow Support Agent to view all tickets when scope=all', async () => {
      const mockUser = { role: 'Support Agent', _id: 'agent_1' };
      const mockQuery = buildQueryMock([]);
      Incident.find.mockReturnValue(mockQuery);

      await getIncidents(mockUser, { scope: 'all' });

      expect(Incident.find).toHaveBeenCalledWith({});
    });
  });

  // --- 3. getIncidentAll ---
  describe('getIncidentAll', () => {
    test('should return sorted incidents with populated references', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([{ _id: 'inc_1' }]),
      };
      Incident.find.mockReturnValue(mockQuery);

      const result = await getIncidentAll();
      expect(Incident.find).toHaveBeenCalled();
      expect(result).toEqual([{ _id: 'inc_1' }]);
    });
  });

  // --- 4. getIncidentById ---
  describe('getIncidentById', () => {
    const validObjectId = new mongoose.Types.ObjectId().toString();

    test('should throw 400 for invalid ObjectId format', async () => {
      await expect(getIncidentById('invalid-id', { role: 'Admin' })).rejects.toMatchObject({
        message: 'Invalid Incident ID format',
        statusCode: 400,
      });
    });

    test('should throw 404 if incident is not found', async () => {
      const mockQuery = { populate: jest.fn().mockReturnThis() };
      mockQuery.populate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });
      Incident.findById.mockReturnValue(mockQuery);

      await expect(getIncidentById(validObjectId, { role: 'Admin' })).rejects.toMatchObject({
        message: 'Incident not found',
        statusCode: 404,
      });
    });

    test('should throw 403 if End User tries to view another user incident', async () => {
      const mockIncident = {
        _id: validObjectId,
        reportedBy: { _id: new mongoose.Types.ObjectId().toString() },
      };

      const mockQuery = { populate: jest.fn().mockReturnThis() };
      mockQuery.populate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockIncident),
        }),
      });
      Incident.findById.mockReturnValue(mockQuery);

      const mockUser = { _id: new mongoose.Types.ObjectId().toString(), role: 'End User' };

      await expect(getIncidentById(validObjectId, mockUser)).rejects.toMatchObject({
        message: 'Not authorized to view this incident',
        statusCode: 403,
      });
    });

    test('should return incident for authorized Admin', async () => {
      const mockIncident = { _id: validObjectId, title: 'Server Down' };

      const mockQuery = { populate: jest.fn().mockReturnThis() };
      mockQuery.populate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockIncident),
        }),
      });
      Incident.findById.mockReturnValue(mockQuery);

      const mockUser = { _id: new mongoose.Types.ObjectId().toString(), role: 'Admin' };

      const result = await getIncidentById(validObjectId, mockUser);
      expect(result).toEqual(mockIncident);
    });
  });

  // --- 5. assignIncident ---
  describe('assignIncident', () => {
    const validIncId = new mongoose.Types.ObjectId().toString();
    const validAgentId = new mongoose.Types.ObjectId().toString();

    test('should throw 404 if incident missing', async () => {
      Incident.findById.mockResolvedValue(null);
      await expect(assignIncident(validIncId, validAgentId, 'admin_1')).rejects.toMatchObject({
        message: 'Incident not found',
        statusCode: 404,
      });
    });

    test('should throw 400 if assigned user is not an Agent or Admin', async () => {
      Incident.findById.mockResolvedValue({ _id: validIncId });
      User.findById.mockResolvedValue({ _id: validAgentId, role: 'End User' });

      await expect(assignIncident(validIncId, validAgentId, 'admin_1')).rejects.toMatchObject({
        message: 'Selected user is not authorized as a Support Agent or Admin',
        statusCode: 400,
      });
    });

    test('should assign agent, update status, log activity, and send email', async () => {
      const mockIncident = {
        _id: validIncId,
        title: 'Fix Login',
        priority: 'High',
        status: 'New',
        dueBy: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };
      Incident.findById.mockResolvedValueOnce(mockIncident);

      const mockAgent = {
        _id: validAgentId,
        name: 'Agent Smith',
        email: 'smith@example.com',
        role: 'Support Agent',
      };
      User.findById.mockResolvedValue(mockAgent);

      const mockPopulatedQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockPopulatedQuery.populate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({ ...mockIncident, assignedTo: mockAgent }),
        }),
      });
      Incident.findById.mockReturnValueOnce(mockPopulatedQuery);

      const result = await assignIncident(validIncId, validAgentId, 'admin_1');

      expect(mockIncident.assignedTo).toBe(validAgentId);
      expect(mockIncident.status).toBe('In Progress');
      expect(mockIncident.save).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith({
        incidentId: validIncId,
        action: 'Agent Assigned',
        performedBy: 'admin_1',
        newValue: 'Agent Smith',
      });
      expect(sendNotification).toHaveBeenCalled();
      expect(result.assignedTo).toEqual(mockAgent);
    });
  });

  // --- 6. reassignWithinTeam ---
  describe('reassignWithinTeam', () => {
    const incId = new mongoose.Types.ObjectId().toString();
    const targetId = new mongoose.Types.ObjectId().toString();

    test('should throw 400 for invalid ticket status', async () => {
      User.findById.mockResolvedValue({ _id: targetId, role: 'Support Agent' });
      Incident.findById.mockResolvedValue({ _id: incId, status: 'Resolved' });

      const currentUser = { role: 'Support Agent', team: 'L1' };

      await expect(reassignWithinTeam(incId, targetId, currentUser)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    test('should throw 403 if Support Agent reassigns outside their team', async () => {
      User.findById.mockResolvedValue({ _id: targetId, role: 'Support Agent', team: 'L2' });
      Incident.findById.mockResolvedValue({ _id: incId, status: 'In Progress' });

      const currentUser = { role: 'Support Agent', team: 'L1' };

      await expect(reassignWithinTeam(incId, targetId, currentUser)).rejects.toMatchObject({
        message: 'You can only reassign tickets to agents within your team (L1).',
        statusCode: 403,
      });
    });
  });

  // --- 7. getTeamMembers ---
  describe('getTeamMembers', () => {
    test('should query agents matching the team excluding current user', async () => {
      const mockUser = { _id: 'agent_1', id: 'agent_1', role: 'Support Agent', team: 'Tech' };
      const mockQuery = { select: jest.fn().mockResolvedValue([{ name: 'Agent 2' }]) };
      User.find.mockReturnValue(mockQuery);

      const members = await getTeamMembers(mockUser);

      expect(User.find).toHaveBeenCalledWith({
        role: 'Support Agent',
        _id: { $ne: 'agent_1' },
        team: 'Tech',
      });
      expect(members).toEqual([{ name: 'Agent 2' }]);
    });
  });

  // --- 8. updateIncidentStatus ---
  describe('updateIncidentStatus', () => {
    const incId = new mongoose.Types.ObjectId().toString();

    test('should throw 400 for unallowed status string', async () => {
      Incident.findById.mockResolvedValue({ _id: incId });
      await expect(updateIncidentStatus(incId, 'InvalidStatus', 'user_1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    test('should update status, log activity, and notify reporter', async () => {
      const mockIncident = {
        _id: incId,
        title: 'Network Lag',
        status: 'In Progress',
        reportedBy: { name: 'John', email: 'john@example.com' },
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      Incident.findById.mockResolvedValue(mockIncident);

      await updateIncidentStatus(incId, 'Resolved', 'agent_1');

      expect(mockIncident.status).toBe('Resolved');
      expect(mockIncident.save).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith({
        incidentId: incId,
        action: 'Status Updated',
        performedBy: 'agent_1',
        oldValue: 'In Progress',
        newValue: 'Resolved',
      });
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipientEmail: 'john@example.com' })
      );
    });
  });

  // --- 9. exportIncidentsToCSV ---
  describe('exportIncidentsToCSV', () => {
    test('should return default header CSV when no incidents exist', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      };
      Incident.find.mockReturnValue(mockQuery);

      const csv = await exportIncidentsToCSV({ role: 'Admin' }, {});
      expect(csv).toBe(
        'Incident ID,Title,Category,Priority,Status,Reported By (Name),Reported By (Email),Assigned Agent,SLA Due Date,Created At\n'
      );
    });
  });

  // --- 10. escalateOverdueIncidents ---
  describe('escalateOverdueIncidents', () => {
    test('should notify assignees and admins for overdue incidents', async () => {
      const mockOverdueIncident = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Database Outage',
        priority: 'Critical',
        status: 'In Progress',
        dueBy: new Date('2026-01-01'),
        assignedTo: { name: 'Bob', email: 'bob@example.com' },
        reportedBy: { name: 'Alice', email: 'alice@example.com' },
        save: jest.fn().mockResolvedValue(true),
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockQuery.populate.mockReturnValue({
        populate: jest.fn().mockResolvedValue([mockOverdueIncident]),
      });

      Incident.find.mockReturnValue(mockQuery);

      const mockUserSelect = {
        select: jest.fn().mockResolvedValue([{ name: 'Admin User', email: 'admin@example.com' }]),
      };
      User.find.mockReturnValue(mockUserSelect);

      sendNotification.mockResolvedValue({});

      const result = await escalateOverdueIncidents();

      expect(result).toEqual({ escalatedCount: 1 });
      expect(mockOverdueIncident.isEscalated).toBe(true);
      expect(mockOverdueIncident.save).toHaveBeenCalled();
      expect(sendNotification).toHaveBeenCalledTimes(2); // 1 for agent + 1 for admin
      expect(logActivity).toHaveBeenCalledWith({
        incidentId: mockOverdueIncident._id,
        action: 'Incident Escalated (SLA Breach)',
        performedBy: null,
        newValue: 'Escalated',
      });
    });
  });
});