import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const MANUAL_PROCTORING_HEADER = 'x-manual-proctoring-client';
export const MANUAL_PROCTORING_QUESTIONS = [
  {
    id: 1,
    question: 'What does IoT stand for?',
    options: [
      'Internet of Things',
      'Input Output Technology',
      'Internet Tool',
      'None'
    ]
  },
  {
    id: 2,
    question: 'Which protocol is used in IoT?',
    options: ['MQTT', 'HTTP', 'CoAP', 'All of the above']
  }
];

const MANUAL_PROCTORING_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads/manual-proctoring');
const MANUAL_PROCTORING_LOGS_DIR = path.resolve(process.cwd(), 'logs/manual-proctoring');
const MANUAL_PROCTORING_WARNING_LOG = path.join(MANUAL_PROCTORING_LOGS_DIR, 'warnings.log');
const MANUAL_SESSION_TTL_MS = 60 * 60 * 1000;
const MANUAL_EXAM_DURATION_SECONDS = 10 * 60;
const MANUAL_MAX_WARNINGS = 15;
const MANUAL_INTERNAL_USER_ID = 900001;

const manualStudent = {
  id: 'ST101',
  name: 'Test_User',
  email: 'user',
  exam: 'IoT Final Exam'
};

const demoUser = {
  email: 'user',
  password: 'password'
};

interface ManualSession {
  token: string;
  studentId: string;
  expiresAt: number;
}

interface ManualViolation {
  type: string;
  detail: string;
  severity: 'info' | 'warning';
  createdAt: number;
}

interface ManualAttemptState {
  id: number;
  status: 'not_started' | 'in_progress' | 'submitted';
  startedAt: number | null;
  submittedAt: number | null;
  submissionReason: string | null;
  violationCount: number;
  violations: ManualViolation[];
}

const sessions = new Map<string, ManualSession>();
const examAttempts = new Map<string, ManualAttemptState>();

