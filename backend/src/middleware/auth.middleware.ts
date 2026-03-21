// ============================================================================
// Authentication Middleware
// Validates JWT tokens and protects routes
// ============================================================================

import { FastifyRequest, FastifyReply } from 'fastify';
import jwtService from '../modules/auth/jwt.service';
import authService from '../modules/auth/auth.service';
import logger from '../config/logger';
import { UnauthorizedError } from '../utils/errors';

// ============================================================================
// Auth Middleware
// ============================================================================

/**
 * Authentication middleware
 * Validates JWT token and attaches user to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    // Validate token
    const payload = jwtService.validateToken(token);

    // Get full user from database
    const user = await authService.validateToken(request.server, token);

    // Attach user to request
    (request as any).user = user;
    (request as any).tokenPayload = payload;

    logger.debug(`Authenticated user: ${user.username}`);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    logger.error('Auth middleware error:', error);
    throw new UnauthorizedError('Authentication failed');
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const payload = jwtService.validateToken(token);
        const user = await authService.validateToken(request.server, token);

        (request as any).user = user;
        (request as any).tokenPayload = payload;

        logger.debug(`Optionally authenticated user: ${user.username}`);
      } catch (error) {
        // Token is invalid, but that's okay for optional auth
        logger.debug('Optional auth token invalid, continuing without user');
      }
    }
  } catch (error) {
    logger.debug('Optional auth middleware error, continuing without user');
  }
}

/**
 * Role-based authorization middleware factory
 * Checks if user has required role
 */
export function requireRole(...allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = (request as any).user;

    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(user.role)) {
      throw new UnauthorizedError('Insufficient permissions');
    }

    logger.debug(`User ${user.username} authorized for roles: ${allowedRoles.join(', ')}`);
  };
}

/**
 * Require teacher role middleware
 */
export const requireTeacher = requireRole('teacher');

/**
 * Require student role middleware
 */
export const requireStudent = requireRole('student');
