import pg from 'pg';
import { env } from '../config/env.js';

// Read-write pool for the application database (PostGIS-enabled).
// The pool connects lazily on first query — startup cost is near-zero.
export const appPool = new pg.Pool({
  connectionString: env.APP_DB_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

appPool.on('error', (err) => {
  // Background client errors don't crash the process; logged for ops visibility.
  // eslint-disable-next-line no-console
  console.error('app-pool idle client error', err);
});
