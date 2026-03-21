// ============================================================================
// Global Type Definitions
// ============================================================================

// ============================================================================
// User Types
// ============================================================================

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
}

export interface User {
  id: number;
  moodleUserId: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  profileImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface JwtPayload {
  userId: number;
  moodleUserId: number;
  username: string;
  email: string;
  role: UserRole;
  moodleToken?: string;
  iat?: number;
  exp?: number;
}

// ============================================================================
// Exam Types
// ============================================================================

export interface Exam {
  id: number;
  moodleCourseId: number;
  moodleCourseModuleId: number;
  examName: string;
  courseName?: string;
  durationMinutes: number;
  maxWarnings: number;
  questionPaperPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ExamAttemptStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  TERMINATED = 'terminated',
}

export interface ExamAttempt {
  id: number;
  userId: number;
  examId: number;
  moodleAttemptId?: number;
  status: ExamAttemptStatus;
  startedAt?: Date;
  submittedAt?: Date;
  submissionReason?: SubmissionReason;
  violationCount: number;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubmissionReason {
  MANUAL_SUBMIT = 'manual_submit',
  WARNING_LIMIT_REACHED = 'warning_limit_reached',
  TIME_EXPIRED = 'time_expired',
  TERMINATED = 'terminated',
}

// ============================================================================
// Violation Types
// ============================================================================

export enum ViolationType {
  FACE_ABSENT = 'face_absent',
  MULTIPLE_FACES = 'multiple_faces',
  GAZE_AWAY = 'gaze_away',
  PHONE_DETECTED = 'phone_detected',
  OBJECT_DETECTED = 'object_detected',
  TAB_SWITCH = 'tab_switch',
  AUDIO_DETECTED = 'audio_detected',
  BACKGROUND_MOTION = 'background_motion',
  POOR_LIGHTING = 'poor_lighting',
  IDENTITY_MISMATCH = 'identity_mismatch',
}

export enum ViolationSeverity {
  INFO = 'info',
  WARNING = 'warning',
}

export interface Violation {
  id: number;
  attemptId: number;
  violationType: string;
  severity: ViolationSeverity;
  detail?: string;
  occurredAt: Date;
  frameSnapshotPath?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// Proctoring Session Types
// ============================================================================

export interface ProctoringSession {
  id: number;
  attemptId: number;
  sessionStart: Date;
  sessionEnd?: Date;
  framesProcessed: number;
  aiServiceConnected: boolean;
  connectionErrors: number;
  clientInfo?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  user: User;
}

export interface ExamStartRequest {
  examId: number;
}

export interface ExamSubmitRequest {
  reason?: SubmissionReason;
}

export interface ViolationReportRequest {
  attemptId: number;
  violationType: ViolationType;
  severity: ViolationSeverity;
  detail?: string;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export interface WebSocketMessage {
  type: 'connection' | 'frame' | 'violation' | 'error' | 'ping' | 'pong';
  sessionId?: string;
  attemptId?: number;
  timestamp: number;
  [key: string]: unknown;
}

export interface FrameMessage extends WebSocketMessage {
  type: 'frame';
  sessionId: string;
  attemptId: number;
  frameData: string; // base64 encoded JPEG
  sequence: number;
  signature?: string;
}

export interface ViolationMessage extends WebSocketMessage {
  type: 'violation';
  sessionId: string;
  attemptId: number;
  violations: ViolationData[];
  aiMetadata?: AIMetadata;
  signature?: string;
}

export interface ViolationData {
  violationType: ViolationType;
  severity: ViolationSeverity;
  detail: string;
  confidence?: number;
  timestamp: number;
  frameSequence: number;
}

export interface AIMetadata {
  model: string;
  fps: number;
  processingTime: number;
}

// ============================================================================
// Fastify Augmentations
// ============================================================================

import { FastifyRequest } from 'fastify';
import { User as FastifyUser } from '@fastify/jwt';

declare module 'fastify' {
  interface Request {
    user?: User;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: User;
  }
}
