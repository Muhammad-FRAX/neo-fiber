import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from './error-handler.js';

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    next(new ForbiddenError('Admin role required'));
    return;
  }
  next();
}
