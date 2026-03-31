// ============================================================================
// Room Schema Bootstrap
// Ensures the room-related tables exist for local/dev environments where
// migrations were skipped before the backend starts serving requests.
// The statements below are all idempotent, so we can safely run them on boot.
// ============================================================================

interface QueryableClient {
  query: (text: string, values?: unknown[]) => Promise<unknown>
}

export async function ensureRoomSchema(client: QueryableClient): Promise<void> {

  await client.query('BEGIN');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS proctoring_rooms (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        room_code VARCHAR(8) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'created',
        capacity INTEGER DEFAULT 15,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        activated_at TIMESTAMP WITH TIME ZONE,
        closed_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT valid_room_status CHECK (status IN ('created', 'activated', 'closed')),
        UNIQUE(exam_id, teacher_id, status)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_code ON proctoring_rooms(room_code);
      CREATE INDEX IF NOT EXISTS idx_rooms_teacher_status ON proctoring_rooms(teacher_id, status);
      CREATE INDEX IF NOT EXISTS idx_rooms_exam_status ON proctoring_rooms(exam_id, status);
      CREATE INDEX IF NOT EXISTS idx_rooms_status_created ON proctoring_rooms(status, created_at);
    `);

    await client.query(`
      ALTER TABLE violations
      ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES proctoring_rooms(id) ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violations_room_id ON violations(room_id);
      CREATE INDEX IF NOT EXISTS idx_violations_room_occurred ON violations(room_id, occurred_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS proctoring_room_students (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL REFERENCES proctoring_rooms(id) ON DELETE CASCADE,
        attempt_id INTEGER REFERENCES exam_attempts(id) ON DELETE SET NULL,
        student_name VARCHAR(255) NOT NULL,
        student_email VARCHAR(255) NOT NULL,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(room_id, student_email)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_students_room_id ON proctoring_room_students(room_id);
      CREATE INDEX IF NOT EXISTS idx_room_students_room_email ON proctoring_room_students(room_id, student_email);
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
