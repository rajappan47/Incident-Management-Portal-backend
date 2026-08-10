// backend/middlewares/errorHandler.js
const logger = require('../utils/logger'); // Import Winston logger

const errorHandler = (err, req, res, next) => {
  // Determine HTTP status code (defaults to 500 if not explicitly set)
  const statusCode = err.statusCode || 500;
   logger.error(
    `${statusCode} - ${err.message || 'Internal Server Error'} - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );
  // Format consistent JSON error response
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Include stack trace only during local development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;