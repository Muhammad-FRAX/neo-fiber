/**
 * Auth routes: POST /login, POST /logout, GET /me
 *
 * Login flow (DESIGN.md §9 auth, A4):
 *   1. Validate body with Zod
 *   2. AUTH_LOCAL_ONLY=true → bcrypt path; else → LDAP bind
 *   3. Upsert user row (ldap path) / lookup user row (local path)
 *   4. Sign 8h JWT, return { token, user }
 *
 * No refresh token. 401 on expiry → frontend deletes localStorage token + redirects.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  asyncHandler,
  UnauthenticatedError,
  AppError,
} from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { signToken } from '../auth/jwt.js';
import {
  ldapAuthenticate,
  LdapUnreachableError,
  LdapInvalidCredentialsError,
} from '../auth/ldap.js';
import { localAuthenticate } from '../auth/bcrypt.js';
import { appPool } from '../db/app-pool.js';
import { logger } from '../lib/logger.js';

const loginSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(255)
    .regex(/^\S+$/, 'Username must not contain spaces'),
  password: z.string().min(1),
});

const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid username or password',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const { username, password } = parsed.data;

    let userId: number;
    let userRole: string;
    let displayName: string | null;
    let resolvedUsername: string;

    if (env.AUTH_LOCAL_ONLY) {
      const user = await localAuthenticate(username, password);
      if (!user) {
        throw new UnauthenticatedError('Invalid credentials');
      }
      userId = user.id;
      userRole = user.role;
      displayName = user.display_name;
      resolvedUsername = user.ldap_username;
    } else {
      let ldapUsername: string;
      try {
        ldapUsername = await ldapAuthenticate(username, password);
      } catch (err) {
        if (err instanceof LdapUnreachableError) {
          logger.error({ err: (err as Error).message }, 'LDAP unreachable during login');
          throw new AppError('LDAP_UNREACHABLE', 'Login server unreachable — contact admin', 503);
        }
        if (err instanceof LdapInvalidCredentialsError) {
          throw new UnauthenticatedError('Invalid credentials');
        }
        throw err;
      }

      // Upsert user into app DB; set last_login on every successful auth
      const { rows } = await appPool.query<{
        id: number;
        role: string;
        display_name: string | null;
      }>(
        `INSERT INTO users (ldap_username, last_login)
         VALUES ($1, NOW())
         ON CONFLICT (ldap_username)
         DO UPDATE SET last_login = NOW()
         RETURNING id, role, display_name`,
        [ldapUsername],
      );

      userId = rows[0].id;
      userRole = rows[0].role;
      displayName = rows[0].display_name;
      resolvedUsername = ldapUsername;
    }

    const token = signToken({ sub: userId, username: resolvedUsername, role: userRole });
    logger.info({ user_id: userId, username: resolvedUsername }, 'login success');

    res.json({
      token,
      user: {
        id: userId,
        username: resolvedUsername,
        display_name: displayName,
        role: userRole,
      },
    });
  }),
);

// POST /api/v1/auth/logout
// JWT is stateless; no token blacklist (A4). Client deletes from localStorage.
authRouter.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out' });
});

// GET /api/v1/auth/me
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await appPool.query<{
      id: number;
      ldap_username: string;
      display_name: string | null;
      role: string;
      last_login: Date | null;
    }>(
      `SELECT id, ldap_username, display_name, role, last_login
       FROM users WHERE id = $1`,
      [req.user!.sub],
    );

    if (!rows[0]) {
      throw new UnauthenticatedError('User not found');
    }

    res.json({
      user: {
        id: rows[0].id,
        username: rows[0].ldap_username,
        display_name: rows[0].display_name,
        role: rows[0].role,
        last_login: rows[0].last_login,
      },
    });
  }),
);

export default authRouter;
