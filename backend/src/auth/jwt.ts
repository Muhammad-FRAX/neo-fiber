/**
 * JWT sign + verify helpers.
 *
 * Per DESIGN.md §9 auth (A4):
 *   - localStorage storage on the frontend
 *   - Authorization: Bearer <token> header on every request
 *   - 8-hour TTL (JWT_TTL_SECONDS env var)
 *   - No refresh token — 401 on expiry triggers frontend redirect to /login
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: number;       // users.id
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

/**
 * Verifies and decodes a JWT.
 * Throws JsonWebTokenError / TokenExpiredError (from jsonwebtoken) on invalid input.
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as JwtPayload;
}
