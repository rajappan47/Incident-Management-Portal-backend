// backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const helmet = require('helmet'); // ADDED: Security Headers
const logger = require('./utils/logger');
const morganMiddleware = require('./middlewares/morganMiddleware');
const { globalRateLimiter } = require('./middlewares/rateLimiter'); // ADDED: Global Rate Limiter
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes'); // Make sure path is correct!
const startEscalationJob = require('./jobs/escalationJob');
const healthRoutes = require('./routes/healthRoutes');// Load environment variables
const errorHandler = require('./middlewares/errorHandler');
const createCustomError = require('./utils/customError'); //  ADDED: Missing import fixed here
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
dotenv.config();
// Connect to MongoDB

connectDB();


const app = express();

app.use(morganMiddleware);
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(createCustomError('Not allowed by CORS origin restriction', 403));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);


//app.use(globalRateLimiter);
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Mount routes


app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
// Serve uploaded static attachment files
app.use('/uploads', express.static('uploads'));
// Mount incident routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
// Mount user management routes
app.use('/api/users', userRoutes);
app.use('/api/health', healthRoutes);   // moved up, before errorHandler
app.use(errorHandler);                   // errorHandler now goes LAST

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Swagger API Documentation live at http://localhost:${PORT}/api-docs`);
    startEscalationJob();
  });
}

module.exports = app;



