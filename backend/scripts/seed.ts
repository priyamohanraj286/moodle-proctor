// ============================================================================
// Database Seed Script
// Generates test data for development and testing
// ============================================================================

import { Client } from 'pg';

// ============================================================================
// Configuration
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://proctor_user:proctor_pass@localhost:5432/moodle_proctor';

// ============================================================================
// Seed Data
// ============================================================================

const DEMO_USERS = [
  {
    moodle_user_id: 100,
    username: 'teacher1',
    email: 'teacher1@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    role: 'teacher',
    profile_image_url: null
  },
  {
    moodle_user_id: 101,
    username: 'student1',
    email: 'student1@example.com',
    first_name: 'John',
    last_name: 'Doe',
    role: 'student',
    profile_image_url: null
  },
  {
    moodle_user_id: 102,
    username: 'student2',
    email: 'student2@example.com',
    first_name: 'Alice',
    last_name: 'Johnson',
    role: 'student',
    profile_image_url: null
  },
  {
    moodle_user_id: 103,
    username: 'student3',
    email: 'student3@example.com',
    first_name: 'Bob',
    last_name: 'Williams',
    role: 'student',
    profile_image_url: null
  },
  {
    moodle_user_id: 104,
    username: 'student4',
    email: 'student4@example.com',
    first_name: 'Carol',
    last_name: 'Brown',
    role: 'student',
    profile_image_url: null
  }
];

const DEMO_EXAMS = [
  {
    moodle_course_id: 1,
    moodle_course_module_id: 1,
    exam_name: 'Mathematics Final Exam',
    course_name: 'Mathematics 101',
    duration_minutes: 90,
    max_warnings: 15,
    question_paper_path: '/exams/math101_final.pdf'
  },
  {
    moodle_course_id: 2,
    moodle_course_module_id: 2,
    exam_name: 'Physics Midterm',
    course_name: 'Physics 201',
    duration_minutes: 60,
    max_warnings: 15,
    question_paper_path: '/exams/phys201_midterm.pdf'
  },
  {
    moodle_course_id: 3,
    moodle_course_module_id: 3,
    exam_name: 'Computer Science Quiz',
    course_name: 'CS 101 - Introduction to Programming',
    duration_minutes: 45,
    max_warnings: 10,
    question_paper_path: '/exams/cs101_quiz.pdf'
  }
];

const VIOLATION_TYPES = [
  'face_absent',
  'multiple_faces',
  'phone_detected',
  'forbidden_object',
  'looking_away',
  'camera_blocked',
  'too_dark',
  'identity_mismatch'
];

// ============================================================================
// Seeder
// ============================================================================

class DatabaseSeeder {
  private client: Client;

  constructor(databaseUrl: string) {
    this.client = new Client({ connectionString: databaseUrl });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log('✅ Connected to database');
  }

  async disconnect(): Promise<void> {
    await this.client.end();
    console.log('✅ Disconnected from database');
  }

  async clearTables(): Promise<void> {
    console.log('\n🗑️  Clearing existing data...');

    await this.client.query('DELETE FROM violations');
    await this.client.query('DELETE FROM proctoring_sessions');
    await this.client.query('DELETE FROM exam_attempts');
    await this.client.query('DELETE FROM exams');
    await this.client.query('DELETE FROM audit_logs');
    await this.client.query('DELETE FROM users');

    // Reset sequences
    await this.client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
    await this.client.query('ALTER SEQUENCE exams_id_seq RESTART WITH 1');
    await this.client.query('ALTER SEQUENCE exam_attempts_id_seq RESTART WITH 1');
    await this.client.query('ALTER SEQUENCE violations_id_seq RESTART WITH 1');
    await this.client.query('ALTER SEQUENCE proctoring_sessions_id_seq RESTART WITH 1');
    await this.client.query('ALTER SEQUENCE audit_logs_id_seq RESTART WITH 1');

    console.log('✅ Tables cleared');
  }

