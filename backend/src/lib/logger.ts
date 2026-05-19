import { AsyncLocalStorage } from 'async_hooks';
import pino from 'pino';
import { env } from '../config/env.js';

export interface RequestContext {
  request_id: string;
  user_id?: number;
  route?: string;
}

export const requestStorage = new AsyncLocalStorage<RequestContext>();

export const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    bindings: (bindings) => ({ pid: bindings.pid, hostname: bindings.hostname }),
  },
  mixin() {
    const ctx = requestStorage.getStore();
    if (!ctx) return {};
    const { request_id, user_id, route } = ctx;
    return {
      request_id,
      ...(user_id !== undefined ? { user_id } : {}),
      ...(route !== undefined ? { route } : {}),
    };
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
