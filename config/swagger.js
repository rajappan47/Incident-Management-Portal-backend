// backend/config/swagger.js
require('dotenv').config(); // Load environment variables
const swaggerJSDoc = require('swagger-jsdoc');

// Dynamically construct server URL from process.env (fallback to http://localhost:5000)
const PORT = process.env.PORT || 5000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Incident Management System API',
      version: '1.0.0',
      description: 'API documentation for Auth, Incidents, Categories, Dashboard, Users, and Admin modules.',
    },
    servers: [
      {
        url: SERVER_URL,
        description: process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Automatically scans all route files for JSDoc annotations
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;