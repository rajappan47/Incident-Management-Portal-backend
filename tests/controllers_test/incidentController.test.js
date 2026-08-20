const {
  createIncident,
  getIncidents,
  getIncidentAll,
  getIncidentById,
  assignIncident,
  reassignIncident,
  getTeamMembers,
  updateStatus,
  exportCSV,
  getActiveIncidentsPrioritySorted,
  getClosedIncidents,
  getAgentsByCategory,
  updateSubUserPermissions,
} = require('../../controllers/incidentController');

const incidentService = require('../../services/incidentService');
const User = require('../../models/User');
const Incident = require('../../models/Incident');

// Mocks
jest.mock('../../services/incidentService');
jest.mock('../../models/User');
jest.mock('../../models/Incident');
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

describe('incidentController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      params: {},
      query: {},
      user: {
        _id: 'user_admin_123',
        role: 'Admin',
      },
      file: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  // --- 1. createIncident ---
  describe('createIncident', () => {
    test('should return 201 and created incident', async () => {
      req.body = {
        title: 'System Crash',
        description: 'Server unavailable',
        category: 'Hardware',
        priority: 'High',
        assignedTo: 'agent_1',
      };
      req.file = { filename: 'logs.txt' };

      const mockIncident = { _id: 'inc_101', title: 'System Crash' };
      incidentService.createIncident.mockResolvedValue(mockIncident);

      await createIncident(req, res, next);

      expect(incidentService.createIncident).toHaveBeenCalledWith({
        title: 'System Crash',
        description: 'Server unavailable',
        category: 'Hardware',
        priority: 'High',
        assignedTo: 'agent_1',
        user: req.user,
        file: req.file,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Incident created successfully',
        incident: mockIncident,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware when creation fails', async () => {
      const mockError = new Error('Category is required');
      incidentService.createIncident.mockRejectedValue(mockError);

      await createIncident(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // --- 2. getIncidents ---
  describe('getIncidents', () => {
    test('should return 200 and filtered incidents list', async () => {
      req.query = { priority: 'High' };
      const mockIncidents = [{ _id: 'inc_101' }];
      incidentService.getIncidents.mockResolvedValue(mockIncidents);

      await getIncidents(req, res, next);

      expect(incidentService.getIncidents).toHaveBeenCalledWith(req.user, req.query);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockIncidents);
    });

    test('should pass error to next middleware on error', async () => {
      const mockError = new Error('Fetch failed');
      incidentService.getIncidents.mockRejectedValue(mockError);

      await getIncidents(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });

  // --- 3. getIncidentAll ---
  describe('getIncidentAll', () => {
    test('should return 200 and all incidents', async () => {
      const mockIncidents = [{ _id: 'inc_101' }, { _id: 'inc_102' }];
      incidentService.getIncidentAll.mockResolvedValue(mockIncidents);

      await getIncidentAll(req, res, next);

      expect(incidentService.getIncidentAll).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockIncidents);
    });

    test('should pass error to next middleware on failure', async () => {
      const mockError = new Error('Database Error');
      incidentService.getIncidentAll.mockRejectedValue(mockError);

      await getIncidentAll(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });

  // --- 4. getIncidentById ---
  describe('getIncidentById', () => {
    test('should return 200 and single incident details', async () => {
      req.params = { id: 'inc_101' };
      const mockIncident = { _id: 'inc_101', title: 'Test Incident' };
      incidentService.getIncidentById.mockResolvedValue(mockIncident);

      await getIncidentById(req, res, next);

      expect(incidentService.getIncidentById).toHaveBeenCalledWith('inc_101', req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockIncident);
    });

    test('should pass error to next middleware if incident is not found', async () => {
      req.params = { id: 'invalid_id' };
      const mockError = new Error('Incident not found');
      incidentService.getIncidentById.mockRejectedValue(mockError);

      await getIncidentById(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });

  // --- 5. assignIncident ---
  describe('assignIncident', () => {
    test('should return 200 with assign message when agentId is present', async () => {
      req.params = { id: 'inc_101' };
      req.body = { agentId: 'agent_99' };
      const mockUpdated = { _id: 'inc_101', assignedTo: 'agent_99' };

      incidentService.assignIncident.mockResolvedValue(mockUpdated);

      await assignIncident(req, res, next);

      expect(incidentService.assignIncident).toHaveBeenCalledWith('inc_101', 'agent_99', 'user_admin_123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Incident assigned successfully',
        incident: mockUpdated,
      });
    });

    test('should return 200 with unassign message when agentId is null', async () => {
      req.params = { id: 'inc_101' };
      req.body = { agentId: null };
      const mockUpdated = { _id: 'inc_101', assignedTo: null };

      incidentService.assignIncident.mockResolvedValue(mockUpdated);

      await assignIncident(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Incident unassigned successfully',
        incident: mockUpdated,
      });
    });
  });

  // --- 6. reassignIncident ---
  describe('reassignIncident', () => {
    test('should return 200 and reassigned incident when targetAgentId is provided', async () => {
      req.params = { id: 'inc_101' };
      req.body = { targetAgentId: 'agent_88' };
      const mockUpdated = { _id: 'inc_101', assignedTo: 'agent_88' };

      incidentService.reassignWithinTeam.mockResolvedValue(mockUpdated);

      await reassignIncident(req, res, next);

      expect(incidentService.reassignWithinTeam).toHaveBeenCalledWith('inc_101', 'agent_88', req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Incident reassigned successfully within team',
        incident: mockUpdated,
      });
    });

    test('should throw 400 error if targetAgentId is missing', async () => {
      req.params = { id: 'inc_101' };
      req.body = {};

      await reassignIncident(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Target agent ID is required',
        statusCode: 400,
      }));
    });
  });

  // --- 7. getTeamMembers ---
  describe('getTeamMembers', () => {
    test('should return 200 and team members list', async () => {
      const mockMembers = [{ _id: 'agent_1', name: 'Alice' }];
      incidentService.getTeamMembers.mockResolvedValue(mockMembers);

      await getTeamMembers(req, res, next);

      expect(incidentService.getTeamMembers).toHaveBeenCalledWith(req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockMembers);
    });
  });

  // --- 8. updateStatus ---
  describe('updateStatus', () => {
    test('should return 200 and updated incident on valid status', async () => {
      req.params = { id: 'inc_101' };
      req.body = { status: 'Resolved' };
      const mockUpdated = { _id: 'inc_101', status: 'Resolved' };

      incidentService.updateIncidentStatus.mockResolvedValue(mockUpdated);

      await updateStatus(req, res, next);

      expect(incidentService.updateIncidentStatus).toHaveBeenCalledWith('inc_101', 'Resolved', 'user_admin_123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Status updated successfully',
        incident: mockUpdated,
      });
    });

    test('should throw 400 error if status is missing', async () => {
      req.params = { id: 'inc_101' };
      req.body = {};

      await updateStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Status is required',
        statusCode: 400,
      }));
    });
  });

  // --- 9. exportCSV ---
  describe('exportCSV', () => {
    test('should set headers and return CSV string on success', async () => {
      req.query = { status: 'Open' };
      const mockCsv = 'id,title,status\ninc_101,Bug,Open';

      incidentService.exportIncidentsToCSV.mockResolvedValue(mockCsv);

      await exportCSV(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="incidents_Admin_')
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockCsv);
    });
  });

  // --- 10. getActiveIncidentsPrioritySorted ---
  describe('getActiveIncidentsPrioritySorted', () => {
    test('should perform aggregation and return priority sorted active incidents', async () => {
      const mockAggregatedData = [
        { _id: 'inc_1', priority: 'Critical', priorityOrder: 1 },
        { _id: 'inc_2', priority: 'High', priorityOrder: 2 },
      ];

      Incident.aggregate.mockResolvedValue(mockAggregatedData);

      await getActiveIncidentsPrioritySorted(req, res, next);

      expect(Incident.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockAggregatedData);
    });

    test('should pass aggregation errors to next', async () => {
      const mockError = new Error('Aggregation Pipeline Error');
      Incident.aggregate.mockRejectedValue(mockError);

      await getActiveIncidentsPrioritySorted(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });

  // --- 11. getClosedIncidents ---
  describe('getClosedIncidents', () => {
    test('should return 200 and list of closed or resolved incidents', async () => {
      const mockClosedIncidents = [{ _id: 'inc_99', status: 'Closed' }];

      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockClosedIncidents),
      };

      Incident.find.mockReturnValue(mockQueryChain);

      await getClosedIncidents(req, res, next);

      expect(Incident.find).toHaveBeenCalledWith({
        status: { $in: ['Closed', 'Resolved'] },
      });
      expect(mockQueryChain.populate).toHaveBeenCalledWith('reportedBy', 'name email');
      expect(mockQueryChain.sort).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockClosedIncidents);
    });
  });

  // --- 12. getAgentsByCategory ---
  describe('getAgentsByCategory', () => {
    test('should filter support agents by category when query params are passed', async () => {
      req.query = { categoryId: 'cat_hardware' };
      const mockAgents = [{ _id: 'agent_1', name: 'Bob' }];

      const mockQueryChain = {
        select: jest.fn().mockResolvedValue(mockAgents),
      };

      User.find.mockReturnValue(mockQueryChain);

      await getAgentsByCategory(req, res, next);

      expect(User.find).toHaveBeenCalledWith({
        role: 'Support Agent',
        categories: { $in: ['cat_hardware', undefined] },
      });
      expect(mockQueryChain.select).toHaveBeenCalledWith('_id name email team categories');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockAgents);
    });
  });

  // --- 13. updateSubUserPermissions ---
  describe('updateSubUserPermissions', () => {
    test('should update permissions for valid sub-user and return updated permissions', async () => {
      req.params = { subUserId: 'sub_123' };
      req.body = { permissions: ['tickets:create', 'tickets:view'] };

      const mockSubUser = {
        _id: 'sub_123',
        parentUser: 'user_admin_123',
        permissions: [],
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockSubUser);

      await updateSubUserPermissions(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({
        _id: 'sub_123',
        parentUser: 'user_admin_123',
      });
      expect(mockSubUser.permissions).toEqual(['tickets:create', 'tickets:view']);
      expect(mockSubUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Permissions updated successfully',
        permissions: ['tickets:create', 'tickets:view'],
      });
    });

    test('should throw 404 error if sub-user is not found or unauthorized', async () => {
      req.params = { subUserId: 'invalid_sub' };
      req.body = { permissions: ['tickets:create'] };

      User.findOne.mockResolvedValue(null);

      await updateSubUserPermissions(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Sub-user not found or unauthorized',
        statusCode: 404,
      }));
    });
  });
});