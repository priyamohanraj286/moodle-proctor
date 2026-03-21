// ============================================================================
// JWT Token Service
// Handles JWT token generation and validation
// ============================================================================

import crypto from 'crypto';
import config from '../../config';
import logger from '../../config/logger';
import type { JwtPayload, User, UserRole } from '../../types';
import { UnauthorizedError } from '../../utils/errors';

// ============================================================================
// JWT Service
// ============================================================================

class JWTService {
  private secret: string;
  private expiresIn: string;
  private refreshExpiresIn: string;

  constructor() {
    this.secret = config.jwt.secret;
    this.expiresIn = config.jwt.expiresIn;
    this.refreshExpiresIn = config.jwt.refreshExpiresIn;
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user: User, moodleToken: string): string {
    try {
      // Encrypt Moodle token before embedding
      const encryptedMoodleToken = this.encryptMoodleToken(moodleToken);

      const payload: JwtPayload = {
        userId: user.id,
        moodleUserId: user.moodleUserId,
        username: user.username,
        email: user.email,
        role: user.role,
        // Include encrypted Moodle token
        moodleToken: encryptedMoodleToken,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.getExpirationSeconds(),
      };

      // For now, use a simple JWT-like implementation
      // In production, you might want to use jsonwebtoken or @fastify/jwt
      const token = this.encodeToken(payload);

      logger.info(`Generated JWT token for user ${user.username}`);
      return token;
    } catch (error) {
      logger.error('Failed to generate JWT token:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Validate and decode JWT token
   */
  validateToken(token: string): JwtPayload {
    try {
      const payload = this.decodeToken(token);

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new UnauthorizedError('Token has expired');
      }

      logger.debug(`Validated JWT token for user ${payload.username}`);
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      logger.error('Failed to validate JWT token:', error);
      throw new UnauthorizedError('Invalid token');
    }
  }

  /**
   * Refresh JWT token
   */
  refreshToken(token: string, moodleToken: string): string {
    try {
      const oldPayload = this.validateToken(token);

      // Create new payload with updated expiration
      const payload: JwtPayload = {
        ...oldPayload,
        moodleToken: this.encryptMoodleToken(moodleToken),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.getExpirationSeconds(),
      };

      const newToken = this.encodeToken(payload);

      logger.info(`Refreshed JWT token for user ${payload.username}`);
      return newToken;
    } catch (error) {
      logger.error('Failed to refresh JWT token:', error);
      throw new UnauthorizedError('Token refresh failed');
    }
  }

  /**
   * Encrypt Moodle token for storage in JWT
   * Uses AES-256-GCM encryption
   */
  private encryptMoodleToken(moodleToken: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(this.secret, 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);

      let encrypted = cipher.update(moodleToken, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Combine IV, auth tag, and encrypted data
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Failed to encrypt Moodle token:', error);
      throw new Error('Token encryption failed');
    }
  }

  /**
   * Decrypt Moodle token from JWT
   */
  decryptMoodleToken(encryptedToken: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(this.secret, 'salt', 32);

      const parts = encryptedToken.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt Moodle token:', error);
      throw new Error('Token decryption failed');
    }
  }

  /**
   * Simple JWT-like token encoding
   * In production, use jsonwebtoken library
   */
  private encodeToken(payload: JwtPayload): string {
    try {
      const header = {
        alg: 'HS256',
        typ: 'JWT',
      };

      const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
      const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

      const signatureData = `${encodedHeader}.${encodedPayload}`;
      const signature = crypto
        .createHmac('sha256', this.secret)
        .update(signatureData)
        .digest('hex');

      const encodedSignature = this.base64UrlEncode(signature);

      return `${signatureData}.${encodedSignature}`;
    } catch (error) {
      logger.error('Failed to encode token:', error);
      throw new Error('Token encoding failed');
    }
  }

  /**
   * Simple JWT-like token decoding
   * In production, use jsonwebtoken library
   */
  private decodeToken(token: string): JwtPayload {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      // Verify signature
      const signatureData = `${encodedHeader}.${encodedPayload}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(signatureData)
        .digest('hex');

      const decodedSignature = this.base64UrlDecode(encodedSignature);
      if (decodedSignature !== expectedSignature) {
        throw new Error('Invalid token signature');
      }

      // Decode payload
      const decodedPayload = this.base64UrlDecode(encodedPayload);
      return JSON.parse(decodedPayload) as JwtPayload;
    } catch (error) {
      logger.error('Failed to decode token:', error);
      throw new Error('Token decoding failed');
    }
  }

  /**
   * Base64 URL encode
   */
  private base64UrlEncode(data: string): string {
    return Buffer.from(data)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64 URL decode
   */
  private base64UrlDecode(data: string): string {
    // Add padding if needed
    const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  }

  /**
   * Get expiration time in seconds from expiresIn string
   */
  private getExpirationSeconds(): number {
    const match = this.expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiresIn format: ${this.expiresIn}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * multipliers[unit];
  }
}

// Export singleton instance
export default new JWTService();
