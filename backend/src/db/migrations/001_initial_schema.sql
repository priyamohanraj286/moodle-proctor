-- ============================================================================
-- Moodle-Proctor Database Schema
-- Initial Schema - Migration 001
-- ============================================================================

-- ============================================================================
-- USERS TABLE (Moodle user sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    moodle_user_id INTEGER UNIQUE NOT NULL,           -- Moodle user ID
    username VARCHAR(255) UNIQUE NOT NULL,            -- Moodle username
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    role VARCHAR(50) NOT NULL,                        -- 'student' | 'teacher'
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_role CHECK (role IN ('student', 'teacher'))
);

-- ============================================================================
-- EXAMS TABLE (Minimal exam metadata, fetch details from Moodle)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    moodle_course_id INTEGER NOT NULL,
    moodle_course_module_id INTEGER NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    course_name VARCHAR(255),
    duration_minutes INTEGER NOT NULL,
    max_warnings INTEGER DEFAULT 15,
    question_paper_path TEXT,                         -- Path to PDF
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(moodle_course_id, moodle_course_module_id)
);

-- ============================================================================
-- EXAM ATTEMPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    moodle_attempt_id INTEGER,                        -- Moodle quiz attempt ID

    -- Attempt status & timing
    status VARCHAR(50) NOT NULL DEFAULT 'not_started',
    started_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,

    -- Submission details
    submission_reason VARCHAR(100),                   -- 'manual_submit' | 'warning_limit_reached' | 'time_expired' | 'terminated'

    -- Violation tracking
    violation_count INTEGER DEFAULT 0,

    -- Additional metadata
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,                                -- Store browser/system info

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN (
        'not_started',
        'in_progress',
        'submitted',
        'terminated'
    ))
);

-- ============================================================================
-- VIOLATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS violations (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,

    -- Violation details
    violation_type VARCHAR(100) NOT NULL,             -- 'face_absent' | 'multiple_faces' | 'phone_detected' | etc.
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',  -- 'info' | 'warning'
    detail TEXT,                                      -- Human-readable description

    -- Timing
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Additional context
    frame_snapshot_path TEXT,                         -- Path to screenshot (if captured)
    metadata JSONB,                                   -- Store additional AI data

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning'))
);

-- ============================================================================
-- PROCTORING SESSIONS TABLE (WebSocket connections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proctoring_sessions (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,

    -- Session details
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    frames_processed INTEGER DEFAULT 0,

    -- AI service connection
    ai_service_connected BOOLEAN DEFAULT false,
    connection_errors INTEGER DEFAULT 0,

    -- Session metadata
    client_info JSONB,                                -- Browser info, camera details

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOG TABLE (Teacher actions, system events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,                     -- 'login' | 'logout' | 'exam_start' | 'exam_submit' | etc.
    resource_type VARCHAR(50),                        -- 'exam' | 'attempt' | 'user' | 'violation'
    resource_id INTEGER,
    details JSONB,                                    -- Action-specific data
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
