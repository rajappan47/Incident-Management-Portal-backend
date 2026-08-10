// backend/utils/calculateSLA.js
const Priority = require('../models/Priority');

/**
 * Calculates due date based on Priority slaHours from DB
 * @param {string} priorityName - e.g. "Critical", "High", "Medium", "Low"
 * @returns {Promise<Date>} Due Date
 */
const calculateSLA = async (priorityName = 'Medium') => {
  const priorityRecord = await Priority.findOne({ name: priorityName, isActive: true });
  
  // Default fallback hours if database master record isn't configured yet
  const defaultHours = { Critical: 4, High: 12, Medium: 24, Low: 48 };
  const hoursToAdd = priorityRecord ? priorityRecord.slaHours : (defaultHours[priorityName] || 24);

  const dueBy = new Date();
  dueBy.setHours(dueBy.getHours() + hoursToAdd);
  return dueBy;
};

module.exports = calculateSLA;