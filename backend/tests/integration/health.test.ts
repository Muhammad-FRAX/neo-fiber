/**
 * Integration test for GET /api/v1/health.
 *
 * CI fallback per §12.5: the real DWH Postgres is NOT reachable from GitHub
 * Actions runners. Both pools (app_db + dwh) are pointed at the same
 * testcontainers PostGIS instance so the health endpoint returns "connected"
 * for both. This mirrors the "both up" production scenario and verifies the
 * migration applies cleanly.
 *
 * What is NOT verified here (requires local access — see CONTINUATION.md):
 *   - Real DWH connectivity (172.18.x.x)
 *   - LDAP connectivity
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Express } from 'express';
import request from 'supertest';

let container: StartedPostgreSqlContainer;
let app: Express;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgis/postgis:16-3.4-alpine').start();

  const dbUrl = container.getConnectionUri();

  // Set required env vars BEFORE any app module is imported (lazy module cache)
  process.env['APP_DB_URL'] = dbUrl;
  process.env['DWH_URL'] = dbUrl; // same container — CI fallback
  process.env['JWT_SECRET'] = 'test-secret-that-is-exactly-32-chars-a!';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['NODE_ENV'] = 'test';

  // Dynamic imports so env.ts reads the above vars on first load
  const { migrateUp } = await import('../../src/db/migrate.js');
  const { createApp } = await import('../../src/app.js');

  await migrateUp();
  app = createApp();
}, 120_000);

afterAll(async () => {
  await container?.stop();
});

describe('GET /api/v1/health', () => {
  it('returns 200 with connected status when both pools are up', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      app_db: 'connected',
      dwh: 'connected',
    });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Schema migration', () => {
  it('creates expected tables', async () => {
    // Dynamic import after DB is ready
    const { appPool } = await import('../../src/db/app-pool.js');

    const { rows } = await appPool.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tables = rows.map((r) => r.tablename);
    expect(tables).toContain('sites');
    expect(tables).toContain('devices');
    expect(tables).toContain('links');
    expect(tables).toContain('alternate_paths');
    expect(tables).toContain('users');
    expect(tables).toContain('topology_audit');
    expect(tables).toContain('alarm_acks');
    expect(tables).toContain('incident_notes');
    expect(tables).toContain('saved_views');
    expect(tables).toContain('schema_migrations');
  });

  it('sites table has is_root column (T2)', async () => {
    const { appPool } = await import('../../src/db/app-pool.js');

    const { rows } = await appPool.query<{ column_name: string; data_type: string; column_default: string }>(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'sites' AND column_name = 'is_root'
    `);

    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('boolean');
    expect(rows[0].column_default).toBe('false');
  });

  it('sites table starts empty (no pre-seeded root — Phase 0 Q1)', async () => {
    const { appPool } = await import('../../src/db/app-pool.js');
    const { rows } = await appPool.query('SELECT COUNT(*) as n FROM sites');
    expect(parseInt(rows[0].n, 10)).toBe(0);
  });

  it('postgis extension is enabled', async () => {
    const { appPool } = await import('../../src/db/app-pool.js');
    const { rows } = await appPool.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname = 'postgis'",
    );
    expect(rows).toHaveLength(1);
  });
});
