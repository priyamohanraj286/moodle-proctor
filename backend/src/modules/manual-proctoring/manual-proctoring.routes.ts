// ============================================================================
// Manual Proctoring Compatibility Layer
// Provides endpoints compatible with the Electron manual proctoring client
// ============================================================================

import fp from 'fastify-plugin';
import { authMiddleware } from '../../middleware/auth.middleware';
import jwtService from '../auth/jwt.service';
import logger from '../../config/logger';
import type { FastifyInstance } from 'fastify';

// ============================================================================
// Manual Proctoring Routes
// ============================================================================

export default fp(async (fastify: FastifyInstance) => {
  // ==========================================================================
  // Authentication Compatibility Endpoints
  // These match the Electron client's expected API paths
  // ==========================================================================

  /**
   * Login endpoint compatible with Electron client
   * Maps to: POST /api/auth/login (internal)
   */
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

      // Call the internal auth endpoint
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: email, password }
      });

      const data = JSON.parse(response.payload);

      if (response.statusCode !== 200) {
        return reply.code(response.statusCode).send(data);
      }

      // Transform response to match Electron client expectations
      return reply.send({
        success: true,
        token: data.data.token,
        expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
        student: {
          id: data.data.user.id.toString(),
          name: `${data.data.user.firstName} ${data.data.user.lastName}`,
          email: data.data.user.email,
          exam: 'Exam' // Will be fetched from backend
        }
      });
    } catch (error) {
      logger.error('Manual proctoring login error:', error);
      return reply.code(500).send({
        success: false,
        message: 'Login failed'
      });
    }
  });

  /**
   * Logout endpoint
   */
  fastify.post('/api/logout', async (request, reply) => {
    // JWT tokens are stateless, just return success
    return reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });

  /**
   * Get current session
   */
  fastify.get('/api/session', { onRequest: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;

    return reply.send({
      success: true,
      expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
      student: {
        id: user.id.toString(),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        exam: 'Exam' // Will be fetched from backend
      }
    });
  });

  // ==========================================================================
  // Student & Exam Endpoints
  // ==========================================================================

  /**
   * Get student profile with current attempt
   */
  fastify.get('/api/student', { onRequest: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    const pg = fastify.pg;

    try {
      // Get student's latest attempt
      const result = await pg.query(
        `SELECT
          ea.id,
          ea.status,
          ea.started_at as "startedAt",
          ea.submitted_at as "submittedAt",
          ea.submission_reason as "submissionReason",
          ea.violation_count as "violationCount",
          e.max_warnings as "maxWarnings"
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        WHERE ea.user_id = $1
        ORDER BY ea.created_at DESC
        LIMIT 1`,
        [user.id]
      );

      const attempt = result.rows[0];

      return reply.send({
        success: true,
        student: {
          id: user.id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          exam: attempt ? 'Exam' : 'No exam'
        },
        attempt: attempt ? {
          status: attempt.status,
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt,
          submissionReason: attempt.submissionReason,
          maxWarnings: attempt.maxWarnings,
          canResume: attempt.status === 'in_progress',
          violationCount: attempt.violationCount,
          violations: [] // Will be populated if needed
        } : null
      });
    } catch (error) {
      logger.error('Error fetching student:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch student data'
      });
    }
  });

  /**
   * Get exam details
   */
  fastify.get('/api/exam', { onRequest: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    const pg = fastify.pg;

    try {
      // Get student's latest exam attempt
      const result = await pg.query(
        `SELECT
          e.id,
          e.exam_name as "examName",
          e.course_name as "courseName",
          e.duration_minutes as "durationMinutes",
          e.max_warnings as "maxWarnings",
          ea.id as "attemptId",
          ea.status,
          ea.started_at as "startedAt",
          ea.submitted_at as "submittedAt",
          ea.submission_reason as "submissionReason",
          ea.violation_count as "violationCount"
        FROM exams e
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id AND ea.user_id = $1
        ORDER BY ea.created_at DESC NULLS LAST
        LIMIT 1`,
        [user.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'No exam found'
        });
      }

      const exam = result.rows[0];

      return reply.send({
        success: true,
        timerSeconds: (exam.durationMinutes || 60) * 60,
        questionPaper: 'question-paper.pdf', // Would be fetched from storage
        student: {
          id: user.id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          exam: exam.examName
        },
        attempt: exam.attemptId ? {
          status: exam.status,
          startedAt: exam.startedAt,
          submittedAt: exam.submittedAt,
          submissionReason: exam.submissionReason,
          maxWarnings: exam.maxWarnings,
          canResume: exam.status === 'in_progress',
          violationCount: exam.violationCount || 0,
          violations: []
        } : null
      });
    } catch (error) {
      logger.error('Error fetching exam:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch exam data'
      });
    }
  });

  // ==========================================================================
  // Exam Actions
  // ==========================================================================

  /**
   * Start exam - proxy to existing endpoint
   */
  fastify.post('/api/exam/start', { onRequest: [authMiddleware] }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const pg = fastify.pg;

      // Get first available exam for this student
      const examResult = await pg.query(
        'SELECT id FROM exams LIMIT 1'
      );

      if (examResult.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'No exam available'
        });
      }

      const examId = examResult.rows[0].id;

      // Call the internal start exam endpoint
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/exam/start',
        headers: {
          authorization: request.headers.authorization
        },
        payload: { examId }
      });

      const data = JSON.parse(response.payload);

      if (response.statusCode !== 200) {
        return reply.code(response.statusCode).send({
          success: false,
          message: data.error || 'Failed to start exam'
        });
      }

      return reply.send({
        success: true,
        attempt: {
          status: data.data.attempt.status,
          startedAt: data.data.attempt.startedAt,
          submittedAt: data.data.attempt.submittedAt,
          submissionReason: data.data.attempt.submissionReason,
          maxWarnings: data.data.exam.maxWarnings,
          canResume: true,
          violationCount: data.data.attempt.violationCount,
          violations: []
        }
      });
    } catch (error) {
      logger.error('Error starting exam:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to start exam'
      });
    }
  });

  /**
   * Report violation - proxy to existing endpoint
   */
  fastify.post('/api/exam/violations', { onRequest: [authMiddleware] }, async (request, reply) => {
    try {
      const { type, detail, severity } = request.body as {
        type?: string;
        detail?: string;
        severity?: string;
      };

      // Get current attempt for user
      const user = (request as any).user;
      const pg = fastify.pg;

      const attemptResult = await pg.query(
        `SELECT id FROM exam_attempts
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
        [user.id]
      );

      if (attemptResult.rows.length === 0) {
        return reply.code(409).send({
          success: false,
          message: 'No active exam attempt found'
        });
      }

      const attemptId = attemptResult.rows[0].id;

      // Call the internal violation endpoint
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/exam/violations',
        headers: {
          authorization: request.headers.authorization
        },
        payload: {
          attemptId,
          violationType: type || 'unknown',
          detail,
          severity: severity || 'info'
        }
      });

      const data = JSON.parse(response.payload);

      if (response.statusCode !== 200) {
        return reply.code(response.statusCode).send({
          success: false,
          message: data.error || 'Failed to report violation'
        });
      }

      return reply.send({
        success: true,
        message: data.data.wasAutoSubmitted ? 'Exam terminated due to excessive warnings.' : undefined,
        attempt: {
          status: data.data.attempt.status,
          startedAt: data.data.attempt.startedAt,
          submittedAt: data.data.attempt.submittedAt,
          submissionReason: data.data.attempt.submissionReason,
          maxWarnings: data.data.exam.maxWarnings,
          canResume: data.data.attempt.status === 'in_progress',
          violationCount: data.data.attempt.violationCount,
          violations: []
        }
      });
    } catch (error) {
      logger.error('Error reporting violation:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to report violation'
      });
    }
  });

  /**
   * Submit exam - proxy to existing endpoint
   */
  fastify.post('/api/exam/submit', { onRequest: [authMiddleware] }, async (request, reply) => {
    try {
      const { reason } = request.body as {
        reason?: string;
      };

      const user = (request as any).user;
      const pg = fastify.pg;

      // Get current attempt
      const attemptResult = await pg.query(
        `SELECT id FROM exam_attempts
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
        [user.id]
      );

      if (attemptResult.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'No active exam attempt found'
        });
      }

      const attemptId = attemptResult.rows[0].id;

      // Call the internal submit endpoint
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/exam/submit',
        headers: {
          authorization: request.headers.authorization
        },
        payload: {
          attemptId,
          submissionReason: reason || 'manual_submit',
          answers: {}
        }
      });

      const data = JSON.parse(response.payload);

      if (response.statusCode !== 200) {
        return reply.code(response.statusCode).send({
          success: false,
          message: data.error || 'Failed to submit exam'
        });
      }

      return reply.send({
        success: true,
        attempt: {
          status: data.data.attempt.status,
          startedAt: data.data.attempt.startedAt,
          submittedAt: data.data.attempt.submittedAt,
          submissionReason: data.data.attempt.submissionReason,
          maxWarnings: data.data.exam.maxWarnings,
          canResume: false,
          violationCount: data.data.attempt.violationCount,
          violations: []
        }
      });
    } catch (error) {
      logger.error('Error submitting exam:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to submit exam'
      });
    }
  });

  /**
   * Get questions (placeholder - would fetch from Moodle)
   */
  fastify.get('/api/questions', { onRequest: [authMiddleware] }, async (request, reply) => {
    // Return placeholder questions
    // In production, these would come from the exam configuration
    return reply.send([
      {
        id: 1,
        question: 'Question 1',
        options: ['Option A', 'Option B', 'Option C', 'Option D']
      }
    ]);
  });

  // ==========================================================================
  // Static Files
  // ==========================================================================

  // Serve question papers if needed
  fastify.register(require('@fastify/static'), {
    root: '/tmp/proctoring-files',
    prefix: '/files'
  });

  logger.info('Manual proctoring compatibility layer registered');
});
