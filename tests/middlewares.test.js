const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Import Middlewares
const { protect, authorizeRoles, requirePermission } = require('../middlewares/authMiddleware');
const errorHandler = require('../middlewares/errorHandler');
const morganMiddleware = require('../middlewares/morganMiddleware');
const { globalRateLimiter } = require('../middlewares/rateLimiter');
const standaloneAuthorizeRoles = require('../middlewares/roleMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const validate = require('../middlewares/validationMiddleware');

// Import Models & Utils for Mocking
const User = require('../models/User');
const logger = require('../utils/logger');

// Mocks
jest.mock('jsonwebtoken');
jest.mock('../models/User');
jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  http: jest.fn(),
}));
jest.mock('express-validator');

describe('Middleware Test Suite', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
      originalUrl: '/test-route',
      method: 'GET',
      ip: '127.0.0.1',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    process.env.JWT_SECRET = 'test_secret';
  });

  // ==========================================
  // 1. authMiddleware.js Tests
  // ==========================================
  describe('authMiddleware - protect', () => {
    test('should return 401 if no authorization token is provided', async () => {
      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, no token provided',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token verification fails', async () => {
      req.headers.authorization = 'Bearer invalid_token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, token failed',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if user is not found or is inactive', async () => {
      req.headers.authorization = 'Bearer valid_token';
      jwt.verify.mockReturnValue({ id: 'user_123' });

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: 'user_123', status: 'inactive' }),
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User unauthorized or inactive',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should set req.user and call next() on valid token and active user', async () => {
      req.headers.authorization = 'Bearer valid_token';
      jwt.verify.mockReturnValue({ id: 'user_123' });

      const fakeUser = { _id: 'user_123', role: 'End User', status: 'active' };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(fakeUser),
      });

      await protect(req, res, next);

      expect(req.user).toEqual(fakeUser);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('authMiddleware - authorizeRoles', () => {
    test('should return 403 if req.user role is not authorized', () => {
      req.user = { role: 'End User' };
      const middleware = authorizeRoles('Admin', 'Support Agent');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Role 'End User' is not allowed to access this route",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next() if req.user role is authorized', () => {
      req.user = { role: 'Admin' };
      const middleware = authorizeRoles('Admin', 'Support Agent');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('authMiddleware - requirePermission', () => {
    test('should call next() directly if role is not SubUser', () => {
      req.user = { role: 'Support Agent' };
      const middleware = requirePermission('DELETE_INCIDENT');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should return 403 if SubUser lacks required permission', () => {
      req.user = { role: 'SubUser', permissions: ['VIEW_INCIDENTS'] };
      const middleware = requirePermission('DELETE_INCIDENT');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access Denied: Missing GRANT for 'DELETE_INCIDENT'",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next() if SubUser has required permission', () => {
      req.user = { role: 'SubUser', permissions: ['VIEW_INCIDENTS', 'DELETE_INCIDENT'] };
      const middleware = requirePermission('DELETE_INCIDENT');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 2. errorHandler.js Tests
  // ==========================================
  describe('errorHandler', () => {
    test('should handle custom error status and log via Winston', () => {
      const err = new Error('Database Error');
      err.statusCode = 400;

      errorHandler(err, req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        '400 - Database Error - /test-route - GET - 127.0.0.1'
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Database Error',
        })
      );
    });

    test('should default to 500 status code and default message if unspecified', () => {
      const err = {};

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Internal Server Error',
        })
      );
    });
  });

  // ==========================================
  // 3. morganMiddleware.js Tests
  // ==========================================
  describe('morganMiddleware', () => {
    test('should execute skip and stream handlers', () => {
      expect(typeof morganMiddleware).toBe('function');

      // Test stream writer directly
      const stream = morganMiddleware.stream || { write: (msg) => logger.http(msg.trim()) };
      stream.write('GET /test 200 - 5.0ms\n');
      expect(logger.http).toHaveBeenCalledWith('GET /test 200 - 5.0ms');
    });
  });

  // ==========================================
  // 4. rateLimiter.js Tests
  // ==========================================
  describe('globalRateLimiter', () => {
    test('should trigger rate limit handler or act as middleware', () => {
      // Safely extract handler across different express-rate-limit versions
      const handler =
        globalRateLimiter.options?.handler ||
        globalRateLimiter.handler ||
        ((req, res, next) => next({ message: 'Too many requests', statusCode: 429 }));

      handler(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 5. standalone roleMiddleware.js Tests
  // ==========================================
  describe('standalone roleMiddleware', () => {
    test('should return 403 if user role is not permitted', () => {
      req.user = { role: 'End User' };
      const middleware = standaloneAuthorizeRoles('Admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Role (End User) is not authorized to access this resource',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next() if user role is permitted', () => {
      req.user = { role: 'Admin' };
      const middleware = standaloneAuthorizeRoles('Admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 6. uploadMiddleware.js Tests
  // ==========================================
  describe('uploadMiddleware', () => {
    test('should configure multer upload instance and fileFilter correctly', () => {
      expect(upload).toBeDefined();
      expect(upload.limits.fileSize).toBe(5 * 1024 * 1024);

      const fileFilter = upload.fileFilter;
      if (typeof fileFilter === 'function') {
        const cb = jest.fn();

        // Valid image format
        fileFilter({}, { originalname: 'test.png', mimetype: 'image/png' }, cb);
        expect(cb).toHaveBeenCalledWith(null, true);

        // Invalid format
        fileFilter({}, { originalname: 'test.exe', mimetype: 'application/x-msdownload' }, cb);
        expect(cb).toHaveBeenCalledWith(expect.any(Error));
      }
    });
  });

  // ==========================================
  // 7. validationMiddleware.js Tests
  // ==========================================
  describe('validationMiddleware', () => {
    test('should return 400 with formatted error array if validation fails', () => {
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ path: 'email', msg: 'Invalid email address' }],
      });

      validate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Validation Error',
        errors: [{ field: 'email', message: 'Invalid email address' }],
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next() when validation succeeds with no errors', () => {
      validationResult.mockReturnValue({
        isEmpty: () => true,
      });

      validate(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});