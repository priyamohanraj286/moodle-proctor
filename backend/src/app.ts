// ============================================================================
// Fastify App Configuration
// Sets up all plugins, middleware, and routes
// ============================================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import fp from 'fastify-plugin';
import config from './config';
import logger from './config/logger';

// Import plugins
import postgresPlugin from './plugins/postgres';

// Import routes
import authRoutes from './modules/auth/auth.routes';

// ============================================================================
// Create Fastify App
// ============================================================================

export async function createApp() {
  const app = Fastify({
    logger: false, // We use Winston instead
    disableRequestLogging: true,
    trustProxy: true,
  });

  // ==========================================================================
  // Register Global Plugins
  // ==========================================================================

  // CORS
  await app.register(cors, {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  });

  // JWT
  await app.register(jwt, {
    secret: config.jwt.secret,
  });

  // Cookie support
  await app.register(cookie, {
    secret: config.jwt.secret,
  });

  // PostgreSQL database
  await app.register(postgresPlugin);

  // ==========================================================================
  // Global Middleware
  // ==========================================================================

  // Request logging
  app.addHook('preHandler', async (request, reply) => {
    logger.debug(`${request.method} ${request.url}`);
  });

  // Error handler
  app.addHook('onError', async (request, reply, error) => {
    logger.error(`Request error: ${request.method} ${request.url}`, error);
  });

  // ==========================================================================
  // Health Check
  // ==========================================================================

  app.get('/health', async (request, reply) => {
    try {
      // Check database connection
      const client = await app.pg.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }

      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        environment: config.app.environment,
        version: config.app.version,
      });
    } catch (error) {
      logger.error('Health check failed:', error);

      return reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: 'Service unavailable',
      });
    }
  });

  // ==========================================================================
  // Register Routes
  // ==========================================================================

  await app.register(authRoutes);

  // ==========================================================================
  // 404 Handler
  // ==========================================================================

  app.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({
      success: false,
      error: 'Not found',
      path: request.url,
    });
  });

  // ==========================================================================
  // Global Error Handler
  // ==========================================================================

  app.setErrorHandler(async (error, request, reply) => {
    logger.error('Global error handler:', error);

    const statusCode = (error as any).statusCode || 500;
    const message = (error as any).message || 'Internal server error';

    return reply.code(statusCode).send({
      success: false,
      error: message,
      ...(config.nodeEnv === 'development' && { stack: error.stack }),
    });
  });

  // ==========================================================================
  // Graceful Shutdown
  // ==========================================================================

  const close = app.close.bind(app);

  app.close = async () => {
    logger.info('Closing application...');
    await close();
  };

  return app;
}

export default createApp;
