import fs from 'fs';
import path from 'path';
import pool from './pool.js';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, 'migrations');

interface MigrationFile {
  version: string;
  name: string;
  upPath: string;
  downPath: string;
}

function getMigrationFiles(): MigrationFile[] {
  const files = fs.readdirSync(MIGRATIONS_DIR);
  const migrationMap = new Map<string, { up?: string; down?: string }>();

  for (const file of files) {
    // Match patterns like 001_name.up.sql or 001_name.down.sql
    const match = file.match(/^(\d+)_(.+)\.(up|down)\.sql$/);
    if (!match) continue;

    const [, version, name, direction] = match;
    const key = `${version}_${name}`;

    if (!migrationMap.has(key)) {
      migrationMap.set(key, {});
    }

    const entry = migrationMap.get(key)!;
    const fullPath = path.join(MIGRATIONS_DIR, file);

    if (direction === 'up') {
      entry.up = fullPath;
    } else {
      entry.down = fullPath;
    }
  }

  return Array.from(migrationMap.entries())
    .map(([key, files]) => {
      const [version, ...nameParts] = key.split('_');
      return {
        version,
        name: nameParts.join('_'),
        upPath: files.up!,
        downPath: files.down!,
      };
    })
    .sort((a, b) => a.version.localeCompare(b.version));
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query('SELECT version FROM _migrations ORDER BY version ASC');
  return new Set(result.rows.map((r: { version: string }) => r.version));
}

async function runSqlFile(filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf-8');
  if (sql.trim().length === 0) return;
  await pool.query(sql);
}

async function migrateUp(targetVersion?: string): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const migrations = getMigrationFiles();

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    console.log(`Running up migration: ${migration.version}_${migration.name}...`);
    await runSqlFile(migration.upPath);
    await pool.query('INSERT INTO _migrations (version, name) VALUES ($1, $2)', [
      migration.version,
      migration.name,
    ]);
    console.log(`  Complete.`);

    if (targetVersion && migration.version === targetVersion) break;
  }

  console.log('All up migrations complete.');
}

async function migrateDown(targetVersion?: string): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const migrations = getMigrationFiles().reverse(); // reverse order

  for (const migration of migrations) {
    if (!applied.has(migration.version)) continue;

    console.log(`Running down migration: ${migration.version}_${migration.name}...`);
    await runSqlFile(migration.downPath);
    await pool.query('DELETE FROM _migrations WHERE version = $1', [migration.version]);
    console.log(`  Complete.`);

    if (targetVersion && migration.version === targetVersion) break;
  }

  console.log('All down migrations complete.');
}

async function resetMigrations(): Promise<void> {
  // Drop all migrations and re-run from scratch
  await migrateDown();
  await migrateUp();
}

// CLI entry point
const command = process.argv[2];

async function main(): Promise<void> {
  try {
    switch (command) {
      case 'up':
        await migrateUp(process.argv[3]);
        break;
      case 'down':
        await migrateDown(process.argv[3]);
        break;
      case 'reset':
        await resetMigrations();
        break;
      default:
        console.log('Usage: tsx src/db/migrate.ts <up|down|reset> [version]');
        console.log('  up       - Run pending up migrations');
        console.log('  down     - Roll back applied migrations (in reverse order)');
        console.log('  reset    - Roll back all, then run all up migrations');
        break;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
