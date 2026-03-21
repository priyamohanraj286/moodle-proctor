// ============================================================================
// Violation Module - Routes
// API endpoints for violation operations
// ============================================================================

import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { createViolationService } from './violation.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import type { ReportViolationRequest } from './violation.schema';

// ============================================================================
// Routes Plugin
// ============================================================================

export default fp(async (fastify: FastifyInstance) => {
  const violationService = createViolationService(fastify.pg as any);

  // ==========================================================================
  // POST /api/exam/violations - Report a violation
  // ==========================================================================

  fastify.post('/api/exam/violations', {
    onRequest: [authMiddleware], // TODO: Add role check middleware and rate limiting
    config: {
      rateLimit: {
        limit: 100, // 100 violations per minute per user
        window: 60000
      }
    },
    schema: {
      body: {
        type: 'object',
        properties: {
          attemptId: { type: 'number' },
          violationType: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning'], default: 'warning' },
          detail: { type: 'string' },
          metadata: { type: 'object' },
          frameSnapshot: { type: 'string' }, // Base64
          integrityHash: { type: 'string' },
          aiSignature: { type: 'string' },
          clientIp: { type: 'string' },
          sessionId: { type: 'string' },
          timestamp: { type: 'number' }
        },
        required: ['attemptId', 'violationType']
      }
    },
    handler: async (request, reply) => {
      // @ts-ignore
      const userId = request.user.id;
      const body = request.body as ReportViolationRequest;

      // Get signature service from fastify decoration
      // @ts-ignore
      const signatureService = fastify.security?.signatureService;

      try {
        const result = await violationService.recordViolation(body, userId, signatureService);

        // If auto-submit was triggered, return special status
        if (result.data.shouldAutoSubmit) {
          return reply.code(200).send({
            ...result,
            message: 'Auto-submit threshold reached - exam submitted automatically'
          });
        }

        return reply.code(201).send(result);
      } catch (error) {
        const message = (error as Error).message;
        if (message === 'Attempt not found') {
          return reply.code(404).send({
            success: false,
            error: 'Exam attempt not found'
          });
        }
        if (message === 'Access denied') {
          return reply.code(403).send({
            success: false,
            error: 'You do not have permission to record violations for this attempt'
          });
        }
        if (message.includes('Cannot record violation')) {
          return reply.code(400).send({
            success: false,
            error: message
          });
        }
        throw error;
      }
    }
  });

  // ==========================================================================
  // GET /api/exam/:attemptId/violations - Get violations for an attempt
  // ==========================================================================

  fastify.get('/api/exam/:attemptId/violations', {
    onRequest: [authMiddleware],
    schema: {
      params: {
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
      const { attemptId } = request.params as { attemptId: number };

      try {
        const result = await violationService.getViolations(attemptId, userId);
        return reply.send(result);
      } catch (error) {
        const message = (error as Error).message;
        if (message === 'Attempt not found') {
          return reply.code(404).send({
            success: false,
            error: 'Exam attempt not found'
          });
        }
        if (message === 'Access denied') {
          return reply.code(403).send({
            success: false,
            error: 'You do not have permission to view violations for this attempt'
          });
        }
        throw error;
      }
    }
  });

  // ==========================================================================
  // GET /api/exam/:attemptId/violations/check - Check violation count
  // ==========================================================================

  fastify.get('/api/exam/:attemptId/violations/check', {
    onRequest: [authMiddleware],
    schema: {
      params: {
        type: 'object',
        properties: {
          attemptId: { type: 'number' }
        },
        required: ['attemptId']
      }
    },
    handler: async (request, reply) => {
      const { attemptId } = request.params as { attemptId: number };

      const result = await violationService.checkViolationCount(attemptId);
      return reply.send(result);
    }
  });

  console.log('✅ Violation routes registered');
}, {
  name: 'violation-routes'
});
