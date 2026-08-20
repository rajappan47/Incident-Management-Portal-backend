// backend/tests/calculateSLA.test.js

// 1. Import the function we're testing
const calculateSLA = require('../utils/calculateSLA');

// 2. Import the Priority model so we can "fake" it (mock it)
const Priority = require('../models/Priority');

// 3. Tell Jest: "don't use the real Priority model, use a fake version"
jest.mock('../models/Priority');

describe('calculateSLA', () => {

  // Runs before each test — resets the fake mock so tests don't affect each other
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should add 4 hours for Critical priority when no DB record exists', async () => {
    // Pretend the database found NOTHING for this priority
    Priority.findOne.mockResolvedValue(null);

    const before = new Date();
    const dueBy = await calculateSLA('Critical');

    const expectedHoursLater = new Date(before.getTime() + 4 * 60 * 60 * 1000);
    const diffInMinutes = Math.abs(dueBy.getTime() - expectedHoursLater.getTime()) / 1000 / 60;

    expect(diffInMinutes).toBeLessThan(1);
  });

  test('should add 48 hours for Low priority when no DB record exists', async () => {
    Priority.findOne.mockResolvedValue(null);

    const before = new Date();
    const dueBy = await calculateSLA('Low');

    const expectedHoursLater = new Date(before.getTime() + 48 * 60 * 60 * 1000);
    const diffInMinutes = Math.abs(dueBy.getTime() - expectedHoursLater.getTime()) / 1000 / 60;

    expect(diffInMinutes).toBeLessThan(1);
  });

  test('should use DB slaHours value when a Priority record exists', async () => {
    // Pretend the database DID find a record, with a custom value: 6 hours
    Priority.findOne.mockResolvedValue({ name: 'Critical', slaHours: 6, isActive: true });

    const before = new Date();
    const dueBy = await calculateSLA('Critical');

    const expectedHoursLater = new Date(before.getTime() + 6 * 60 * 60 * 1000);
    const diffInMinutes = Math.abs(dueBy.getTime() - expectedHoursLater.getTime()) / 1000 / 60;

    expect(diffInMinutes).toBeLessThan(1);
  });

  test('should default to 24 hours (Medium) for unknown priority with no DB record', async () => {
    Priority.findOne.mockResolvedValue(null);

    const before = new Date();
    const dueBy = await calculateSLA('SomeUnknownPriority');

    const expectedHoursLater = new Date(before.getTime() + 24 * 60 * 60 * 1000);
    const diffInMinutes = Math.abs(dueBy.getTime() - expectedHoursLater.getTime()) / 1000 / 60;

    expect(diffInMinutes).toBeLessThan(1);
  });

});