const mongoose = require('mongoose');
const { getMetrics } = require('../../controllers/dashboardController');
const { getHealthStatus } = require('../../controllers/healthController'); // Adjust path if needed
const dashboardService = require('../../services/dashboardService');
const connectDB = require('../../config/db');

// Mocks
jest.mock('../../services/dashboardService');
jest.mock('../../config/db');
jest.mock('mongoose', () => ({
  connection: {
    readyState: 1,
  },
}));

describe('Dashboard & Health Controllers', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: 'user_123', role: 'Admin' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // ==========================================
  // 1. Dashboard Controller Tests
  // ==========================================
  describe('dashboardController -> getMetrics', () => {
    test('should return 200 and metrics payload for authenticated user', async () => {
      const mockMetrics = {
        totalIncidents: 42,
        openIncidents: 12,
        resolvedIncidents: 30,
        averageResolutionTime: '2h 15m',
      };

      dashboardService.getDashboardMetrics.mockResolvedValue(mockMetrics);

      await getMetrics(req, res, next);

      expect(dashboardService.getDashboardMetrics).toHaveBeenCalledWith(req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockMetrics);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware when service fails', async () => {
      const mockError = new Error('Failed to compute dashboard metrics');
      dashboardService.getDashboardMetrics.mockRejectedValue(mockError);

      await getMetrics(req, res, next);

      expect(dashboardService.getDashboardMetrics).toHaveBeenCalledWith(req.user);
      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 2. Health Controller Tests
  // ==========================================
  describe('healthController -> getHealthStatus', () => {
    beforeEach(() => {
      // Mock process.uptime to return a consistent value for deterministic testing
      jest.spyOn(process, 'uptime').mockReturnValue(123.45);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return 200 UP status when MongoDB is connected (readyState = 1)', async () => {
      connectDB.mockResolvedValue();
      mongoose.connection.readyState = 1;

      await getHealthStatus(req, res);

      expect(connectDB).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'UP',
        timestamp: expect.any(String),
        uptime: '123s',
        services: {
          api: {
            status: 'UP',
          },
          database: {
            status: 'CONNECTED',
            connectionState: 1,
          },
        },
      });
    });

    test('should return 503 DOWN status when MongoDB is disconnected (readyState = 0)', async () => {
      connectDB.mockResolvedValue();
      mongoose.connection.readyState = 0; // Disconnected state

      await getHealthStatus(req, res);

      expect(connectDB).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        status: 'DOWN',
        timestamp: expect.any(String),
        uptime: '123s',
        services: {
          api: {
            status: 'UP',
          },
          database: {
            status: 'DISCONNECTED',
            connectionState: 0,
          },
        },
      });
    });

    test('should still evaluate health status when connectDB throws an error', async () => {
      connectDB.mockRejectedValue(new Error('Mongo Network Timeout'));
      mongoose.connection.readyState = 0; // Database unavailable

      await getHealthStatus(req, res);

      expect(connectDB).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          services: expect.objectContaining({
            database: {
              status: 'DISCONNECTED',
              connectionState: 0,
            },
          }),
        })
      );
    });
  });
});