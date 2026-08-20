const mongoose = require('mongoose');
const User = require('../../models/User');
const createCustomError = require('../../utils/customError');
const {
  getAllUsers,
  createUserService,
  updateUserRoleOrStatus,
  updateUserService,
  deleteUserService,
  getAgentsByCategoryService,
} = require('../../services/userService');

// Mocks
jest.mock('../../models/User');
jest.mock('../../utils/customError');

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    createCustomError.mockImplementation((message, statusCode) => {
      const err = new Error(message);
      err.statusCode = statusCode;
      return err;
    });
  });

  // --- 1. getAllUsers ---
  describe('getAllUsers', () => {
    test('should fetch all users without filter and exclude passwords sorted descending', async () => {
      const mockUsers = [{ _id: 'u1', name: 'Alice' }, { _id: 'u2', name: 'Bob' }];
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockUsers),
      };
      User.find.mockReturnValue(mockQuery);

      const result = await getAllUsers({});

      expect(User.find).toHaveBeenCalledWith({});
      expect(mockQuery.select).toHaveBeenCalledWith('-password');
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(mockUsers);
    });

    test('should apply role and search filter when parameters are passed', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      };
      User.find.mockReturnValue(mockQuery);

      await getAllUsers({ role: 'Support Agent', search: 'John' });

      expect(User.find).toHaveBeenCalledWith({
        role: 'Support Agent',
        $or: [
          { name: { $regex: 'John', $options: 'i' } },
          { email: { $regex: 'John', $options: 'i' } },
        ],
      });
    });
  });

  // --- 2. createUserService ---
  describe('createUserService', () => {
    test('should throw 400 if required fields are missing', async () => {
      await expect(
        createUserService({ name: 'John', email: '' })
      ).rejects.toThrow('Name, email, and password are required');

      expect(createCustomError).toHaveBeenCalledWith(
        'Name, email, and password are required',
        400
      );
    });

    test('should throw 400 if user with email already exists', async () => {
      User.findOne.mockResolvedValue({ _id: 'u1', email: 'exist@example.com' });

      await expect(
        createUserService({
          name: 'Jane',
          email: 'exist@example.com',
          password: 'pass',
        })
      ).rejects.toThrow('User already exists with this email');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'exist@example.com' });
      expect(createCustomError).toHaveBeenCalledWith(
        'User already exists with this email',
        400
      );
    });

    test('should successfully create and return user details with default role', async () => {
      User.findOne.mockResolvedValue(null);

      const createdUserMock = {
        _id: 'new_id_123',
        name: 'New User',
        email: 'new@example.com',
        role: 'End User',
      };
      User.create.mockResolvedValue(createdUserMock);

      const result = await createUserService({
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      });

      expect(User.create).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
        role: 'End User',
      });
      expect(result).toEqual({
        _id: 'new_id_123',
        name: 'New User',
        email: 'new@example.com',
        role: 'End User',
      });
    });
  });

  // --- 3. updateUserRoleOrStatus ---
  describe('updateUserRoleOrStatus', () => {
    const validUserId = new mongoose.Types.ObjectId().toString();

    test('should throw 400 for invalid ObjectId format', async () => {
      await expect(
        updateUserRoleOrStatus('invalid-id', { role: 'Admin' })
      ).rejects.toThrow('Invalid User ID format');
    });

    test('should throw 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(
        updateUserRoleOrStatus(validUserId, { role: 'Admin' })
      ).rejects.toThrow('User not found');
    });

    test('should throw 400 for unallowed role value', async () => {
      User.findById.mockResolvedValue({ _id: validUserId });

      await expect(
        updateUserRoleOrStatus(validUserId, { role: 'SuperUser' })
      ).rejects.toThrow('Invalid role. Must be one of: End User, Support Agent, Admin');
    });

    test('should update role and active status successfully', async () => {
      const mockUser = {
        _id: validUserId,
        role: 'End User',
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValueOnce(mockUser);

      const mockQuery = {
        select: jest.fn().mockResolvedValue({
          _id: validUserId,
          name: 'Updated User',
          role: 'Support Agent',
          isActive: false,
        }),
      };
      User.findById.mockReturnValueOnce(mockQuery);

      const result = await updateUserRoleOrStatus(validUserId, {
        role: 'Support Agent',
        isActive: false,
      });

      expect(mockUser.role).toBe('Support Agent');
      expect(mockUser.isActive).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockQuery.select).toHaveBeenCalledWith('-password');
      expect(result.role).toBe('Support Agent');
    });
  });

  // --- 4. updateUserService ---
  describe('updateUserService', () => {
    const validUserId = new mongoose.Types.ObjectId().toString();

    test('should throw 400 for invalid ObjectId format', async () => {
      await expect(
        updateUserService('invalid-id', { name: 'New Name' })
      ).rejects.toThrow('Invalid User ID format');
    });

    test('should throw 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(
        updateUserService(validUserId, { name: 'New Name' })
      ).rejects.toThrow('User not found');
    });

    test('should throw 400 for invalid role', async () => {
      User.findById.mockResolvedValue({ _id: validUserId });

      await expect(
        updateUserService(validUserId, { role: 'Manager' })
      ).rejects.toThrow('Invalid role. Must be one of: End User, Support Agent, Admin');
    });

    test('should update name and role and return user data', async () => {
      const mockUser = {
        _id: validUserId,
        name: 'Old Name',
        email: 'test@example.com',
        role: 'End User',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      User.findById.mockResolvedValue(mockUser);

      const result = await updateUserService(validUserId, {
        name: 'New Name',
        role: 'Admin',
      });

      expect(mockUser.name).toBe('New Name');
      expect(mockUser.role).toBe('Admin');
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual({
        _id: validUserId,
        name: 'New Name',
        email: 'test@example.com',
        role: 'Admin',
      });
    });
  });

  // --- 5. deleteUserService ---
  describe('deleteUserService', () => {
    const validUserId = new mongoose.Types.ObjectId().toString();
    const validAdminId = new mongoose.Types.ObjectId();

    test('should throw 400 for invalid ObjectId format', async () => {
      await expect(deleteUserService('invalid-id', validAdminId)).rejects.toThrow(
        'Invalid User ID format'
      );
    });

    test('should throw 400 if admin tries to delete their own account', async () => {
      await expect(
        deleteUserService(validAdminId.toString(), validAdminId)
      ).rejects.toThrow('You cannot delete your own admin account');
    });

    test('should throw 404 if user to delete is not found', async () => {
      User.findByIdAndDelete.mockResolvedValue(null);

      await expect(deleteUserService(validUserId, validAdminId)).rejects.toThrow(
        'User not found'
      );
    });

    test('should delete user and return success message', async () => {
      User.findByIdAndDelete.mockResolvedValue({ _id: validUserId });

      const result = await deleteUserService(validUserId, validAdminId);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith(validUserId);
      expect(result).toEqual({ message: 'User removed successfully' });
    });
  });

  // --- 6. getAgentsByCategoryService ---
  describe('getAgentsByCategoryService', () => {
    test('should throw 400 if category is missing', async () => {
      await expect(getAgentsByCategoryService()).rejects.toThrow(
        'Category parameter is required.'
      );
    });

    test('should query Support Agents matching the category and select specific fields', async () => {
      const mockAgents = [
        { _id: 'a1', name: 'Agent 1', email: 'a1@test.com' },
      ];
      const mockQuery = {
        select: jest.fn().mockResolvedValue(mockAgents),
      };
      User.find.mockReturnValue(mockQuery);

      const result = await getAgentsByCategoryService('Hardware');

      expect(User.find).toHaveBeenCalledWith({
        role: 'Support Agent',
        categories: { $in: ['Hardware'] },
      });
      expect(mockQuery.select).toHaveBeenCalledWith('_id name email team categories');
      expect(result).toEqual(mockAgents);
    });
  });
});