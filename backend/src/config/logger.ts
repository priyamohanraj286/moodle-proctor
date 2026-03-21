// ============================================================================
// Logger Configuration
// Winston logger for structured logging
// ============================================================================

import winston from 'winston';
import path from 'path';
import config from './index';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Tell winston about the colors
winston.addColors(colors);

// Define the format for logs
const format = winston.format.combine(
  // Add timestamp
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  // Add errors stack trace
  winston.format.errors({ stack: true }),
  // Format the JSON output
  winston.format.json()
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    ),
  }),
];

// Add file transports in production
if (config.nodeEnv === 'production') {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: path.join(config.upload.dir, '../logs/error.log'),
      level: 'error',
      format,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(config.upload.dir, '../logs/combined.log'),
      format,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: config.logLevel,
  levels,
  format,
  transports,
  exitOnError: false,
});

export default logger;
