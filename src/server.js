// src/server.js
require('dotenv').config();
require('express-async-errors'); // Permite usar async/await sin try-catch en routes
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { errorHandler } = require('./shared/middlewares/errorHandler');
const logger = require('./shared/utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 FINA Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      afip: '/api/afip',
      docs: '/api-docs (próximamente)'
    }
  });
});

// AFIP Routes
const afipRoutes = require('./modules/afip/afip.routes');
app.use('/api/afip', afipRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handler (debe ir al final)
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`
  ╔═══════════════════════════════════════╗
  ║   🚀 FINA Backend API                ║
  ║   Port: ${PORT}                          ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}      ║
  ║   Health: http://localhost:${PORT}/health ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = app;