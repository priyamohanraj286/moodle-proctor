import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import logger from '../../config/logger';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  buildManualStudent,
  createManualSession,
  destroyManualSession,
  ensureManualProctoringDirectories,
  getManualExamSummary,
  getManualQuestionPaperFilename,
  getManualSessionFromRequest,
  getManualTokenFromRequest,
  isManualProctoringRequest,
  MANUAL_PROCTORING_QUESTIONS,
  validateManualCredentials
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

      if (!validateManualCredentials(email, password)) {
        return reply.code(401).send({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const session = createManualSession();

      return reply.send({
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        student: buildManualStudent()
      });
    } catch (error) {
      logger.error('Manual proctoring login error:', error);
      return reply.code(500).send({
        success: false,
        message: 'Login failed'
      });
    }
  });

  fastify.post('/api/logout', { onRequest: [authMiddleware] }, async (request, reply) => {
    destroyManualSession(getManualTokenFromRequest(request as any));

    return reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });

  fastify.get('/api/session', { onRequest: [authMiddleware] }, async (request, reply) => {
    const session = getManualSessionFromRequest(request as any);

    if (isManualProctoringRequest(request as any) && session) {
      return reply.send({
        success: true,
        expiresAt: session.expiresAt,
        student: buildManualStudent()
      });
    }

    return reply.code(401).send({
      success: false,
      message: 'Invalid session'
    });
  });

  fastify.get('/api/exam', { onRequest: [authMiddleware] }, async (_request, reply) => {
    const exam = getManualExamSummary();

    return reply.send({
      success: true,
      timerSeconds: exam.timerSeconds,
      questionPaper: getManualQuestionPaperFilename(),
      student: exam.student,
      attempt: exam.attempt
    });
  });

  fastify.get('/api/questions', { onRequest: [authMiddleware] }, async (_request, reply) => {
    return reply.send(MANUAL_PROCTORING_QUESTIONS);
  });

  logger.info('Manual proctoring compatibility routes registered');
});
