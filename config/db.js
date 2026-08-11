// // backend/config/db.js

// backend/config/db.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// 🆕 NEW — cache the connection across serverless invocations
// so we don't reconnect on every single request
let cachedConnection = null;

const connectDB = async () => {
  // 🆕 NEW — reuse existing connection if already connected
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || process.env.DATABASE_URL,
      {
        // 🆕 NEW — fail fast instead of hanging indefinitely on cold starts
        serverSelectionTimeoutMS: 10000,
      }
    );

    cachedConnection = conn; // 🆕 NEW — store for reuse
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Database Connection Error: ${error.message}`);
    // 🆕 CHANGED — removed process.exit(1)
    // On serverless, killing the process crashes the whole function
    // and prevents proper error responses. Instead, throw so the caller
    // (server.js / route handler) can respond with a proper error.
    throw error;
  }
};

module.exports = connectDB;




// const mongoose = require('mongoose');
// const logger = require('../utils/logger'); // Import Winston logger

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGO_URI || process.env.DATABASE_URL);
//     logger.info(`MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     logger.error(`Database Connection Error: ${error.message}`);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;