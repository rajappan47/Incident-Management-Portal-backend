// backend/utils/logger.js
const { createLogger, format, transports } = require('winston');

// Define standard logging levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Set dynamic logging level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Custom colors for development log output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

require('winston').addColors(colors);

// JSON formatting for production mode
const productionFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.json()
);

// Human-readable format for local development
const developmentFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.colorize({ all: true }),
  format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
  )
);

// Create the Winston logger instance
const logger = createLogger({
  level: level(),
  levels,
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

module.exports = logger;