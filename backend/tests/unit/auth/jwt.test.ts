/**
 * Unit tests for JWT sign + verify helpers.
 * No DB, no containers — pure in-process.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Set env before importing the module under test
beforeAll(() => {
  process.env['JWT_SECRET'] = 'unit-test-secret-that-is-exactly-32ch!';
  process.env['JWT_TTL_SECONDS'] = '28800';
  process.env['APP_DB_URL'] = 'postgres://unused:unused@localhost:5432/unused';
  process.env['DWH_URL'] = 'postgres://unused:unused@localhost:5432/unused';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['NODE_ENV'] = 'test';
});

describe('signToken / verifyToken', () => {
  it('signs a token that can be verified', async () => {
    const { signToken, verifyToken } = await import('../../../src/auth/jwt.js');

    const token = signToken({ sub: 42, username: 'testuser', role: 'viewer' });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // header.payload.signature

    const payload = verifyToken(token);
    expect(payload.sub).toBe(42);
    expect(payload.username).toBe('testuser');
    expect(payload.role).toBe('viewer');
  });

  it('throws on a malformed token', async () => {
    const { verifyToken } = await import('../../../src/auth/jwt.js');
    expect(() => verifyToken('not.a.valid.jwt')).toThrow();
  });

  it('throws on a token signed with a different secret', async () => {
    const jwt = await import('jsonwebtoken');
    const { verifyToken } = await import('../../../src/auth/jwt.js');
    const wrongToken = jwt.default.sign({ sub: 1, username: 'x', role: 'viewer' }, 'wrong-secret-xxxxxxxxxxxxxxxxxxxxx');
    expect(() => verifyToken(wrongToken)).toThrow();
  });

  it('throws on an expired token (TTL=1s)', async () => {
    const jwt = await import('jsonwebtoken');
    const { verifyToken } = await import('../../../src/auth/jwt.js');

    const expired = jwt.default.sign(
      { sub: 1, username: 'x', role: 'viewer' },
      process.env['JWT_SECRET']!,
      { expiresIn: 1, algorithm: 'HS256' },
    );

    await new Promise((r) => setTimeout(r, 1100));
    expect(() => verifyToken(expired)).toThrow(/expired/i);
  });
});
