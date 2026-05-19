/**
 * JWT authentication middleware.
 * Reads Authorization: Bearer <token>, verifies it, and attaches req.user.
 * Throws UnauthenticatedError (→ 401) on missing, malformed, or expired tokens.
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../auth/jwt.js';
import { UnauthenticatedError } from './error-handler.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthenticatedError());
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new UnauthenticatedError('Token expired or invalid'));
  }
}
