// ============================================================================
// Student Module - Routes
// API endpoints for student operations
// ============================================================================

import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { createStudentService } from './student.service';
import { authMiddleware } from '../../middleware/auth.middleware';

// ============================================================================
// Routes Plugin
// ============================================================================

export default fp(async (fastify: FastifyInstance) => {
  const studentService = createStudentService(fastify.pg as any);

  // ==========================================================================
  // GET /api/student - Get student profile and attempts
  // ==========================================================================

  fastify.get('/api/student', {
    onRequest: [authMiddleware],
    handler: async (request, reply) => {
      // @ts-ignore
      const userId = request.user.id;

      try {
        const result = await studentService.getStudentProfile(userId);
        return reply.send(result);
      } catch (error) {
        if ((error as Error).message === 'Student not found') {
          return reply.code(404).send({
            success: false,
            error: 'Student profile not found'
          });
        }
        throw error;
      }
    }
  });

  // ==========================================================================
  // GET /api/session - Validate proctoring session
  // ==========================================================================

  fastify.get('/api/session/:sessionId', {
    onRequest: [authMiddleware],
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      },
      querystring: {
        type: 'object',
        properties: {
          attemptId: { type: 'number' }
        },
        required: ['attemptId']
      }
    },
    handler: async (request, reply) => {
      // @ts-ignore
      const userId = request.user.id;
      const { sessionId } = request.params as { sessionId: string };
      const { attemptId } = request.query as { attemptId: number };

      const result = await studentService.validateSession(sessionId, attemptId, userId);
      return reply.send(result);
    }
  });

  // ==========================================================================
  // GET /files/:filename - Serve exam-related static files
  // ==========================================================================

  fastify.get('/files/:filename', {
    handler: async (request, reply) => {
      const { filename } = request.params as { filename: string };

      // Security: Prevent path traversal
      const safeFilename = filename.replace(/..\//g, '').replace(/\\/g, '');

      // Basic file extension check
      const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
      const hasAllowedExtension = allowedExtensions.some(ext =>
        safeFilename.toLowerCase().endsWith(ext)
      );

      if (!hasAllowedExtension) {
        return reply.code(403).send({
          success: false,
          error: 'File type not allowed'
        });
      }

      // In a real implementation, you would serve files from a secure storage
      // For now, we'll just return the filename
      return reply.send({
        success: true,
        data: {
          filename: safeFilename,
          url: `/uploads/${safeFilename}`
        }
      });
    }
  });

  console.log('✅ Student routes registered');
}, {
  name: 'student-routes'
});
