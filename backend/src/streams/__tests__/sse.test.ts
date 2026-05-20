/**
 * SSE stream tests (Phase 5).
 *
 * Tests: connect with no auth → 401, connect with invalid token → 401,
 * connect + receive alarm event, connect + token expires → event: reauth + close,
 * heartbeat sent at interval.
 *
 * No testcontainers needed — SSE handlers don't query the DB.
 * DB URLs are fake; pools are created lazily and never queried in these tests.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import * as jsonwebtoken from 'jsonwebtoken';
import type { Express } from 'express';
import type { AlarmEvent } from '../../services/dwh/event-bus.js';
import type { TopologyStatusEvent } from '../../services/topology/topology-bus.js';

const JWT_SECRET = 'test-secret-for-sse-exactly-32c!'; // >= 32 chars

let app: Express;
let server: http.Server;
let port: number;

let publishAlarm: (event: AlarmEvent) => void;
let publishTopology: (event: TopologyStatusEvent) => void;

beforeAll(async () => {
  process.env['APP_DB_URL'] = 'postgresql://fake:fake@localhost:5432/fake';
  process.env['DWH_URL'] = 'postgresql://fake:fake@localhost:5432/fake';
  process.env['JWT_SECRET'] = JWT_SECRET;
  process.env['JWT_TTL_SECONDS'] = '28800';
  process.env['SSE_HEARTBEAT_MS'] = '100'; // short for tests
  process.env['LOG_LEVEL'] = 'silent';
  process.env['NODE_ENV'] = 'test';

  const appModule = await import('../../app.js');
  const eventBusModule = await import('../../services/dwh/event-bus.js');
  const topoBusModule = await import('../../services/topology/topology-bus.js');

  app = appModule.createApp();
  publishAlarm = (e) => eventBusModule.alarmBus.publish(e);
  publishTopology = (e) => topoBusModule.topologyBus.publish(e);

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
}, 30_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// Helper: create a valid JWT
function makeToken(expiresIn = 3600): string {
  return jsonwebtoken.sign(
    { sub: 1, username: 'testuser', role: 'viewer' },
    JWT_SECRET,
    { expiresIn, algorithm: 'HS256' },
  );
}

// Helper: open SSE, collect raw body for durationMs, then destroy
function collectSseChunks(path: string, token: string | null, durationMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers },
      (res) => {
        const chunks: string[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
        res.on('end', () => resolve(chunks.join('')));
        res.on('error', reject);

        setTimeout(() => {
          req.destroy();
          resolve(chunks.join(''));
        }, durationMs);
      },
    );
    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
        resolve('');
        return;
      }
      reject(err);
    });
    req.end();
  });
}

// Helper: get just the response headers (destroys connection immediately)
function sseHead(path: string, token: string | null): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers },
      (res) => {
        res.resume();
        resolve(res);
        req.destroy();
      },
    );
    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') return;
      reject(err);
    });
    req.end();
  });
}

// ─── Auth guard tests ──────────────────────────────────────────────────────

describe('GET /api/v1/stream/alarms — auth', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/stream/alarms');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/stream/alarms')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for an already-expired token', async () => {
    const expired = jsonwebtoken.sign(
      { sub: 1, username: 'testuser', role: 'viewer' },
      JWT_SECRET,
      { expiresIn: -1, algorithm: 'HS256' },
    );
    const res = await request(app)
      .get('/api/v1/stream/alarms')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/stream/topology — auth', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/stream/topology');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/stream/topology')
      .set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });
});

// ─── SSE response headers ──────────────────────────────────────────────────

describe('GET /api/v1/stream/alarms — SSE headers', () => {
  it('returns 200 with text/event-stream for a valid token', async () => {
    const token = makeToken();
    const res = await sseHead('/api/v1/stream/alarms', token);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
  });
});

// ─── Event delivery ────────────────────────────────────────────────────────

describe('GET /api/v1/stream/alarms — event delivery', () => {
  it('pushes an alarm event to connected clients', async () => {
    const token = makeToken();

    const collectPromise = collectSseChunks('/api/v1/stream/alarms', token, 300);

    // Let the SSE connection establish before publishing
    await new Promise((r) => setTimeout(r, 60));

    publishAlarm({
      alarm: {
        Log_Serial_Number: '42',
        Alarm_key: null,
        Alarm_Name: 'TEST_ALARM',
        Alarm_Severity: 'MAJOR',
        Alarm_Source: null,
        Status: 'Not Clear',
        OccurrenceTime: new Date(),
        ClearanceTime: null,
        DownTime: null,
        LocationInformation: null,
        Contractor: null,
        FiberlinkSite_ID: null,
        FiberLinkSite_Name: null,
        Site_A_ID: null,
        Site_A_Latitude: null,
        Site_A_Longitude: null,
        State: null,
        Zone: null,
        Vendor: null,
        Site_Priority: null,
        Is_Hub: null,
        Is_VIP: null,
        Site_B_ID: null,
        Site_B_Latitude: null,
        Site_B_Longitude: null,
        Source_NE: null,
        Sink_NE: null,
      },
      resolvedLinkId: null,
      isFiberCut: false,
    });

    const body = await collectPromise;
    expect(body).toContain('event: alarm');
    expect(body).toContain('TEST_ALARM');
  });
});

describe('GET /api/v1/stream/topology — event delivery', () => {
  it('pushes a topology_status event to connected clients', async () => {
    const token = makeToken();

    const collectPromise = collectSseChunks('/api/v1/stream/topology', token, 300);

    await new Promise((r) => setTimeout(r, 60));

    publishTopology({
      devices: [{ id: 1, effective_status: 'DEGRADED' }],
      links: [{ id: 10, effective_status: 'DOWN' }],
      computedAt: new Date().toISOString(),
    });

    const body = await collectPromise;
    expect(body).toContain('event: topology_status');
    expect(body).toContain('DEGRADED');
  });
});

// ─── Heartbeat ─────────────────────────────────────────────────────────────

describe('SSE heartbeat', () => {
  it('sends ": ping" comments at the configured interval', async () => {
    const token = makeToken();
    // SSE_HEARTBEAT_MS=100 → collect 350ms → expect at least 2 pings
    const body = await collectSseChunks('/api/v1/stream/alarms', token, 350);
    const pingCount = (body.match(/: ping/g) ?? []).length;
    expect(pingCount).toBeGreaterThanOrEqual(2);
  });
});

// ─── Token expiry mid-stream → event: reauth + close ──────────────────────

describe('SSE token expiry mid-stream', () => {
  it('sends event: reauth and closes stream when token expires', async () => {
    // Token valid for 1 second; after expiry the next write triggers reauth
    const token = makeToken(1);

    const bodyPromise = new Promise<string>((resolve, reject) => {
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      };
      const req = http.request(
        { host: '127.0.0.1', port, path: '/api/v1/stream/alarms', method: 'GET', headers },
        (res) => {
          const chunks: string[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
          res.on('end', () => resolve(chunks.join('')));
          res.on('error', reject);
        },
      );
      req.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
          resolve('');
          return;
        }
        reject(err);
      });
      req.end();
    });

    // Wait for token to expire (1 s + 150 ms buffer)
    await new Promise((r) => setTimeout(r, 1150));

    // Publish an event — server re-validates token, finds it expired, sends reauth
    publishAlarm({
      alarm: {
        Log_Serial_Number: '99',
        Alarm_key: null,
        Alarm_Name: 'AFTER_EXPIRY',
        Alarm_Severity: 'MINOR',
        Alarm_Source: null,
        Status: 'Not Clear',
        OccurrenceTime: new Date(),
        ClearanceTime: null,
        DownTime: null,
        LocationInformation: null,
        Contractor: null,
        FiberlinkSite_ID: null,
        FiberLinkSite_Name: null,
        Site_A_ID: null,
        Site_A_Latitude: null,
        Site_A_Longitude: null,
        State: null,
        Zone: null,
        Vendor: null,
        Site_Priority: null,
        Is_Hub: null,
        Is_VIP: null,
        Site_B_ID: null,
        Site_B_Latitude: null,
        Site_B_Longitude: null,
        Source_NE: null,
        Sink_NE: null,
      },
      resolvedLinkId: null,
      isFiberCut: false,
    });

    // Server closes the stream → bodyPromise resolves
    const body = await bodyPromise;
    expect(body).toContain('event: reauth');
  }, 10_000);
});
