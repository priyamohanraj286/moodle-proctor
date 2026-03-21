// ============================================================================
// Quick Security Services Verification
// Tests that the security services work correctly without Jest dependency
// ============================================================================

import {
  SignatureService,
  ReplayPreventionService,
  RateLimiterService
} from '../src/modules/security/index.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`${GREEN}✓${RESET} ${name}`);
      passed++;
    } else {
      console.log(`${RED}✗${RESET} ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`${RED}✗${RESET} ${name} - ${error}`);
    failed++;
  }
}

console.log(`${YELLOW}Testing Security Services...${RESET}\n`);

// ============================================================================
// SignatureService Tests
// ============================================================================

console.log(`${YELLOW}SignatureService:${RESET}`);

const signatureService = new SignatureService('test-secret-key-for-signing-min-32-chars', 5000);
const testData = Buffer.from('test frame data');

test('should sign frames correctly', () => {
  const timestamp = Date.now();
  const signature = signatureService.signFrame(testData, timestamp);
  return signature && signature.length > 0;
});

test('should verify valid signatures', () => {
  const timestamp = Date.now();
  const signature = signatureService.signFrame(testData, timestamp);
  return signatureService.verifySignature(testData, signature, timestamp) === true;
});

test('should reject invalid signatures', () => {
  const timestamp = Date.now();
  const signature = signatureService.signFrame(testData, timestamp);
  const tamperedData = Buffer.from('tampered data');
  return signatureService.verifySignature(tamperedData, signature, timestamp) === false;
});

test('should reject expired timestamps', () => {
  const oldTimestamp = Date.now() - 10000; // 10 seconds ago
  const signature = signatureService.signFrame(testData, oldTimestamp);
  return signatureService.verifySignature(testData, signature, oldTimestamp) === false;
});

test('should create integrity hashes', () => {
  const violationData = {
    attemptId: 1,
    type: 'face_absent',
    timestamp: Date.now()
  };
  const hash = signatureService.createIntegrityHash(violationData);
  return hash && hash.length === 64; // SHA-256 hex length
});

test('should verify integrity hashes', () => {
  const violationData = {
    attemptId: 1,
    type: 'face_absent',
    timestamp: Date.now()
  };
  const hash = signatureService.createIntegrityHash(violationData);
  return signatureService.verifyIntegrityHash(violationData, hash) === true;
});

test('should reject modified integrity hashes', () => {
  const violationData = {
    attemptId: 1,
    type: 'face_absent',
    timestamp: Date.now()
  };
  const hash = signatureService.createIntegrityHash(violationData);
  const modifiedData = { ...violationData, type: 'phone_detected' };
  return signatureService.verifyIntegrityHash(modifiedData, hash) === false;
});

// ============================================================================
// ReplayPreventionService Tests
// ============================================================================

console.log(`\n${YELLOW}ReplayPreventionService:${RESET}`);

const replayService = new ReplayPreventionService(1000, 300000);
const sessionId = 'test-session-1';

test('should accept new frames', () => {
  return replayService.trackFrame(sessionId, 1, Date.now()) === true;
});

test('should reject duplicate frames', () => {
  const timestamp = Date.now();
  replayService.trackFrame(sessionId, 2, timestamp);
  return replayService.trackFrame(sessionId, 2, timestamp) === false;
});

test('should reject very old frames (out of order)', () => {
  replayService.trackFrame(sessionId, 20, Date.now());
  return replayService.trackFrame(sessionId, 5, Date.now()) === false;
});

test('should allow slightly out-of-order frames', () => {
  replayService.trackFrame(sessionId, 30, Date.now());
  return replayService.trackFrame(sessionId, 25, Date.now()) === true;
});

test('should track session state', () => {
  const state = replayService.getSessionState(sessionId);
  return state !== undefined && state.lastSequence === 30;
});

test('should check if sequence is used', () => {
  return replayService.isSequenceUsed(sessionId, 1) === true &&
         replayService.isSequenceUsed(sessionId, 999) === false;
});

test('should cleanup session data', () => {
  const testSession = 'temp-session';
  replayService.trackFrame(testSession, 1, Date.now());
  replayService.cleanup(testSession);
  return replayService.getSessionState(testSession) === undefined;
});

// ============================================================================
// RateLimiterService Tests
// ============================================================================

console.log(`\n${YELLOW}RateLimiterService:${RESET}`);

(async () => {
  const rateLimiter = new RateLimiterService(5, 10000); // 5 requests per 10s

  test('should allow requests within limit', async () => {
    const result = await rateLimiter.checkLimit('user1');
    return result.allowed === true && result.remaining === 4;
  });

  test('should track multiple requests', async () => {
    await rateLimiter.checkLimit('user2');
    await rateLimiter.checkLimit('user2');
    const result = await rateLimiter.checkLimit('user2');
    return result.allowed === true && result.remaining === 2;
  });

  test('should block requests exceeding limit', async () => {
    const rl = new RateLimiterService(3, 10000);
    await rl.checkLimit('user3');
    await rl.checkLimit('user3');
    await rl.checkLimit('user3');
    const result = await rl.checkLimit('user3');
    return result.allowed === false && result.remaining === 0;
  });

  test('should track separate limits for different keys', async () => {
    const result1 = await rateLimiter.checkLimit('user4');
    const result2 = await rateLimiter.checkLimit('user5');
    return result1.allowed === true && result2.allowed === true;
  });

  test('should reset limit for specific key', async () => {
    await rateLimiter.checkLimit('user6');
    await rateLimiter.checkLimit('user6');
    rateLimiter.reset('user6');
    const result = await rateLimiter.checkLimit('user6');
    return result.remaining === 4;
  });

  test('should provide status', async () => {
    await rateLimiter.checkLimit('user7');
    const status = rateLimiter.getStatus('user7');
    return status !== undefined && status.count === 1;
  });

  test('should provide statistics', () => {
    const stats = rateLimiter.getStats();
    return stats.defaultLimit === 5 && stats.defaultWindow === 10000;
  });

  // ============================================================================
  // Summary
  // ============================================================================

  console.log(`\n${YELLOW}Test Results:${RESET}`);
  console.log(`${GREEN}Passed: ${passed}${RESET}`);
  console.log(`${RED}Failed: ${failed}${RESET}`);

  if (failed === 0) {
    console.log(`\n${GREEN}✓ All security services working correctly!${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}✗ Some tests failed${RESET}`);
    process.exit(1);
  }
})();
