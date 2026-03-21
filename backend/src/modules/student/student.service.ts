// ============================================================================
// Student Module - Service Layer
// Business logic for student operations
// ============================================================================

import { Pool } from 'pg';
import type {
  StudentProfile,
  StudentAttempt,
  StudentProfileResponse,
  SessionValidationResponse
} from './student.schema';
import type {
  StudentProfileRow,
  AttemptWithExamRow,
  SessionRow
} from './student.schema';

export class StudentService {
  constructor(private pg: Pool) {}

  /**
   * Get student profile with active attempt and recent attempts
   */
  async getStudentProfile(userId: number): Promise<StudentProfileResponse> {
    // Get student profile
    const profileResult = await this.pg.query<StudentProfileRow>(
      `SELECT
        id, moodle_user_id, username, email, first_name, last_name, role,
        profile_image_url, created_at, last_login_at
      FROM users
      WHERE id = $1 AND role = 'student'`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      throw new Error('Student not found');
    }

    const row = profileResult.rows[0];
    const student: StudentProfile = {
      id: row.id,
      moodleUserId: row.moodle_user_id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role as 'student' | 'teacher',
      profileImageUrl: row.profile_image_url,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at
    };

    // Get active attempt (in_progress)
    const activeAttemptResult = await this.pg.query<AttemptWithExamRow>(
      `SELECT
        ea.id, ea.exam_id, e.exam_name, e.course_name, ea.status,
        ea.started_at, ea.submitted_at, ea.violation_count,
        e.duration_minutes, e.max_warnings
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      WHERE ea.user_id = $1 AND ea.status = 'in_progress'
      ORDER BY ea.created_at DESC
      LIMIT 1`,
      [userId]
    );

    const activeAttempt = activeAttemptResult.rows.length > 0
      ? this.mapAttemptRow(activeAttemptResult.rows[0])
      : null;

    // Get recent attempts (last 5)
    const recentAttemptsResult = await this.pg.query<AttemptWithExamRow>(
      `SELECT
        ea.id, ea.exam_id, e.exam_name, e.course_name, ea.status,
        ea.started_at, ea.submitted_at, ea.violation_count,
        e.duration_minutes, e.max_warnings
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      WHERE ea.user_id = $1 AND ea.status != 'not_started'
      ORDER BY ea.created_at DESC
      LIMIT 5`,
      [userId]
    );

    const recentAttempts = recentAttemptsResult.rows.map(this.mapAttemptRow);

    return {
      success: true,
      data: {
        student,
        activeAttempt,
        recentAttempts
      }
    };
  }

  /**
   * Validate a proctoring session
   */
  async validateSession(_sessionId: string, attemptId: number, userId: number): Promise<SessionValidationResponse> {
    // First verify the attempt belongs to the user
    const attemptResult = await this.pg.query<{ id: number }>(
      'SELECT id FROM exam_attempts WHERE id = $1 AND user_id = $2',
      [attemptId, userId]
    );

    if (attemptResult.rows.length === 0) {
      return {
        success: true,
        data: {
          valid: false,
          session: null
        }
      };
    }

    // Get session details
    const sessionResult = await this.pg.query<SessionRow>(
      `SELECT
        id, attempt_id, session_start, frames_processed, ai_service_connected
      FROM proctoring_sessions
      WHERE attempt_id = $1
      ORDER BY session_start DESC
      LIMIT 1`,
      [attemptId]
    );

    if (sessionResult.rows.length === 0) {
      return {
        success: true,
        data: {
          valid: true,
          session: null
        }
      };
    }

    const row = sessionResult.rows[0];

    return {
      success: true,
      data: {
        valid: true,
        session: {
          id: row.id,
          attemptId: row.attempt_id,
          sessionStart: row.session_start,
          framesProcessed: row.frames_processed,
          aiServiceConnected: row.ai_service_connected
        }
      }
    };
  }

  /**
   * Check if student can start a new exam
   */
  async canStartExam(userId: number, examId: number): Promise<{ allowed: boolean; reason?: string }> {
    // Check if exam exists
    const examResult = await this.pg.query<{ id: number }>(
      'SELECT id FROM exams WHERE id = $1',
      [examId]
    );

    if (examResult.rows.length === 0) {
      return { allowed: false, reason: 'Exam not found' };
    }

    // Check for existing in_progress attempt
    const existingResult = await this.pg.query<{ id: number; status: string }>(
      `SELECT id, status FROM exam_attempts
      WHERE user_id = $1 AND exam_id = $2
      ORDER BY created_at DESC
      LIMIT 1`,
      [userId, examId]
    );

    if (existingResult.rows.length > 0) {
      const attempt = existingResult.rows[0];
      if (attempt.status === 'in_progress') {
        return { allowed: false, reason: 'Exam already in progress' };
      }
      // Can re-attempt if submitted or terminated
    }

    return { allowed: true };
  }

  /**
   * Map database row to StudentAttempt
   */
  private mapAttemptRow(row: AttemptWithExamRow): StudentAttempt {
    return {
      id: row.id,
      examId: row.exam_id,
      examName: row.exam_name,
      courseName: row.course_name,
      status: row.status as StudentAttempt['status'],
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      violationCount: row.violation_count,
      durationMinutes: row.duration_minutes,
      maxWarnings: row.max_warnings
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createStudentService(pg: Pool): StudentService {
  return new StudentService(pg);
}
