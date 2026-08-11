const mongoose = require('mongoose');
// 🟢 MODIFIED: Import your connectDB function
const connectDB = require('../config/db');

/**
 * @desc    Check API uptime and MongoDB connectivity
 * @route   GET /health
 * @access  Public (Required for external uptime monitoring tools)
 */
const getHealthStatus = async (req, res) => {
  try {
    // 🟢 MODIFIED: Wait for MongoDB connection to complete before checking readyState
    // This forces state 2 (connecting) to complete and turn into state 1 (connected)
    await connectDB();
  } catch (error) {
    // Catch connection errors if MongoDB fails to reach
  }

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