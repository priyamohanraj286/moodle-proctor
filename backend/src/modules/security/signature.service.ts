// ============================================================================
// Signature Service
// HMAC-SHA256 signing for video frames to prevent tampering
// ============================================================================

import { createHash, createHmac, timingSafeEqual } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface SignedFrame {
  data: Buffer;
  signature: string;
  timestamp: number;
}

export interface SignatureMetadata {
  signature: string;
  timestamp: number;
  algorithm: 'sha256';
}

// ============================================================================
// Signature Service
// ============================================================================

export class SignatureService {
  private readonly secret: string;
  private readonly maxAge: number; // Maximum age of a signature in milliseconds
  private readonly algorithm = 'sha256';

  constructor(secret: string, maxAge: number = 5000) {
    if (!secret || secret.length < 32) {
      throw new Error('Signature secret must be at least 32 characters long');
    }
    this.secret = secret;
    this.maxAge = maxAge;
  }

  /**
   * Sign a frame's data with HMAC-SHA256
   * @param data - Raw frame data (buffer)
   * @param timestamp - Unix timestamp in milliseconds
   * @returns HMAC signature as hex string
   */
  signFrame(data: Buffer, timestamp: number): string {
    // Create payload: timestamp + data hash
    const dataHash = createHash(this.algorithm).update(data).digest('hex');
    const payload = `${timestamp}:${dataHash}`;

    // Sign with HMAC
    const hmac = createHmac(this.algorithm, this.secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Verify a frame's signature
   * @param data - Raw frame data (buffer)
   * @param signature - HMAC signature to verify
   * @param timestamp - Unix timestamp in milliseconds
   * @returns true if signature is valid and not expired
   */
  verifySignature(data: Buffer, signature: string, timestamp: number): boolean {
    // Check timestamp is not expired
    if (this.isExpired(timestamp)) {
      return false;
    }

    // Recreate signature
    const expectedSignature = this.signFrame(data, timestamp);

    // Use timing-safe comparison to prevent timing attacks
    try {
      return timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if a timestamp is expired
   * @param timestamp - Unix timestamp in milliseconds
   * @returns true if timestamp is too old
   */
  isExpired(timestamp: number): boolean {
    const now = Date.now();
    const age = now - timestamp;
    return age < 0 || age > this.maxAge;
  }

  /**
   * Sign a generic JSON payload
   * @param payload - Object to sign
   * @returns Signature metadata
   */
  signPayload(payload: Record<string, unknown>): SignatureMetadata {
    const timestamp = Date.now();
    const payloadString = JSON.stringify(payload);
    const dataBuffer = Buffer.from(payloadString, 'utf-8');

    return {
      signature: this.signFrame(dataBuffer, timestamp),
      timestamp,
      algorithm: this.algorithm
    };
  }

  /**
   * Verify a signed JSON payload
   * @param payload - Object that was signed
   * @param metadata - Signature metadata
   * @returns true if signature is valid
   */
  verifyPayload(payload: Record<string, unknown>, metadata: SignatureMetadata): boolean {
    const payloadString = JSON.stringify(payload);
    const dataBuffer = Buffer.from(payloadString, 'utf-8');
    return this.verifySignature(dataBuffer, metadata.signature, metadata.timestamp);
  }

  /**
   * Create integrity hash for violation data
   * @param violationData - Violation data to hash
   * @returns SHA-256 hash as hex string
   */
  createIntegrityHash(violationData: Record<string, unknown>): string {
    const normalized = JSON.stringify(violationData, Object.keys(violationData).sort());
    return createHash(this.algorithm).update(normalized).digest('hex');
  }

  /**
   * Verify integrity hash
   * @param violationData - Violation data to verify
   * @param hash - Hash to verify against
   * @returns true if hash matches
   */
  verifyIntegrityHash(violationData: Record<string, unknown>, hash: string): boolean {
    const expectedHash = this.createIntegrityHash(violationData);
    return expectedHash === hash;
  }

  /**
   * Generate a random signature for testing
   * @returns Random hex string
   */
  static generateMockSignature(): string {
    return Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

// ============================================================================
// Factory
// ============================================================================

let signatureServiceInstance: SignatureService | null = null;

export function createSignatureService(): SignatureService {
  const secret = process.env.FRAME_SIGNATURE_SECRET;
  const maxAge = parseInt(process.env.FRAME_SIGNATURE_MAX_AGE || '5000', 10);

  if (!secret) {
    throw new Error('FRAME_SIGNATURE_SECRET environment variable is required');
  }

  if (!signatureServiceInstance) {
    signatureServiceInstance = new SignatureService(secret, maxAge);
  }

  return signatureServiceInstance;
}

export function getSignatureService(): SignatureService {
  if (!signatureServiceInstance) {
    return createSignatureService();
  }
  return signatureServiceInstance;
}
