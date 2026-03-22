// ============================================================================
// Manual Proctoring Compatibility Layer
// Provides the manual-client-only endpoints that do not collide with core APIs
// ============================================================================

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import jwtService from '../auth/jwt.service';
import logger from '../../config/logger';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  buildManualStudent,
  ensureManualDevData,
  ensureManualProctoringDirectories,
  findManualUserByIdentifier,
  getLatestManualAttempt,
  getManualExamSummary,
  MANUAL_PROCTORING_QUESTIONS
} from './manual-proctoring.compat';

export default fp(async (fastify: FastifyInstance) => {
  ensureManualProctoringDirectories();

  fastify.post('/api/login', async (request, reply) => {
    try {
      const { email, password } = request.body as {
        email?: string;
        password?: string;
      };

      if (!email || !password) {
        return reply.code(400).send({
          success: false,
          message: 'Email and password are required'
        });
      }

      const existingUser = await findManualUserByIdentifier(fastify.pg as any, email);
      const authIdentifier = existingUser?.username || email;

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: authIdentifier, password }
      });

      const data = JSON.parse(response.payload);

      if (response.statusCode === 200) {
        const tokenPayload = jwtService.validateToken(data.token);
        const { examName } = await getLatestManualAttempt(fastify.pg as any, data.user.id);

        return reply.send({
          success: true,
          token: data.token,
          expiresAt: (tokenPayload.exp || Math.floor(Date.now() / 1000)) * 1000,
          student: buildManualStudent(data.user, examName)
        });
      }

      if ((process.env.NODE_ENV || 'development') === 'production') {
        return reply.code(response.statusCode).send({
          success: false,
          message: data.error || data.message || 'Invalid credentials'
        });
      }

      await ensureManualDevData(fastify.pg as any);

      const localIdentifier = email === 'user' ? 'user' : email;
      const localUser = await findManualUserByIdentifier(fastify.pg as any, localIdentifier);
      const isLegacyDemoLogin = email === 'user' && password === 'password';
      const isDefaultDevLogin = password === (process.env.MANUAL_PROCTORING_DEV_PASSWORD || 'password123');

      if (!localUser || (!isLegacyDemoLogin && !isDefaultDevLogin)) {
        return reply.code(response.statusCode).send({
          success: false,
          message: data.error || data.message || 'Invalid credentials'
        });
      }

      const token = jwtService.generateToken(localUser as any, 'manual-proctoring-dev');
      const tokenPayload = jwtService.validateToken(token);
      const { examName } = await getLatestManualAttempt(fastify.pg as any, localUser.id);

      await fastify.pg.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [localUser.id]
      );

      return reply.send({
        success: true,
        token,
        expiresAt: (tokenPayload.exp || Math.floor(Date.now() / 1000)) * 1000,
        student: buildManualStudent(localUser, examName)
      });
    } catch (error) {
      logger.error('Manual proctoring login error:', error);
      return reply.code(500).send({
        success: false,
        message: 'Login failed'
      });
    }
  });

  fastify.post('/api/logout', { onRequest: [authMiddleware] }, async (_request, reply) => {
    return reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });

  fastify.get('/api/session', { onRequest: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    const tokenPayload = (request as any).tokenPayload;
    const { examName } = await getLatestManualAttempt(fastify.pg as any, user.id);

    return reply.send({
      success: true,
      expiresAt: (tokenPayload?.exp || Math.floor(Date.now() / 1000)) * 1000,
      student: buildManualStudent(user, examName)
    });
  });

  fastify.get('/api/exam', { onRequest: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;

    try {
      const exam = await getManualExamSummary(fastify.pg as any, user.id);

      return reply.send({
        success: true,
        timerSeconds: exam.timerSeconds,
        questionPaper: exam.questionPaper,
        student: buildManualStudent(user, exam.examName),
        attempt: exam.attempt
      });
    } catch (error) {
      if ((error as Error).message === 'No exam found') {
        return reply.code(404).send({
          success: false,
          message: 'No exam found'
        });
      }

      logger.error('Error fetching manual proctoring exam:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch exam data'
      });
    }
  });

  fastify.get('/api/questions', { onRequest: [authMiddleware] }, async (_request, reply) => {
    return reply.send(MANUAL_PROCTORING_QUESTIONS);
  });

  logger.info('Manual proctoring compatibility routes registered');
});
