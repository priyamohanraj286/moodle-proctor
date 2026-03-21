// ============================================================================
// Database Migration Runner
// Executes SQL migrations in order and tracks applied migrations
// ============================================================================

import { Client } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

interface MigrationRecord {
  id: number;
  migration_id: number;
  name: string;
  applied_at: Date;
}

interface MigrationFile {
  id: number;
  name: string;
  path: string;
}

// ============================================================================
// Configuration
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://proctor_user:proctor_pass@localhost:5432/moodle_proctor';
const MIGRATIONS_DIR = join(__dirname, '../src/db/migrations');

// ============================================================================
// Migration Runner
// ============================================================================

class MigrationRunner {
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

  /**
   * Create schema_migrations table if it doesn't exist
   */
  async createMigrationsTable(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_id INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Schema migrations table ready');
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<Set<number>> {
    const result = await this.client.query<MigrationRecord>(
      'SELECT migration_id, name, applied_at FROM schema_migrations ORDER BY migration_id'
    );

    const appliedIds = new Set<number>();
    result.rows.forEach(row => appliedIds.add(row.migration_id));

    console.log(`📊 Found ${appliedIds.size} applied migrations`);
    return appliedIds;
  }

  /**
   * Get list of migration files
   */
  getMigrationFiles(): MigrationFile[] {
    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));

    const migrations: MigrationFile[] = files.map(file => {
      const match = file.match(/^(\d+)_/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${file}. Must start with number_`);
      }
      const id = parseInt(match[1], 10);
      return {
        id,
        name: file,
        path: join(MIGRATIONS_DIR, file)
      };
    });

    // Sort by migration ID
    migrations.sort((a, b) => a.id - b.id);

    return migrations;
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration: MigrationFile): Promise<void> {
    console.log(`\n⬆️  Applying migration ${migration.id}: ${migration.name}`);

    // Read migration SQL
    const sql = readFileSync(migration.path, 'utf-8');

    try {
      // Start transaction
      await this.client.query('BEGIN');

      // Execute migration
      await this.client.query(sql);

      // Record migration
      await this.client.query(
        'INSERT INTO schema_migrations (migration_id, name) VALUES ($1, $2)',
        [migration.id, migration.name]
      );

      // Commit transaction
      await this.client.query('COMMIT');

      console.log(`✅ Migration ${migration.id} applied successfully`);
    } catch (error) {
      // Rollback on error
      await this.client.query('ROLLBACK');
      console.error(`❌ Migration ${migration.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Run pending migrations
   */
  async up(): Promise<void> {
    console.log('\n🚀 Starting database migrations...\n');

    await this.connect();
    await this.createMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();
    const migrationFiles = this.getMigrationFiles();

    // Filter out already applied migrations
    const pendingMigrations = migrationFiles.filter(m => !appliedMigrations.has(m.id));

    if (pendingMigrations.length === 0) {
      console.log('\n✨ No pending migrations to apply\n');
      await this.disconnect();
      return;
    }

    console.log(`\n📋 Found ${pendingMigrations.length} pending migration(s)\n`);

    // Apply each pending migration
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('\n✨ All migrations applied successfully!\n');
    await this.disconnect();
  }

  /**
   * Rollback last migration (if we had down migrations)
   * Note: Current migrations don't have down scripts, so this is not implemented
   */
  async down(): Promise<void> {
    console.log('\n⚠️  Rollback not implemented for this project\n');
    console.log('Migrations are designed to be forward-only with proper ALTER TABLE IF NOT EXISTS statements\n');
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    console.log('\n📊 Migration Status\n');

    await this.connect();
    await this.createMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();
    const migrationFiles = this.getMigrationFiles();

    console.log('\nApplied migrations:');
    migrationFiles.forEach(m => {
      const status = appliedMigrations.has(m.id) ? '✅' : '⏸️ ';
      console.log(`  ${status} ${m.id}: ${m.name}`);
    });

    console.log(`\nTotal: ${appliedMigrations.size}/${migrationFiles.length} migrations applied\n`);

    await this.disconnect();
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const command = process.argv[2] || 'up';

  const runner = new MigrationRunner(DATABASE_URL);

  try {
    switch (command) {
      case 'up':
        await runner.up();
        break;
      case 'down':
        await runner.down();
        break;
      case 'status':
        await runner.status();
        break;
      default:
        console.log(`
Usage: npm run migrate [command]

Commands:
  up      Apply pending migrations (default)
  down    Rollback last migration (not implemented)
  status  Show migration status

Environment:
  DATABASE_URL  PostgreSQL connection string
                 (default: postgresql://proctor_user:proctor_pass@localhost:5432/moodle_proctor)
        `);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MigrationRunner };
