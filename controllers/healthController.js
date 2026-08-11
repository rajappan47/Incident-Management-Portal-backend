const mongoose = require('mongoose');

/**
 * @desc    Check API uptime and MongoDB connectivity
 * @route   GET /health
 * @access  Public (Required for external uptime monitoring tools)
 */
const getHealthStatus = async (req, res) => {
  // 1. Check MongoDB connection state
  // States: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbState = mongoose.connection.readyState;
  const isDbConnected = dbState === 1;

  // 2. Prepare payload
  const healthData = {
    status: isDbConnected ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    services: {
      api: {
        status: 'UP',
      },
      database: {
        status: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
        connectionState: dbState, // Optional: gives explicit numeric state
      },
    },
  };

  // 3. Return 200 if DB is connected, 503 Service Unavailable if DB is down
  const statusCode = isDbConnected ? 200 : 503;

  return res.status(statusCode).json(healthData);
};

module.exports = { getHealthStatus };