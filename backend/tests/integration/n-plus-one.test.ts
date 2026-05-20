/**
 * N+1 guard integration test (T14 — DESIGN.md §9 Query conventions, D3).
 *
 * Verifies that list endpoints (GET /api/v1/sites, /devices, /links) run
 * at most 2 queries regardless of the number of rows returned.
 *
 * Strategy: spy on appPool.query to count calls per request.
 * Uses testcontainers PostGIS to guarantee a real DB (no mocks — DESIGN.md rule).
 *
 * Scenario: 5 sites × 3 devices × 2 links — if list endpoints were N+1,
 * they would run 5+ / 15+ queries. We assert ≤ 2.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Express } from 'express';
import request from 'supertest';

let container: StartedPostgreSqlContainer;
let app: Express;
let authToken: string;

// Mutable counter patched onto appPool.query in each test
let queryCount = 0;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgis/postgis:16-3.4-alpine').start();

  const dbUrl = container.getConnectionUri();

  process.env['APP_DB_URL'] = dbUrl;
  process.env['DWH_URL'] = dbUrl;
  process.env['JWT_SECRET'] = 'n-plus-one-test-secret-exactly-32!!!';
  process.env['JWT_TTL_SECONDS'] = '28800';
  process.env['AUTH_LOCAL_ONLY'] = 'true';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['NODE_ENV'] = 'test';

  const { migrateUp } = await import('../../src/db/migrate.js');
  const { createApp } = await import('../../src/app.js');
  const { appPool } = await import('../../src/db/app-pool.js');
  const { hashPassword } = await import('../../src/auth/bcrypt.js');

  await migrateUp();
  app = createApp();

  // Seed test user for auth
  const hash = await hashPassword('testpass');
  await appPool.query(
    `INSERT INTO users (ldap_username, display_name, role, password_hash) VALUES ($1, $2, $3, $4)`,
    ['n1user', 'N1 User', 'viewer', hash],
  );

  // Seed 5 sites with 3 devices each, and 2 links per site (between device 0 and 1)
  for (let s = 0; s < 5; s++) {
    const siteRes = await appPool.query<{ id: number }>(
      `INSERT INTO sites (name, region, is_root) VALUES ($1, $2, false) RETURNING id`,
      [`Site ${s}`, `Region ${s}`],
    );
    const siteId = siteRes.rows[0].id;

    const deviceIds: number[] = [];
    for (let d = 0; d < 3; d++) {
      const devRes = await appPool.query<{ id: number }>(
        `INSERT INTO devices (site_id, name, type) VALUES ($1, $2, $3) RETURNING id`,
        [siteId, `Device ${s}-${d}`, 'ROADM'],
      );
      deviceIds.push(devRes.rows[0].id);
    }

    // 2 links: d0→d1 MAIN, d1→d2 BACKUP
    await appPool.query(
      `INSERT INTO links (source_device_id, target_device_id, ranking) VALUES ($1, $2, 'MAIN'), ($3, $4, 'BACKUP')`,
      [deviceIds[0], deviceIds[1], deviceIds[1], deviceIds[2]],
    );
  }

  // Get auth token
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'n1user', password: 'testpass' });
  authToken = loginRes.body.token;

  // Patch appPool.query to count calls — must happen AFTER seeding is done
  const { appPool: pool } = await import('../../src/db/app-pool.js');
  const originalQuery = pool.query.bind(pool);
  // @ts-expect-error - overriding for test instrumentation
  pool.query = (...args: Parameters<typeof pool.query>) => {
    queryCount++;
    return (originalQuery as (...a: unknown[]) => unknown)(...args);
  };
}, 120_000);

afterAll(async () => {
  await container?.stop();
  vi.restoreAllMocks();
});

function resetCount() {
  queryCount = 0;
}

describe('N+1 guard — GET /api/v1/sites', () => {
  it('runs ≤ 2 queries for 5 sites (data + count)', async () => {
    resetCount();
    const res = await request(app)
      .get('/api/v1/sites')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(queryCount).toBeLessThanOrEqual(2);
  });

  it('runs ≤ 2 queries for GET /api/v1/sites/:id (site + devices)', async () => {
    const siteId = (res: { body: { data: Array<{ id: number }> } }) => res.body.data[0].id;
    const listRes = await request(app)
      .get('/api/v1/sites')
      .set('Authorization', `Bearer ${authToken}`);

    resetCount();
    const res = await request(app)
      .get(`/api/v1/sites/${siteId(listRes)}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.devices)).toBe(true);
    expect(queryCount).toBeLessThanOrEqual(2);
  });
});

describe('N+1 guard — GET /api/v1/devices', () => {
  it('runs ≤ 2 queries for 15 devices (data + count)', async () => {
    resetCount();
    const res = await request(app)
      .get('/api/v1/devices?limit=50')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(15);
    expect(queryCount).toBeLessThanOrEqual(2);
  });
});

describe('N+1 guard — GET /api/v1/links', () => {
  it('runs ≤ 2 queries for 10 links (data + count)', async () => {
    resetCount();
    const res = await request(app)
      .get('/api/v1/links?limit=50')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(10);
    expect(queryCount).toBeLessThanOrEqual(2);
  });
});
