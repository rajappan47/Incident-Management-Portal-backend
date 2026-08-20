const { getDashboardMetrics } = require('../../services/dashboardService');
const Incident = require('../../models/Incident');

// Mocks
jest.mock('../../models/Incident');
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
}));

describe('dashboardService - getDashboardMetrics', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should throw a 401 error if user context is missing', async () => {
    await expect(getDashboardMetrics(null)).rejects.toMatchObject({
      message: 'User context is missing',
      statusCode: 401,
    });
  });

  test('should compute global metrics when user role is Admin or Support', async () => {
    const adminUser = { _id: 'admin_123', role: 'Admin' };

    // Mock countDocuments responses in order of call:
    // 1. total
    // 2. New, 3. In Progress, 4. On Hold, 5. Resolved, 6. Closed
    // 7. Critical, 8. High, 9. Medium, 10. Low
    // 11. slaBreached
    Incident.countDocuments
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(2)  // New
      .mockResolvedValueOnce(3)  // In Progress
      .mockResolvedValueOnce(1)  // On Hold
      .mockResolvedValueOnce(2)  // Resolved
      .mockResolvedValueOnce(2)  // Closed
      .mockResolvedValueOnce(1)  // Critical
      .mockResolvedValueOnce(3)  // High
      .mockResolvedValueOnce(4)  // Medium
      .mockResolvedValueOnce(2)  // Low
      .mockResolvedValueOnce(1); // SLA Breached

    const metrics = await getDashboardMetrics(adminUser);

    // Verify filter passed to first call (should be empty for Admin)
    expect(Incident.countDocuments).toHaveBeenNthCalledWith(1, {});

    expect(metrics).toEqual({
      overview: {
        total: 10,
        open: 6, // 2 (New) + 3 (InProgress) + 1 (OnHold)
        resolved: 2,
        closed: 2,
        slaBreached: 1,
      },
      statusBreakdown: {
        New: 2,
        InProgress: 3,
        OnHold: 1,
        Resolved: 2,
        Closed: 2,
      },
      priorityBreakdown: {
        Critical: 1,
        High: 3,
        Medium: 4,
        Low: 2,
      },
    });
  });

  test('should filter metrics by reportedBy when user role is End User', async () => {
    const endUser = { _id: 'user_456', role: 'End User' };

    Incident.countDocuments
      .mockResolvedValueOnce(4) // total
      .mockResolvedValueOnce(1) // New
      .mockResolvedValueOnce(1) // In Progress
      .mockResolvedValueOnce(0) // On Hold
      .mockResolvedValueOnce(1) // Resolved
      .mockResolvedValueOnce(1) // Closed
      .mockResolvedValueOnce(0) // Critical
      .mockResolvedValueOnce(1) // High
      .mockResolvedValueOnce(2) // Medium
      .mockResolvedValueOnce(1) // Low
      .mockResolvedValueOnce(0); // SLA Breached

    const metrics = await getDashboardMetrics(endUser);

    // Verify filter includes reportedBy
    expect(Incident.countDocuments).toHaveBeenNthCalledWith(1, { reportedBy: 'user_456' });

    expect(metrics.overview).toEqual({
      total: 4,
      open: 2, // 1 + 1 + 0
      resolved: 1,
      closed: 1,
      slaBreached: 0,
    });
  });
});