// backend/tests/authService.test.js

const { registerUser, loginUser } = require('../../services/authService');
const User = require('../../models/User');
const { hashPassword, comparePassword, generateToken } = require('../../utils/authUtils');

// Fake (mock) all external dependencies — we only want to test authService's OWN logic
jest.mock('../../models/User');
jest.mock('../../utils/authUtils');
jest.mock('../../utils/logger'); // silence logger.debug/warn during tests

describe('authService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================
  // registerUser tests
  // ============================
  describe('registerUser', () => {

    test('should throw error if name, email, or password is missing', async () => {
      await expect(
        registerUser({ name: '', email: '', password: '' })
      ).rejects.toThrow('Name, email, and password are required');
    });

    test('should throw error if user already exists', async () => {
      User.findOne.mockResolvedValue({ _id: '123', email: 'test@test.com' });

      await expect(
        registerUser({ name: 'Test', email: 'test@test.com', password: '123456' })
      ).rejects.toThrow('User already exists');
    });

    test('should throw error if Support Agent has no team', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        registerUser({
          name: 'Agent A',
          email: 'agent@test.com',
          password: '123456',
          role: 'Support Agent',
          team: '', // missing team
          categories: ['Network'],
        })
      ).rejects.toThrow('Support Agents must belong to a team.');
    });

    test('should throw error if Support Agent has no categories', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        registerUser({
          name: 'Agent A',
          email: 'agent@test.com',
          password: '123456',
          role: 'Support Agent',
          team: 'IT Infra',
          categories: [], // missing categories
        })
      ).rejects.toThrow('Support Agents must have at least one assigned category.');
    });

    test('should register a new End User successfully and return a token', async () => {
      User.findOne.mockResolvedValue(null); // no existing user
      hashPassword.mockResolvedValue('hashed_password_123');

      const fakeCreatedUser = {
        _id: 'user_1',
        name: 'John Doe',
        email: 'john@test.com',
        role: 'End User',
        team: null,
        categories: [],
      };
      User.create.mockResolvedValue(fakeCreatedUser);
      generateToken.mockReturnValue('fake_jwt_token');

      const result = await registerUser({
        name: 'John Doe',
        email: 'john@test.com',
        password: 'plainPassword123',
      });

      // Check password was hashed before saving
      expect(hashPassword).toHaveBeenCalledWith('plainPassword123');

      // Check the returned object has expected shape
      expect(result).toEqual({
        _id: 'user_1',
        name: 'John Doe',
        email: 'john@test.com',
        role: 'End User',
        team: null,
        categories: [],
        token: 'fake_jwt_token',
      });
    });

  });

  // ============================
  // loginUser tests
  // ============================
  describe('loginUser', () => {

    test('should throw error if email or password is missing', async () => {
      await expect(
        loginUser({ email: '', password: '' })
      ).rejects.toThrow('Please provide email and password');
    });

    test('should throw error if user does not exist', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        loginUser({ email: 'noone@test.com', password: '123456' })
      ).rejects.toThrow('Invalid email or password');
    });

    test('should throw error if password does not match', async () => {
      User.findOne.mockResolvedValue({
        _id: 'user_1',
        email: 'john@test.com',
        password: 'hashed_password',
        role: 'End User',
      });
      comparePassword.mockResolvedValue(false); // wrong password

      await expect(
        loginUser({ email: 'john@test.com', password: 'wrongPassword' })
      ).rejects.toThrow('Invalid email or password');
    });

    test('should login successfully and return a token when credentials are correct', async () => {
      const fakeUser = {
        _id: 'user_1',
        name: 'John Doe',
        email: 'john@test.com',
        password: 'hashed_password',
        role: 'End User',
        isSubUser: false,
        parentId: null,
        permissions: {},
      };
      User.findOne.mockResolvedValue(fakeUser);
      comparePassword.mockResolvedValue(true); // correct password
      generateToken.mockReturnValue('fake_jwt_token');

      const result = await loginUser({ email: 'john@test.com', password: 'correctPassword' });

      expect(comparePassword).toHaveBeenCalledWith('correctPassword', 'hashed_password');
      expect(result).toEqual({
        _id: 'user_1',
        name: 'John Doe',
        email: 'john@test.com',
        role: 'End User',
        isSubUser: false,
        parentId: null,
        permissions: {},
        token: 'fake_jwt_token',
      });
    });

  });

});