  async seedUsers(): Promise<void> {
    console.log('\n👤 Seeding users...');

    for (const user of DEMO_USERS) {
      await this.client.query(
        `INSERT INTO users (
          moodle_user_id, username, email, first_name, last_name, role, profile_image_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user.moodle_user_id,
          user.username,
          user.email,
          user.first_name,
          user.last_name,
          user.role,
          user.profile_image_url
        ]
      );
      console.log(`  ✅ Created user: ${user.username} (${user.role})`);
    }
  }

  async seedExams(): Promise<void> {
    console.log('\n📝 Seeding exams...');

    for (const exam of DEMO_EXAMS) {
      await this.client.query(
        `INSERT INTO exams (
          moodle_course_id, moodle_course_module_id, exam_name, course_name,
          duration_minutes, max_warnings, question_paper_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          exam.moodle_course_id,
          exam.moodle_course_module_id,
          exam.exam_name,
          exam.course_name,
          exam.duration_minutes,
          exam.max_warnings,
          exam.question_paper_path
        ]
      );
      console.log(`  ✅ Created exam: ${exam.exam_name}`);
    }
  }

  async seedExamAttempts(): Promise<void> {
    console.log('\n📋 Seeding exam attempts...');

    // Student 1 attempts
    await this.client.query(
      `INSERT INTO exam_attempts (
        user_id, exam_id, moodle_attempt_id, status, started_at, submitted_at,
        submission_reason, violation_count, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        2, // student1
        1, // Math exam
        1001,
        'submitted',
        new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        new Date(Date.now() - 30 * 60 * 1000), // 30 min ago (1.5h exam)
        'manual_submit',
        3,
        '192.168.1.100',
        'Mozilla/5.0...'
      ]
    );
    console.log('  ✅ Created attempt: student1 -> Math exam (submitted)');

    // Student 2 in progress
    await this.client.query(
      `INSERT INTO exam_attempts (
        user_id, exam_id, moodle_attempt_id, status, started_at,
        violation_count, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        3, // student2
        1, // Math exam
        1002,
        'in_progress',
        new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
        1,
        '192.168.1.101',
        'Mozilla/5.0...'
      ]
    );
    console.log('  ✅ Created attempt: student2 -> Math exam (in_progress)');

    // Student 3 not started
    await this.client.query(
      `INSERT INTO exam_attempts (
        user_id, exam_id, moodle_attempt_id, status, violation_count
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        4, // student3
        2, // Physics exam
        null,
        'not_started',
        0
      ]
    );
    console.log('  ✅ Created attempt: student3 -> Physics exam (not_started)');

    // Student 4 terminated
    await this.client.query(
      `INSERT INTO exam_attempts (
        user_id, exam_id, moodle_attempt_id, status, started_at, submitted_at,
        submission_reason, violation_count, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        5, // student4
        3, // CS exam
        1003,
        'terminated',
        new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        'warning_limit_reached',
        15,
        '192.168.1.103'
      ]
    );
    console.log('  ✅ Created attempt: student4 -> CS exam (terminated - 15 warnings)');
  }

