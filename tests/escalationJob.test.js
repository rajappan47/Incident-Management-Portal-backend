const { runEscalationJob } = require('../jobs/escalationJob');
const incidentService = require('../services/incidentService');
const logger = require('../utils/logger');

jest.mock('../services/incidentService');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('escalationJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should trigger escalateOverdueIncidents and log success when scheduled task runs', async () => {
    incidentService.escalateOverdueIncidents.mockResolvedValue(3);

    await runEscalationJob();

    expect(incidentService.escalateOverdueIncidents).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('[Escalation Job] Done. Escalated: 3');
  });

  it('should catch and log error if escalateOverdueIncidents throws an exception', async () => {
    const mockError = new Error('Database query timed out');
    incidentService.escalateOverdueIncidents.mockRejectedValue(mockError);

    await runEscalationJob();

    expect(incidentService.escalateOverdueIncidents).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('[Escalation Job] Error: Database query timed out');
  });
});