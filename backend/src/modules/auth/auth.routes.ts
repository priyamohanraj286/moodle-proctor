// ============================================================================
// Authentication Routes
// Handles login, logout, token validation, and user info
// ============================================================================

import { FastifyInstance } from 'fastify';
import authService from './auth.service';
import logger from '../../config/logger';

// ============================================================================
// Types
// ============================================================================

interface LoginBody {
  username: string;
  password: string;
}

interface RefreshBody {
  token: string;
}

// ============================================================================
// Auth Routes
// ============================================================================

export default async function authRoutes(fastify: FastifyInstance) {
  // ==========================================================================
  // POST /api/auth/login - Login with Moodle credentials
  // ==========================================================================
  fastify.post('/api/auth/login', async (request, reply) => {
    try {
      const body = request.body as LoginBody;

      const result = await authService.login(fastify, {
        username: body.username,
        password: body.password,
      });

      return reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Login route error:', error);
      const statusCode = (error as any).statusCode || 401;
      const message = (error as any).message || 'Login failed';

      return reply.code(statusCode).send({
        success: false,
        error: message,
      });
    }
  });

  // ==========================================================================
  // POST /api/auth/logout - Logout (invalidate token)
  // ==========================================================================
  fastify.post('/api/auth/logout', async (request, reply) => {
    try {
      // In JWT stateless system, logout is handled client-side
      // But we can log the event
      await authService.logout(fastify, (request.user as any)?.id);

      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout route error:', error);

      return reply.code(500).send({
        success: false,
        error: 'Logout failed',
      });
    }
  });

  // ==========================================================================
  // GET /api/auth/me - Get current user info
  // ==========================================================================
  fastify.get('/api/auth/me', async (request, reply) => {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
        });
      }

      const token = authHeader.substring(7);

      // Validate token and get user
      const user = await authService.validateToken(fastify, token);

      return reply.send({
        success: true,
        user,
      });
    } catch (error) {
      logger.error('Get current user route error:', error);
      const statusCode = (error as any).statusCode || 401;

      return reply.code(statusCode).send({
        success: false,
        error: (error as any).message || 'Unauthorized',
      });
    }
  });

  // ==========================================================================
  // POST /api/auth/validate - Validate JWT token
  // ==========================================================================
  fastify.post('/api/auth/validate', async (request, reply) => {
    try {
      const body = request.body as { token?: string };

      if (!body.token) {
        return reply.code(400).send({
          success: false,
          error: 'Token is required',
        });
      }

      const user = await authService.validateToken(fastify, body.token);

      return reply.send({
        success: true,
        valid: true,
        user,
      });
    } catch (error) {
      logger.error('Token validation route error:', error);

      return reply.code(401).send({
        success: false,
        valid: false,
        error: (error as any).message || 'Invalid token',
      });
    }
  });

  // ==========================================================================
  // POST /api/auth/refresh - Refresh JWT token
  // ==========================================================================
  fastify.post('/api/auth/refresh', async (request, reply) => {
    try {
      const body = request.body as { token?: string };

      if (!body.token) {
        return reply.code(400).send({
          success: false,
          error: 'Token is required',
        });
      }

      const newToken = await authService.refreshToken(fastify, body.token);

      return reply.send({
        success: true,
        token: newToken,
      });
    } catch (error) {
      logger.error('Token refresh route error:', error);
      const statusCode = (error as any).statusCode || 401;

      return reply.code(statusCode).send({
        success: false,
        error: (error as any).message || 'Token refresh failed',
      });
    }
  });
}
