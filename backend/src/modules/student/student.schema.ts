// ============================================================================
// Student Module - Schema & Types
// ============================================================================

// ============================================================================
// Request/Response Types
// ============================================================================

export interface StudentProfile {
  id: number;
  moodleUserId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'teacher';
  profileImageUrl: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface StudentAttempt {
  id: number;
  examId: number;
  examName: string;
  courseName: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'terminated';
  startedAt: Date | null;
  submittedAt: Date | null;
  violationCount: number;
  durationMinutes: number;
  maxWarnings: number;
}

export interface StudentProfileResponse {
  success: true;
  data: {
    student: StudentProfile;
    activeAttempt: StudentAttempt | null;
    recentAttempts: StudentAttempt[];
  };
}

export interface SessionValidationRequest {
  sessionId: string;
  attemptId: number;
}

export interface SessionValidationResponse {
  success: true;
  data: {
    valid: boolean;
    session: {
      id: number;
      attemptId: number;
      sessionStart: Date;
      framesProcessed: number;
      aiServiceConnected: boolean;
    } | null;
  };
}

// ============================================================================
// Database Query Result Types
// ============================================================================

export interface StudentProfileRow {
  id: number;
  moodle_user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  profile_image_url: string | null;
  created_at: Date;
  last_login_at: Date | null;
}

export interface AttemptWithExamRow {
  id: number;
  exam_id: number;
  exam_name: string;
  course_name: string;
  status: string;
  started_at: Date | null;
  submitted_at: Date | null;
  violation_count: number;
  duration_minutes: number;
  max_warnings: number;
}

export interface SessionRow {
  id: number;
  attempt_id: number;
  session_start: Date;
  frames_processed: number;
  ai_service_connected: boolean;
}
