// backend/utils/customError.js

/**
 * Creates a standard Error instance with an attached HTTP statusCode.
 * @param {string} message - Error description
 * @param {number} statusCode - HTTP Status Code (e.g., 400, 404, 403)
 */
const createCustomError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = createCustomError;