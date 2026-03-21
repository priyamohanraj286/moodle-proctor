// ============================================================================
// Security Module
// Exports all security services and registers as Fastify plugin
// ============================================================================

import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import {
  SignatureService,
  createSignatureService,
  getSignatureService
} from './signature.service';
import {
  ReplayPreventionService,
  createReplayPreventionService,
  getReplayPreventionService
} from './replay-prevention.service';
import {
  RateLimiterService,
  createRateLimiterService,
  getRateLimiterService,
  createRateLimitPlugin
} from './rate-limiter.service';
import type {
  SignedFrame,
  SignatureMetadata
} from './signature.service';

// Re-export services
export {
  SignatureService,
  createSignatureService,
  getSignatureService,
  ReplayPreventionService,
  createReplayPreventionService,
  getReplayPreventionService,
  RateLimiterService,
  createRateLimiterService,
  getRateLimiterService,
  createRateLimitPlugin
};

export type {
  SignedFrame,
  SignatureMetadata
};

// ============================================================================
// Fastify Plugin
// ============================================================================

export interface SecurityServices {
  signatureService: SignatureService;
  replayPreventionService: ReplayPreventionService;
  rateLimiterService: RateLimiterService;
}

export default fp(async (fastify: FastifyInstance) => {
  // Initialize all security services
  const signatureService = createSignatureService();
  const replayPreventionService = createReplayPreventionService();
  const rateLimiterService = createRateLimiterService();

  // Decorate fastify instance with security services
  fastify.decorate('security', {
    signatureService,
    replayPreventionService,
    rateLimiterService
  } as SecurityServices);

  // Add cleanup on close
  fastify.addHook('onClose', async () => {
    replayPreventionService.stopCleanup();
    rateLimiterService.stopCleanup();
  });

  console.log('✅ Security module loaded');
}, {
  name: 'security-module'
});
