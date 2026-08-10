// backend/middlewares/morganMiddleware.js
const morgan = require('morgan');
const logger = require('../utils/logger');

// Pipe Morgan output streams directly into Winston 'http' level logs
const stream = {
  write: (message) => logger.http(message.trim()),
};

// Skip HTTP log creation during test suite runs
const skip = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'test';
};

// Morgan token format setup
const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip }
);

module.exports = morganMiddleware;