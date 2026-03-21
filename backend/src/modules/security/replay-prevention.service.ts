// ============================================================================
// Replay Prevention Service
// Track frame sequence numbers with TTL to prevent replay attacks
// ============================================================================

// ============================================================================
// Types
// ============================================================================

interface FrameRecord {
  sequence: number;
  timestamp: number;
  sessionId: string;
}

interface SessionState {
  lastSequence: number;
  lastSeen: number;
  frameCount: number;
}

// ============================================================================
// Replay Prevention Service
// ============================================================================

export class ReplayPreventionService {
  // In-memory storage (use Redis in production for distributed systems)
  private readonly frames = new Map<string, FrameRecord>();
  private readonly sessions = new Map<string, SessionState>();

  // Configuration
  private readonly maxFrames: number; // Maximum frames to track per session
  private readonly sessionTimeout: number; // Session timeout in milliseconds
  private readonly cleanupInterval: number; // Cleanup interval in milliseconds
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(maxFrames: number = 1000, sessionTimeout: number = 300000) {
    this.maxFrames = maxFrames;
    this.sessionTimeout = sessionTimeout;
    this.cleanupInterval = 60000; // Cleanup every minute

    // Start automatic cleanup
    this.startCleanup();
  }

  /**
   * Track a frame and check if it's a replay attack
   * @param sessionId - WebSocket session ID
   * @param sequence - Frame sequence number
   * @param timestamp - Frame timestamp in milliseconds
   * @returns true if frame is accepted (not a replay), false if rejected
   */
  trackFrame(sessionId: string, sequence: number, timestamp: number): boolean {
    const frameKey = `${sessionId}:${sequence}`;
    const now = Date.now();

    // Check if frame was already seen
    if (this.frames.has(frameKey)) {
      console.warn(`[Replay Prevention] Duplicate frame detected: ${frameKey}`);
      return false; // Replay attack detected
    }

    // Get or create session state
    let sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      sessionState = {
        lastSequence: -1,
        lastSeen: now,
        frameCount: 0
      };
      this.sessions.set(sessionId, sessionState);
    }

    // Update session last seen time
    sessionState.lastSeen = now;
    sessionState.frameCount++;

    // Check for out-of-order frames (allow some gap for network reordering)
    const maxGap = 10; // Allow frames to arrive up to 10 positions out of order
    if (sequence > 0 && sequence < sessionState.lastSequence - maxGap) {
      // Frame is too old, might be a replay
      console.warn(
        `[Replay Prevention] Old frame detected: ${sequence} ` +
        `(last seen: ${sessionState.lastSequence})`
      );
      return false;
    }

    // Update last sequence if this is newer
    if (sequence > sessionState.lastSequence) {
      sessionState.lastSequence = sequence;
    }

    // Store frame record
    this.frames.set(frameKey, {
      sequence,
      timestamp,
      sessionId
    });

    // Enforce max frames limit (FIFO eviction)
    if (this.frames.size > this.maxFrames) {
      this.evictOldestFrames();
    }

    return true;
  }

  /**
   * Check if a sequence number has been used
   * @param sessionId - WebSocket session ID
   * @param sequence - Frame sequence number
   * @returns true if sequence was already used
   */
  isSequenceUsed(sessionId: string, sequence: number): boolean {
    const frameKey = `${sessionId}:${sequence}`;
    return this.frames.has(frameKey);
  }

  /**
   * Get session state
   * @param sessionId - WebSocket session ID
   * @returns Session state or undefined
   */
  getSessionState(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Clean up session data when session ends
   * @param sessionId - WebSocket session ID
   */
  cleanup(sessionId: string): void {
    // Remove all frames for this session
    const keysToDelete: string[] = [];
    for (const key of this.frames.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.frames.delete(key));

    // Remove session state
    this.sessions.delete(sessionId);

    console.log(`[Replay Prevention] Cleaned up session: ${sessionId} ` +
      `(removed ${keysToDelete.length} frame records)`);
  }

  /**
   * Clean up expired frames and sessions
   */
  cleanupExpired(): void {
    const now = Date.now();
    let framesRemoved = 0;
    let sessionsRemoved = 0;

    // Remove expired frames (older than session timeout)
    const frameKeysToDelete: string[] = [];
    for (const [key, record] of this.frames.entries()) {
      const age = now - record.timestamp;
      if (age > this.sessionTimeout) {
        frameKeysToDelete.push(key);
      }
    }
    frameKeysToDelete.forEach(key => this.frames.delete(key));
    framesRemoved = frameKeysToDelete.length;

    // Remove expired sessions
    const sessionIdsToDelete: string[] = [];
    for (const [sessionId, state] of this.sessions.entries()) {
      const age = now - state.lastSeen;
      if (age > this.sessionTimeout) {
        sessionIdsToDelete.push(sessionId);
      }
    }
    sessionIdsToDelete.forEach(id => {
      this.cleanup(id);
      sessionsRemoved++;
    });

    if (framesRemoved > 0 || sessionsRemoved > 0) {
      console.log(`[Replay Prevention] Cleanup: removed ${framesRemoved} frames, ` +
        `${sessionsRemoved} expired sessions`);
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
   * Evict oldest frames when limit is reached
   */
  private evictOldestFrames(): void {
    // Sort frames by timestamp and remove oldest
    const sortedFrames = Array.from(this.frames.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = sortedFrames.slice(0, Math.floor(this.maxFrames * 0.1)); // Remove 10%

    toRemove.forEach(([key]) => {
      this.frames.delete(key);
    });
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalFrames: number;
    activeSessions: number;
    maxFrames: number;
    currentUsage: number;
  } {
    return {
      totalFrames: this.frames.size,
      activeSessions: this.sessions.size,
      maxFrames: this.maxFrames,
      currentUsage: this.frames.size / this.maxFrames
    };
  }

  /**
   * Reset all state (useful for testing)
   */
  reset(): void {
    this.frames.clear();
    this.sessions.clear();
  }
}

// ============================================================================
// Factory
// ============================================================================

let replayPreventionInstance: ReplayPreventionService | null = null;

export function createReplayPreventionService(): ReplayPreventionService {
  const maxFrames = parseInt(process.env.REPLAY_PREVENTION_MAX_FRAMES || '1000', 10);

  if (!replayPreventionInstance) {
    replayPreventionInstance = new ReplayPreventionService(maxFrames);
  }

  return replayPreventionInstance;
}

export function getReplayPreventionService(): ReplayPreventionService {
  if (!replayPreventionInstance) {
    return createReplayPreventionService();
  }
  return replayPreventionInstance;
}