export function ensureManualProctoringDirectories(): void {
  fs.mkdirSync(MANUAL_PROCTORING_UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(MANUAL_PROCTORING_LOGS_DIR, { recursive: true });
}

export function isManualProctoringRequest(request: { headers: Record<string, unknown> }): boolean {
  const headerValue = request.headers[MANUAL_PROCTORING_HEADER];
  if (Array.isArray(headerValue)) {
    return headerValue.some(value => String(value).toLowerCase() === '1' || String(value).toLowerCase() === 'true');
  }

  const normalized = String(headerValue || '').toLowerCase();
  return normalized === '1' || normalized === 'true';
}

export function validateManualCredentials(email: string, password: string): boolean {
  return email === demoUser.email && password === demoUser.password;
}

export function createManualSession(): ManualSession {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + MANUAL_SESSION_TTL_MS;

  const session: ManualSession = {
    token,
    studentId: manualStudent.id,
    expiresAt
  };

  sessions.set(token, session);
  return session;
}

export function getManualTokenFromRequest(request: { headers: Record<string, unknown> }): string | null {
  const authHeader = String(request.headers.authorization || '');

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
}

export function getManualSessionFromToken(token: string | null): ManualSession | null {
  if (!token) {
    return null;
  }

  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

export function destroyManualSession(token: string | null): void {
  if (token) {
    sessions.delete(token);
  }
}

export function getManualSessionFromRequest(request: { headers: Record<string, unknown> }): ManualSession | null {
  return getManualSessionFromToken(getManualTokenFromRequest(request));
}

export function getManualPublicStudentProfile(): {
  id: string;
  name: string;
  email: string;
  exam: string;
} {
  return {
    id: manualStudent.id,
    name: manualStudent.name,
    email: manualStudent.email,
    exam: manualStudent.exam
  };
}

export function getManualAuthUser(): {
  id: number;
  moodleUserId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student';
} {
  return {
    id: MANUAL_INTERNAL_USER_ID,
    moodleUserId: MANUAL_INTERNAL_USER_ID,
    username: manualStudent.email,
    email: manualStudent.email,
    firstName: 'Test',
    lastName: 'User',
    role: 'student'
  };
}

export function getManualExpiresAt(session: ManualSession): number {
  return session.expiresAt;
}

export function getManualQuestionPaperFilename(): string {
  return 'question-paper.pdf';
}

export function getManualQuestionPaperPath(filename: string): string {
  return path.join(MANUAL_PROCTORING_UPLOADS_DIR, path.basename(filename));
}

export function getManualExamSummary(): {
  timerSeconds: number;
  questionPaper: string;
  student: ReturnType<typeof getManualPublicStudentProfile>;
  attempt: ReturnType<typeof serializeAttempt>;
} {
  return {
    timerSeconds: MANUAL_EXAM_DURATION_SECONDS,
    questionPaper: getManualQuestionPaperFilename(),
    student: getManualPublicStudentProfile(),
    attempt: serializeAttempt(getAttemptForStudent(manualStudent.id))
  };
}

export function getLatestManualAttempt(): {
  attempt: ReturnType<typeof serializeAttempt>;
  examName: string;
  questionPaper: string;
} {
  return {
    attempt: serializeAttempt(getAttemptForStudent(manualStudent.id)),
    examName: manualStudent.exam,
    questionPaper: getManualQuestionPaperFilename()
  };
}

export function getFirstAvailableExamId(): number {
  return 1;
}

export function startManualExamAttempt(): {
  success: boolean;
  message?: string;
  attempt: ReturnType<typeof serializeAttempt>;
  statusCode: number;
} {
  const attempt = getAttemptForStudent(manualStudent.id);

  if (attempt.status === 'submitted') {
    return {
      success: false,
      message: 'This exam has already been submitted.',
      attempt: serializeAttempt(attempt),
      statusCode: 409
    };
  }

  if (attempt.status === 'not_started') {
    attempt.status = 'in_progress';
    attempt.startedAt = Date.now();
  }

  return {
    success: true,
    attempt: serializeAttempt(attempt),
    statusCode: 200
  };
}

export function recordManualViolation(type: string, detail: string, severityInput?: string): {
  success: boolean;
  message?: string;
  attempt: ReturnType<typeof serializeAttempt>;
  statusCode: number;
} {
  const attempt = getAttemptForStudent(manualStudent.id);
  const severity = normalizeSeverity(severityInput);

  if (attempt.status !== 'in_progress') {
    return {
      success: false,
      message: 'Cannot log violations before the exam starts or after it is submitted.',
      attempt: serializeAttempt(attempt),
      statusCode: 409
    };
  }

  const violation: ManualViolation = {
    type: type || 'unknown',
    detail: detail || '',
    severity,
    createdAt: Date.now()
  };

  attempt.violations.push(violation);
  appendManualWarningLog(getManualPublicStudentProfile(), violation);

  if (severity === 'warning') {
    attempt.violationCount += 1;
  }

  if (attempt.violationCount >= MANUAL_MAX_WARNINGS) {
    submitManualExamAttempt('warning_limit_reached');
  }

  return {
    success: true,
    message: attempt.status === 'submitted'
      ? `Exam terminated after reaching ${MANUAL_MAX_WARNINGS} warnings.`
      : undefined,
    attempt: serializeAttempt(attempt),
    statusCode: 200
  };
}

export function submitManualExamAttempt(reason?: string): {
  success: boolean;
  attempt: ReturnType<typeof serializeAttempt>;
} {
  const attempt = getAttemptForStudent(manualStudent.id);

  if (attempt.status !== 'submitted') {
    if (attempt.status === 'not_started') {
      attempt.startedAt = Date.now();
    }

    attempt.status = 'submitted';
    attempt.submittedAt = Date.now();
    attempt.submissionReason = reason || 'manual_submit';
  }

  return {
    success: true,
    attempt: serializeAttempt(attempt)
  };
}

export function buildManualStudent(): ReturnType<typeof getManualPublicStudentProfile> {
  return getManualPublicStudentProfile();
}

export function appendManualWarningLog(
  student: ReturnType<typeof getManualPublicStudentProfile>,
  violation: ManualViolation
): void {
  ensureManualProctoringDirectories();

  const timestamp = new Date(violation.createdAt).toISOString();
  const severity = normalizeSeverity(violation.severity).toUpperCase();
  const logEntry =
    `[${timestamp}] ${severity} studentId=${student.id} name="${student.name}" ` +
    `type=${violation.type} detail="${violation.detail || 'N/A'}"`;

  fs.appendFileSync(MANUAL_PROCTORING_WARNING_LOG, `${logEntry}\n`, 'utf8');
}

function getAttemptForStudent(studentId: string): ManualAttemptState {
  if (!examAttempts.has(studentId)) {
    examAttempts.set(studentId, {
      id: 1,
      status: 'not_started',
      startedAt: null,
      submittedAt: null,
      submissionReason: null,
      violationCount: 0,
      violations: []
    });
  }

  return examAttempts.get(studentId)!;
}

function serializeAttempt(attempt: ManualAttemptState): {
  id: number;
  status: string;
  startedAt: number | null;
  submittedAt: number | null;
  submissionReason: string | null;
  maxWarnings: number;
  canResume: boolean;
  violationCount: number;
  violations: ManualViolation[];
} {
  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    submissionReason: attempt.submissionReason,
    maxWarnings: MANUAL_MAX_WARNINGS,
    canResume: attempt.status === 'in_progress',
    violationCount: attempt.violationCount,
    violations: [...attempt.violations]
  };
}

function normalizeSeverity(value?: string): 'info' | 'warning' {
  return String(value || '').trim().toLowerCase() === 'info' ? 'info' : 'warning';
}
