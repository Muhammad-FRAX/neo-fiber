/**
 * Minimal migration runner for the app DB.
 *
 * Usage:
 *   npm run migrate         — apply all pending migrations (up)
 *   npm run migrate:down    — roll back the last applied migration
 *
 * Migrations live in ./migrations/*.sql (no .down suffix).
 * Rollback SQL lives in ./migrations/*.down.sql.
 * Applied migrations are tracked in the schema_migrations table.
 *
 * DESIGN.md §13: "no auto-migration on container start" — this script is
 * called explicitly by the operator after each deploy.
 */

import { readdir, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appPool } from './app-pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await appPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL      PRIMARY KEY,
      name       VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations(): Promise<Set<string>> {
  const { rows } = await appPool.query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY id',
  );
  return new Set(rows.map((r) => r.name));
}

export async function migrateUp(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await appliedMigrations();

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip (already applied): ${file}`);
      continue;
    }
    const sql = await readFile(resolve(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`  applying: ${file}`);
    await appPool.query(sql);
    await appPool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    console.log(`  applied:  ${file}`);
  }
}

export async function migrateDown(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await appliedMigrations();

  if (applied.size === 0) {
    console.log('Nothing to roll back.');
    return;
  }

  const last = [...applied].at(-1)!;
  const downFile = last.replace('.sql', '.down.sql');
  const downPath = resolve(MIGRATIONS_DIR, downFile);

  let sql: string;
  try {
    sql = await readFile(downPath, 'utf-8');
  } catch {
    console.error(`No rollback file found: ${downFile}`);
    process.exit(1);
  }

  console.log(`  rolling back: ${last}`);
  await appPool.query(sql);
  await appPool.query('DELETE FROM schema_migrations WHERE name = $1', [last]);
  console.log(`  rolled back:  ${last}`);
}

// CLI entry point
const command = process.argv[2] ?? 'up';
if (command === 'up') {
  migrateUp()
    .then(() => {
      console.log('Migration complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
} else if (command === 'down') {
  migrateDown()
    .then(() => {
      console.log('Rollback complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Rollback failed:', err);
      process.exit(1);
    });
} else {
  console.error(`Unknown command: ${command}. Use "up" or "down".`);
  process.exit(1);
}
