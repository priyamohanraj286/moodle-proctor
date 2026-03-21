// ============================================================================
// Rate Limiter Service
// Sliding window rate limiting to prevent abuse
// ============================================================================

// ============================================================================
// Types
// ============================================================================

interface RateLimitRecord {
  count: number;
  windowStart: number;
  lastReset: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until retry
}

// ============================================================================
// Rate Limiter Service
// ============================================================================

export class RateLimiterService {
  // In-memory storage (use Redis in production for distributed systems)
  private readonly records = new Map<string, RateLimitRecord>();

  // Configuration
  private readonly defaultLimit: number;
  private readonly defaultWindow: number; // Window in milliseconds
  private readonly cleanupInterval: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(defaultLimit: number = 60, defaultWindow: number = 60000) {
    this.defaultLimit = defaultLimit;
    this.defaultWindow = defaultWindow;
    this.cleanupInterval = 60000; // Cleanup every minute

    // Start automatic cleanup
    this.startCleanup();
  }

  /**
   * Check if a request is allowed under rate limit
   * @param key - Unique identifier (user ID, IP address, etc.)
   * @param limit - Maximum requests allowed (optional, uses default)
   * @param window - Time window in milliseconds (optional, uses default)
   * @returns Rate limit result
   */
  async checkLimit(
    key: string,
    limit?: number,
    window?: number
  ): Promise<RateLimitResult> {
    const maxRequests = limit ?? this.defaultLimit;
    const windowMs = window ?? this.defaultWindow;
    const now = Date.now();

    // Get or create record
    let record = this.records.get(key);

    if (!record) {
      // First request
      record = {
        count: 1,
        windowStart: now,
        lastReset: now
      };
      this.records.set(key, record);

      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        resetAt: new Date(now + windowMs)
      };
    }

    // Check if window has expired
    const windowElapsed = now - record.windowStart;
    if (windowElapsed >= windowMs) {
      // Reset window
      record.count = 1;
      record.windowStart = now;
      record.lastReset = now;

      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        resetAt: new Date(now + windowMs)
      };
    }

    // Check if limit exceeded
    if (record.count >= maxRequests) {
      const resetIn = record.windowStart + windowMs - now;
      const retryAfterSeconds = Math.ceil(resetIn / 1000);

      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetAt: new Date(record.windowStart + windowMs),
        retryAfter: retryAfterSeconds
      };
    }

    // Increment counter
    record.count++;

    const remaining = maxRequests - record.count;

    return {
      allowed: true,
      limit: maxRequests,
      remaining,
      resetAt: new Date(record.windowStart + windowMs)
    };
  }

  /**
   * Reset rate limit for a key
   * @param key - Unique identifier to reset
   */
  reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * Get current rate limit status
   * @param key - Unique identifier
   * @returns Current count and limit info
   */
  getStatus(key: string): { count: number; windowStart: number } | undefined {
    const record = this.records.get(key);
    if (!record) {
      return undefined;
    }

    return {
      count: record.count,
      windowStart: record.windowStart
    };
  }

  /**
   * Clean up expired records
   */
  cleanupExpired(): void {
    const now = Date.now();
    const windowMs = this.defaultWindow;

    let removed = 0;
    for (const [key, record] of this.records.entries()) {
      const windowElapsed = now - record.windowStart;
      // Remove records that are 2x past their window (cleanup grace period)
      if (windowElapsed >= windowMs * 2) {
        this.records.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Rate Limiter] Cleaned up ${removed} expired records`);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupInterval);

    // Don't block process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalKeys: number;
    defaultLimit: number;
    defaultWindow: number;
  } {
    return {
      totalKeys: this.records.size,
      defaultLimit: this.defaultLimit,
      defaultWindow: this.defaultWindow
    };
  }

  /**
   * Reset all state (useful for testing)
   */
  resetAll(): void {
    this.records.clear();
  }
}

// ============================================================================
// Fastify Plugin for Route-Level Rate Limiting
// ============================================================================

import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';

export interface RateLimitOptions {
  limit?: number;
  window?: number;
  keyGenerator?: (request: FastifyRequest) => string | Promise<string>;
  skipOnError?: boolean;
}

export function createRateLimitPlugin(options: RateLimitOptions = {}) {
  const rateLimiter = new RateLimiterService();

  return fp(async (fastify: any) => {
    fastify.decorateRequest('rateLimit', {
      getter() {
        return async (customOptions?: RateLimitOptions) => {
          const opts = { ...options, ...customOptions };
          const limit = opts.limit ?? rateLimiter['defaultLimit'];
          const window = opts.window ?? rateLimiter['defaultWindow'];

          // Generate key
          const key = opts.keyGenerator
            ? await opts.keyGenerator(this)
            : generateDefaultKey(this);

          // Check limit
          const result = await rateLimiter.checkLimit(key, limit, window);

          // Add rate limit headers
          if (this.raw) {
            this.raw.setHeader('X-RateLimit-Limit', result.limit.toString());
            this.raw.setHeader('X-RateLimit-Remaining', result.remaining.toString());
            this.raw.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
          }

          // Return result
          return result;
        };
      }
    });

    // Hook to check rate limit before route handler
    fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      // @ts-ignore - rateLimit is decorated by this plugin
      const routeOptions = request.routeOptions?.config?.rateLimit as RateLimitOptions;

      if (!routeOptions) {
        return; // No rate limit configured for this route
      }

      try {
        // @ts-ignore
        const result = await request.rateLimit(routeOptions);

        if (!result.allowed) {
          reply.code(429).send({
            error: 'Too many requests',
            retryAfter: result.retryAfter,
            resetAt: result.resetAt
          });
          return reply;
        }
      } catch (error) {
        if (!options.skipOnError) {
          throw error;
        }
      }
    });
  });
}

/**
 * Generate default rate limit key from request
 */
function generateDefaultKey(request: FastifyRequest): string {
  // Try to use user ID from JWT
  // @ts-ignore
  const userId = request.user?.id;
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const ip = request.ip;
  return `ip:${ip}`;
}

// ============================================================================
// Factory
// ============================================================================

let rateLimiterInstance: RateLimiterService | null = null;

export function createRateLimiterService(): RateLimiterService {
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10);

  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiterService(maxRequests, windowMs);
  }

  return rateLimiterInstance;
}

export function getRateLimiterService(): RateLimiterService {
  if (!rateLimiterInstance) {
    return createRateLimiterService();
  }
  return rateLimiterInstance;
}
