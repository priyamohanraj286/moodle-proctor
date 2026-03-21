-- ============================================================================
-- Moodle-Proctor Database Schema
-- Performance Indexes - Migration 002
-- ============================================================================

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_moodle_id ON users(moodle_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Exams table indexes
CREATE INDEX IF NOT EXISTS idx_exams_course_id ON exams(moodle_course_id);
CREATE INDEX IF NOT EXISTS idx_exams_module_id ON exams(moodle_course_module_id);

-- Exam attempts table indexes
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_created_at ON exam_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_exam ON exam_attempts(user_id, exam_id);

-- Violations table indexes
CREATE INDEX IF NOT EXISTS idx_violations_attempt_id ON violations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_violations_occurred_at ON violations(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_type ON violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_attempt_type ON violations(attempt_id, violation_type);

-- Proctoring sessions table indexes
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_attempt_id ON proctoring_sessions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_start ON proctoring_sessions(session_start DESC);

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================================

-- For fetching student's attempts with exam details
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_status ON exam_attempts(user_id, status, created_at DESC);

-- For fetching violations for an attempt ordered by time
CREATE INDEX IF NOT EXISTS idx_violations_attempt_time ON violations(attempt_id, occurred_at DESC);

-- For audit log queries by user and action
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);
