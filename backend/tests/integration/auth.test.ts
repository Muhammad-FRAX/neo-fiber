/**
 * Integration tests for auth routes (POST /login, POST /logout, GET /me).
 *
 * CI environment: no LDAP reachable → tests run with AUTH_LOCAL_ONLY=true.
 * A test user is inserted with a known bcrypt-hashed password before each test.
 *
 * LDAP path is covered by unit tests (ldap.test.ts) which mock the ldapjs client.
 * Real LDAP verification requires the deploy host — see CONTINUATION.md.
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

  process.env['APP_DB_URL'] = dbUrl;
  process.env['DWH_URL'] = dbUrl;
  process.env['JWT_SECRET'] = 'integration-test-secret-exactly-32c!';
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

  // Seed a local test user
  const hash = await hashPassword('correct-password');
  await appPool.query(
    `INSERT INTO users (ldap_username, display_name, role, password_hash)
     VALUES ($1, $2, $3, $4)`,
    ['testuser', 'Test User', 'viewer', hash],
  );
}, 120_000);

afterAll(async () => {
  await container?.stop();
});

describe('POST /api/v1/auth/login', () => {
  it('returns 400 for empty username', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: '', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for username with spaces', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'bad user', password: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'testuser' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for unknown user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'nobody', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with token + user for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.').length).toBe(3);
    expect(res.body.user.username).toBe('testuser');
    expect(res.body.user.role).toBe('viewer');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 with message', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    const jwt = await import('jsonwebtoken');
    const expired = jwt.default.sign(
      { sub: 1, username: 'testuser', role: 'viewer' },
      process.env['JWT_SECRET']!,
      { expiresIn: 1, algorithm: 'HS256' },
    );
    await new Promise((r) => setTimeout(r, 1100));

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with user data for a valid token', async () => {
    // First login to get a valid token
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'correct-password' });
    const { token } = login.body;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('testuser');
    expect(res.body.user.role).toBe('viewer');
  });
});
