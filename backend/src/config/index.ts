// ============================================================================
// Configuration Loader
// Loads and validates all environment variables
// ============================================================================

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Get environment variable or throw error if missing
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get integer environment variable
 */
function getIntEnvVar(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be an integer: ${value}`);
  }
  return parsed;
}

/**
 * Get boolean environment variable
 */
function getBoolEnvVar(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.toLowerCase() === 'true';
}

// ============================================================================
// Server Configuration
// ============================================================================

export const config = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  port: getIntEnvVar('PORT', 5000),
  logLevel: getEnvVar('LOG_LEVEL', 'info'),

  // Database
  database: {
    url: getEnvVar('DATABASE_URL'),
    poolMin: getIntEnvVar('DB_POOL_MIN', 2),
    poolMax: getIntEnvVar('DB_POOL_MAX', 10),
  },

  // Moodle
  moodle: {
    baseUrl: getEnvVar('MOODLE_BASE_URL').replace(/\/$/, ''), // Remove trailing slash
    serviceShortname: getEnvVar('MOODLE_SERVICE', 'moodle_mobile_app'),
  },

  // JWT
  jwt: {
    secret: getEnvVar('JWT_SECRET'),
    expiresIn: getEnvVar('JWT_EXPIRES_IN', '1h'),
    refreshExpiresIn: getEnvVar('JWT_REFRESH_EXPIRES_IN', '24h'),
  },

  // AI Service
  aiService: {
    url: getEnvVar('AI_SERVICE_URL', 'ws://localhost:8000/proctor'),
    timeout: getIntEnvVar('AI_SERVICE_TIMEOUT', 30000),
    sharedSecret: getEnvVar('AI_SERVICE_SHARED_SECRET', 'default-secret'),
  },

  // File Upload
  upload: {
    dir: getEnvVar('UPLOAD_DIR', './uploads'),
    maxFileSize: getIntEnvVar('MAX_FILE_SIZE', 10485760), // 10MB default
  },

  // CORS
  cors: {
    origin: getEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: getBoolEnvVar('CORS_CREDENTIALS', true),
  },

  // Security
  security: {
    rateLimitMax: getIntEnvVar('RATE_LIMIT_MAX', 60), // violations per minute
    rateLimitWindow: getIntEnvVar('RATE_LIMIT_WINDOW', 60000), // 1 minute
    replayPreventionMaxFrames: getIntEnvVar('REPLAY_PREVENTION_MAX_FRAMES', 1000),
  },

  // App info
  app: {
    name: 'Moodle-Proctor Backend',
    version: '1.0.0',
    environment: getEnvVar('NODE_ENV', 'development'),
  },
};

// Validate critical configuration
if (config.nodeEnv === 'production') {
  if (config.jwt.secret === 'your-super-secret-jwt-key-change-in-production' ||
      config.jwt.secret === 'change-this-secret-in-production-use-openssl-rand-hex-32') {
    throw new Error('JWT_SECRET must be changed in production');
  }
  if (config.aiService.sharedSecret === 'default-secret') {
    throw new Error('AI_SERVICE_SHARED_SECRET must be changed in production');
  }
}

export default config;
