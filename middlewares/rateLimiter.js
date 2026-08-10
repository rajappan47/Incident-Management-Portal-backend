// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const createCustomError = require('../utils/customError');

// Global Rate Limiter: Applies to ALL incoming requests across the app
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 100, // Limit each IP address to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res, next) => {
    // Uses your centralized error handler utility
    next(createCustomError('Too many requests from this IP. Please try again after 15 minutes.', 429));
  },
});

module.exports = { globalRateLimiter };