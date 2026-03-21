// ============================================================================
// WebSocket Authentication
// Validates JWT tokens for WebSocket connections
// ============================================================================

import jwtService from '../modules/auth/jwt.service';
import authService from '../modules/auth/auth.service';
import logger from '../config/logger';
import { UnauthorizedError } from '../utils/errors';
import type { FastifyRequest } from 'fastify';

// ============================================================================
// Authenticated User Data
// ============================================================================

export interface AuthenticatedUser {
  id: number;
  moodleUserId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'teacher';
}

// ============================================================================
// WebSocket Authentication
// ============================================================================

/**
 * Extract JWT token from WebSocket upgrade request
 */
export function extractTokenFromRequest(request: FastifyRequest): string | null {
  // Try Authorization header
  const authHeader = request.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try query parameter
  const token = (request.query as { token?: string }).token;

  if (token) {
    return token;
  }

  return null;
}

/**
 * Validate JWT token for WebSocket connection
 */
export async function authenticateWS(
  request: FastifyRequest
): Promise<AuthenticatedUser> {
  const token = extractTokenFromRequest(request);

  if (!token) {
    throw new UnauthorizedError('Missing authentication token');
  }

  try {
    // Validate token structure
    jwtService.validateToken(token);

    // Get full user from database
    const user = await authService.validateToken((request.server as any), token);

    logger.debug(`WebSocket authenticated: ${user.username}`);

    return {
      id: user.id!,
      moodleUserId: user.moodleUserId!,
      username: user.username!,
      email: user.email!,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role as 'student' | 'teacher'
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    logger.error('WebSocket authentication error:', error);
    throw new UnauthorizedError('Authentication failed');
  }
}

/**
 * Verify user has required role
 */
export function requireRole(user: AuthenticatedUser, allowedRoles: ('student' | 'teacher')[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new UnauthorizedError(`Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`);
  }
}

/**
 * Verify user owns the attempt (students) or can monitor it (teachers)
 */
export async function canAccessAttempt(
  pg: any,
  user: AuthenticatedUser,
  attemptId: number
): Promise<boolean> {
  // Teachers can access any attempt
  if (user.role === 'teacher') {
    return true;
  }

  // Students can only access their own attempts
  const result = await pg.query(
    'SELECT id FROM exam_attempts WHERE id = $1 AND user_id = $2',
    [attemptId, user.id]
  );

  return result.rows.length > 0;
}
