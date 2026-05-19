import pg from 'pg';
import { env } from '../config/env.js';

// Read-only pool to the external Zain Sudan DWH Postgres.
// NEVER write through this pool — DWH is append-only with in-place status updates.
// Not reachable from CI runners; tests substitute a testcontainers fixture (§12.5).
export const dwhPool = new pg.Pool({
  connectionString: env.DWH_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

dwhPool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('dwh-pool idle client error', err);
});
