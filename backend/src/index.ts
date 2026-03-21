// ============================================================================
// Moodle-Proctor Backend Entry Point
// Starts the Fastify server
// ============================================================================

import createApp from './app';
import config from './config';
import logger from './config/logger';

// ============================================================================
// Start Server
// ============================================================================

async function start() {
  try {
    logger.info('Starting Moodle-Proctor backend...');

    // Create Fastify app
    const app = await createApp();

    // Start listening
    await app.listen({ port: config.port, host: '0.0.0.0' });

    logger.info(`
╔══════════════════════════════════════════════════════════════╗
║                    Moodle-Proctor Backend                     ║
╠══════════════════════════════════════════════════════════════╣
║  Environment: ${config.nodeEnv.padEnd(48)}║
║  Version:     ${config.app.version.padEnd(48)}║
║  Port:        ${config.port.toString().padEnd(48)}║
║  Database:    ${config.database.url.replace(/\/\/.*@/, '//***@').padEnd(48)}║
║  Moodle:      ${config.moodle.baseUrl.padEnd(48)}║
╚══════════════════════════════════════════════════════════════╝

Server is ready and listening on port ${config.port}
API documentation: http://localhost:${config.port}/docs
Health check: http://localhost:${config.port}/health
    `);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================================================
// Handle Process Signals
// ============================================================================

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ============================================================================
// Start Application
// ============================================================================

start();
