const { register, login, getMe } = require('../../controllers/authController');
const authService = require('../../services/authService');

// Mock authService
jest.mock('../../services/authService');

describe('authController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // --- 1. register ---
  describe('register', () => {
    test('should return 201 and created user data on successful registration', async () => {
      const mockUserData = {
        _id: 'user_1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'End User',
        token: 'mock_jwt_token',
      };

      req.body = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      };

      authService.registerUser.mockResolvedValue(mockUserData);

      await register(req, res, next);

      expect(authService.registerUser).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockUserData);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware when registration fails', async () => {
      const mockError = new Error('User already exists with this email');
      authService.registerUser.mockRejectedValue(mockError);

      await register(req, res, next);

      expect(authService.registerUser).toHaveBeenCalledWith(req.body);
      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // --- 2. login ---
  describe('login', () => {
    test('should return 200 and user data with token on valid credentials', async () => {
      const mockLoginResponse = {
        _id: 'user_1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'End User',
        token: 'valid_jwt_token',
      };

      req.body = {
        email: 'john@example.com',
        password: 'Password123!',
      };

      authService.loginUser.mockResolvedValue(mockLoginResponse);

      await login(req, res, next);

      expect(authService.loginUser).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockLoginResponse);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware on invalid login credentials', async () => {
      const mockError = new Error('Invalid email or password');
      authService.loginUser.mockRejectedValue(mockError);

      await login(req, res, next);

      expect(authService.loginUser).toHaveBeenCalledWith(req.body);
      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // --- 3. getMe ---
  describe('getMe', () => {
    test('should return 200 and currently authenticated user object from req.user', async () => {
      const mockUser = {
        _id: 'user_1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'End User',
      };

      req.user = mockUser;

      await getMe(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(next).not.toHaveBeenCalled();
    });

    test('should catch and pass error to next middleware if an exception occurs', async () => {
      const mockError = new Error('Unexpected execution failure');

      // Force an error inside try block by overriding res.status to throw
      res.status.mockImplementation(() => {
        throw mockError;
      });

      await getMe(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });
});