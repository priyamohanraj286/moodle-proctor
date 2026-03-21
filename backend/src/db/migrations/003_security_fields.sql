-- ============================================================================
-- Moodle-Proctor Database Schema
-- Security Fields - Migration 003
-- ============================================================================

-- ============================================================================
-- ADD SECURITY FIELDS TO VIOLATIONS TABLE
-- ============================================================================

-- Add integrity hash (SHA-256) for violation verification
ALTER TABLE violations ADD COLUMN IF NOT EXISTS integrity_hash TEXT;

-- Add AI service signature (HMAC-SHA256)
ALTER TABLE violations ADD COLUMN IF NOT EXISTS ai_signature TEXT;

-- Add client IP address
ALTER TABLE violations ADD COLUMN IF NOT EXISTS client_ip INET;

-- Add session ID for tracking
ALTER TABLE violations ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Set integrity_hash as NOT NULL with default for new rows
ALTER TABLE violations ALTER COLUMN integrity_hash SET NOT NULL;

-- ============================================================================
-- SECURITY INDEXES
-- ============================================================================

-- Index for integrity hash lookups (verification queries)
CREATE INDEX IF NOT EXISTS idx_violations_integrity_hash ON violations(integrity_hash);

-- Index for session ID lookups
CREATE INDEX IF NOT EXISTS idx_violations_session_id ON violations(session_id);

-- Index for AI signature verification
CREATE INDEX IF NOT EXISTS idx_violations_ai_signature ON violations(ai_signature);

-- ============================================================================
-- UNIQUE CONSTRAINT TO PREVENT DUPLICATE VIOLATIONS
-- ============================================================================

-- Prevent duplicate violations (same attempt, type, and timestamp)
-- This ensures integrity even if messages are replayed
CREATE UNIQUE INDEX IF NOT EXISTS idx_violations_unique_event
ON violations (attempt_id, violation_type, occurred_at)
WHERE integrity_hash IS NOT NULL;

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN violations.integrity_hash IS 'SHA-256 hash of violation data for integrity verification';
COMMENT ON COLUMN violations.ai_signature IS 'HMAC-SHA256 signature from AI service for authentication';
COMMENT ON COLUMN violations.client_ip IS 'Client IP address when violation was detected';
COMMENT ON COLUMN violations.session_id IS 'WebSocket session ID for the proctoring session';
