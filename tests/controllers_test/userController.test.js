const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getAgentsByCategory,
} = require('../../controllers/userController');

const userService = require('../../services/userService');

// Mocks
jest.mock('../../services/userService');

describe('userController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      params: {},
      query: {},
      user: {
        _id: 'admin_123',
        role: 'Admin',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // --- 1. getUsers ---
  describe('getUsers', () => {
    test('should return 200 and list of users', async () => {
      req.query = { role: 'Support Agent' };
      const mockUsers = [
        { _id: 'user_1', name: 'John Doe', role: 'Support Agent' },
      ];

      userService.getAllUsers.mockResolvedValue(mockUsers);

      await getUsers(req, res, next);

      expect(userService.getAllUsers).toHaveBeenCalledWith(req.query);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUsers);
      expect(next).not.toHaveBeenCalled();
    });

    test('should forward error to next middleware when service fails', async () => {
      const mockError = new Error('Database connection failed');
      userService.getAllUsers.mockRejectedValue(mockError);

      await getUsers(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // --- 2. createUser ---
  describe('createUser', () => {
    test('should return 201 and created user object', async () => {
      req.body = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'End User',
      };
      const mockNewUser = { _id: 'user_2', ...req.body };

      userService.createUserService.mockResolvedValue(mockNewUser);

      await createUser(req, res, next);

      expect(userService.createUserService).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockNewUser);
      expect(next).not.toHaveBeenCalled();
    });

    test('should forward error to next middleware on failure', async () => {
      const mockError = new Error('User already exists');
      userService.createUserService.mockRejectedValue(mockError);

      await createUser(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });

  // --- 3. updateUser ---
  describe('updateUser', () => {
    test('should return 200 and updated user details', async () => {
      req.params = { id: 'user_2' };
      req.body = { name: 'Jane Smith' };

      const mockUpdatedUser = { _id: 'user_2', name: 'Jane Smith', role: 'End User' };
      userService.updateUserService.mockResolvedValue(mockUpdatedUser);

      await updateUser(req, res, next);

      expect(userService.updateUserService).toHaveBeenCalledWith('user_2', req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUpdatedUser);
    });

    test('should forward error to next middleware if update fails', async () => {
      req.params = { id: 'invalid_id' };
      const mockError = new Error('User not found');
      userService.updateUserService.mockRejectedValue(mockError);

      await updateUser(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });

  // --- 4. deleteUser ---
  describe('deleteUser', () => {
    test('should return 200 and success message when user is deleted', async () => {
      req.params = { id: 'user_2' };
      const mockResult = { message: 'User deleted successfully' };

      userService.deleteUserService.mockResolvedValue(mockResult);

      await deleteUser(req, res, next);

      expect(userService.deleteUserService).toHaveBeenCalledWith('user_2', 'admin_123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle null req.user gracefully and pass null as admin ID', async () => {
      req.params = { id: 'user_2' };
      req.user = null;
      const mockResult = { message: 'User deleted successfully' };

      userService.deleteUserService.mockResolvedValue(mockResult);

      await deleteUser(req, res, next);

      expect(userService.deleteUserService).toHaveBeenCalledWith('user_2', null);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should forward error to next middleware when self-deletion or service fails', async () => {
      req.params = { id: 'admin_123' };
      const mockError = new Error('You cannot delete your own account');
      userService.deleteUserService.mockRejectedValue(mockError);

      await deleteUser(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });

  // --- 5. getAgentsByCategory ---
  describe('getAgentsByCategory', () => {
    test('should return 200 and list of agents matching category', async () => {
      req.query = { category: 'Hardware' };
      const mockAgents = [{ _id: 'agent_1', name: 'Bob', categories: ['Hardware'] }];

      userService.getAgentsByCategoryService.mockResolvedValue(mockAgents);

      await getAgentsByCategory(req, res, next);

      expect(userService.getAgentsByCategoryService).toHaveBeenCalledWith('Hardware');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockAgents);
    });

    test('should forward error to next middleware on failure', async () => {
      const mockError = new Error('Service failure');
      userService.getAgentsByCategoryService.mockRejectedValue(mockError);

      await getAgentsByCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });
});