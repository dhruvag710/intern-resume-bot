const express = require('express');
const createError = require('http-errors');
const morgan = require('morgan');
const cors = require('cors');
require('dotenv').config();

const { sequelize, initializeDatabase } = require('./config/database');
const tokenManager = require('./services/tokenManager');
const gmailPoller = require('./services/gmailPoller');

// Import routes
const authRoutes = require('./routes/authRoutes');
const internshipRoutes = require('./routes/internshipRoutes');

// Import models
const ProcessedEmail = require('./models/ProcessedEmail');

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // CORS preflight cache for 24 hours
}));

// Increase payload size limit
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(morgan('dev'));

// Initialize database and sync models
const setupDatabase = async () => {
  try {
    console.log('Starting database initialization...');
    
    // Check environment variables
    console.log('Environment check:', {
      DB_NAME: process.env.DB_NAME ? 'Set' : 'Not set',
      DB_USER: process.env.DB_USER ? 'Set' : 'Not set',
      DB_PASSWORD: process.env.DB_PASSWORD ? 'Set' : 'Not set',
      DB_HOST: process.env.DB_HOST ? 'Set' : 'Not set',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Not set',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set'
    });

    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error('Failed to initialize database');
      process.exit(1);
    }

    // Sync the ProcessedEmail model
    await ProcessedEmail.sync();
    console.log('ProcessedEmail model synchronized');

    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Database setup error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno
    });
    process.exit(1);
  }
};

// Routes
app.get('/', async (req, res, next) => {
  res.send({ 
    message: 'Smart Mail AI - Internship Processor',
    version: '2.0.0',
    status: 'running'
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const hasTokens = await tokenManager.hasValidTokens();
    const pollingStatus = gmailPoller.getStatus();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      authentication: hasTokens ? 'authenticated' : 'not authenticated',
      polling: pollingStatus.isPolling ? 'active' : 'inactive',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/internship', internshipRoutes);

// Error handling middleware
app.use((req, res, next) => {
  next(createError.NotFound('Route not found'));
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.send({
    error: {
      status: err.status || 500,
      message: err.message,
    },
  });
});

// Start the server
const PORT = process.env.PORT || 4000;

const startServer = async () => {
  await setupDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Smart Mail AI Server running on port ${PORT}`);
    console.log(`📧 Internship email processor ready`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });

  // Auto-start polling if valid tokens are present
  try {
    const hasTokens = await tokenManager.hasValidTokens();
    if (hasTokens) {
      console.log('Valid tokens found. Auto-starting Gmail polling...');
      await gmailPoller.startPolling();
    } else {
      console.log('No valid tokens found. Polling will not start automatically.');
    }
  } catch (err) {
    console.error('Error checking tokens for auto-polling:', err);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  gmailPoller.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  gmailPoller.stopPolling();
  process.exit(0);
});

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
