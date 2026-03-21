// ============================================================================
// Exam Module - Schema & Types
// ============================================================================

// ============================================================================
// Request Types
// ============================================================================

export interface ExamStartRequest {
  examId: number;
}

export interface ExamSubmitRequest {
  attemptId: number;
  answers: Record<string, unknown>;
  submissionReason?: 'manual_submit' | 'warning_limit_reached' | 'time_expired';
}

export interface ExamResumeRequest {
  attemptId: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface ExamDetails {
  id: number;
  moodleCourseId: number;
  moodleCourseModuleId: number;
  examName: string;
  courseName: string;
  durationMinutes: number;
  maxWarnings: number;
  questionPaperPath: string | null;
}

export interface ExamDetailsResponse {
  success: true;
  data: {
    exam: ExamDetails;
    userAccess: {
      canStart: boolean;
      reason?: string;
      hasActiveAttempt: boolean;
      attemptsRemaining: number;
    };
  };
}

export interface ExamAttempt {
  id: number;
  examId: number;
  userId: number;
  status: 'not_started' | 'in_progress' | 'submitted' | 'terminated';
  startedAt: Date | null;
  submittedAt: Date | null;
  violationCount: number;
  submissionReason: string | null;
}

export interface ExamAttemptResponse {
  success: true;
  data: {
    attempt: ExamAttempt;
    exam: ExamDetails;
  };
}

export interface ExamSubmitResponse {
  success: true;
  data: {
    attempt: ExamAttempt;
    submitted: boolean;
  };
}

export interface QuestionSummary {
  id: number;
  questionNumber: number;
  text: string;
  type: string;
  marks: number;
}

export interface QuestionsSummaryResponse {
  success: true;
  data: {
    examId: number;
    examName: string;
    totalQuestions: number;
    totalMarks: number;
    questions: QuestionSummary[];
  };
}

// ============================================================================
// Database Row Types
// ============================================================================

export interface ExamRow {
  id: number;
  moodle_course_id: number;
  moodle_course_module_id: number;
  exam_name: string;
  course_name: string;
  duration_minutes: number;
  max_warnings: number;
  question_paper_path: string;
}

export interface AttemptRow {
  id: number;
  exam_id: number;
  user_id: number;
  moodle_attempt_id: number;
  status: string;
  started_at: Date;
  submitted_at: Date;
  submission_reason: string;
  violation_count: number;
  ip_address: string;
  user_agent: string;
  device_info: Record<string, unknown>;
}