  async seedViolations(): Promise<void> {
    console.log('\n⚠️  Seeding violations...');

    // Violations for student1 (submitted exam)
    const attempt1Violations = [
      { type: 'looking_away', detail: 'Student looked away multiple times', minutes_ago: 115 },
      { type: 'face_absent', detail: 'Face not detected', minutes_ago: 90 },
      { type: 'phone_detected', detail: 'Phone detected in frame', minutes_ago: 45 }
    ];

    for (const v of attempt1Violations) {
      const occurredAt = new Date(Date.now() - v.minutes_ago * 60 * 1000);
      await this.client.query(
        `INSERT INTO violations (
          attempt_id, violation_type, severity, detail, occurred_at,
          integrity_hash, client_ip, session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          1, // attempt_id
          v.type,
          'warning',
          v.detail,
          occurredAt,
          `hash_${Date.now()}_${Math.random()}`,
          '192.168.1.100',
          `session_${Math.random().toString(36).substring(7)}`
        ]
      );
      console.log(`  ✅ Created violation: ${v.type} for student1`);
    }

    // Violations for student2 (in_progress)
    await this.client.query(
      `INSERT INTO violations (
        attempt_id, violation_type, severity, detail, occurred_at,
        integrity_hash, client_ip, session_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        2, // attempt_id
        'multiple_faces',
        'warning',
        'Multiple faces detected in frame',
        new Date(Date.now() - 5 * 60 * 1000),
        `hash_${Date.now()}_${Math.random()}`,
        '192.168.1.101',
        `session_${Math.random().toString(36).substring(7)}`
      ]
    );
    console.log('  ✅ Created violation: multiple_faces for student2');

    // Violations for student4 (terminated - full 15 warnings)
    for (let i = 0; i < 15; i++) {
      const type = VIOLATION_TYPES[i % VIOLATION_TYPES.length];
      await this.client.query(
        `INSERT INTO violations (
          attempt_id, violation_type, severity, detail, occurred_at,
          integrity_hash, client_ip, session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          3, // attempt_id
          type,
          'warning',
          `Violation ${i + 1}: ${type.replace('_', ' ')}`,
          new Date(Date.now() - (180 - i * 10) * 60 * 1000),
          `hash_${Date.now()}_${i}`,
          '192.168.1.103',
          `session_${Math.random().toString(36).substring(7)}`
        ]
      );
    }
    console.log('  ✅ Created 15 violations for student4 (terminated)');
  }

  async seedProctoringSessions(): Promise<void> {
    console.log('\n🎥 Seeding proctoring sessions...');

    // Session for student2 (active)
    await this.client.query(
      `INSERT INTO proctoring_sessions (
        attempt_id, session_start, frames_processed, ai_service_connected,
        connection_errors, client_info
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        2, // attempt_id (student2 in progress)
        new Date(Date.now() - 15 * 60 * 1000),
        450, // ~30 fps for 15 min
        true,
        0,
        JSON.stringify({
          browser: 'Chrome',
          os: 'Windows',
          camera: 'HD Webcam',
          resolution: '1280x720'
        })
      ]
    );
    console.log('  ✅ Created proctoring session for student2 (active)');
  }

  async seedAuditLogs(): Promise<void> {
    console.log('\n📊 Seeding audit logs...');

    const logs = [
      { user_id: 2, action: 'login', resource_type: null, resource_id: null },
      { user_id: 2, action: 'exam_start', resource_type: 'exam', resource_id: 1 },
      { user_id: 2, action: 'exam_submit', resource_type: 'attempt', resource_id: 1 },
      { user_id: 2, action: 'logout', resource_type: null, resource_id: null },
      { user_id: 3, action: 'login', resource_type: null, resource_id: null },
      { user_id: 3, action: 'exam_start', resource_type: 'exam', resource_id: 1 },
    ];

    for (const log of logs) {
      await this.client.query(
        `INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id, ip_address, details
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          log.user_id,
          log.action,
          log.resource_type,
          log.resource_id,
          '192.168.1.100',
          JSON.stringify({ timestamp: new Date().toISOString() })
        ]
      );
    }
    console.log(`  ✅ Created ${logs.length} audit log entries`);
  }

  async seed(): Promise<void> {
    console.log('\n🌱 Starting database seeding...\n');

    try {
      await this.connect();
      await this.clearTables();
      await this.seedUsers();
      await this.seedExams();
      await this.seedExamAttempts();
      await this.seedViolations();
      await this.seedProctoringSessions();
      await this.seedAuditLogs();

      console.log('\n✨ Database seeded successfully!\n');

      // Print summary
      const result = await this.client.query(`
        SELECT
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM exams) as exams,
          (SELECT COUNT(*) FROM exam_attempts) as attempts,
          (SELECT COUNT(*) FROM violations) as violations,
          (SELECT COUNT(*) FROM proctoring_sessions) as sessions,
          (SELECT COUNT(*) FROM audit_logs) as audit_logs
      `);

      const stats = result.rows[0];
      console.log('📊 Seeding Summary:');
      console.log(`  Users: ${stats.users}`);
      console.log(`  Exams: ${stats.exams}`);
      console.log(`  Attempts: ${stats.attempts}`);
      console.log(`  Violations: ${stats.violations}`);
      console.log(`  Sessions: ${stats.sessions}`);
      console.log(`  Audit logs: ${stats.audit_logs}\n`);

    } catch (error) {
      console.error('\n❌ Seeding failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const command = process.argv[2] || 'seed';

  const seeder = new DatabaseSeeder(DATABASE_URL);

  try {
    if (command === 'seed') {
      await seeder.seed();
    } else if (command === 'clear') {
      await seeder.connect();
      await seeder.clearTables();
      await seeder.disconnect();
      console.log('\n✅ Database cleared\n');
    } else {
      console.log(`
Usage: npm run seed [command]

Commands:
  seed  Insert demo data into database (default)
  clear Remove all data from database

Environment:
  DATABASE_URL  PostgreSQL connection string
      `);
    }
  } catch (error) {
    console.error('\n❌ Operation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DatabaseSeeder };
