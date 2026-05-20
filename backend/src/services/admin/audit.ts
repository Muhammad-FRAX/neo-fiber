import { appPool } from '../../db/app-pool.js';

export async function recordAudit(
  userId: number | null,
  action: string,
  beforeState: unknown,
  afterState: unknown,
): Promise<void> {
  await appPool.query(
    `INSERT INTO topology_audit (user_id, action, before_state, after_state)
     VALUES ($1, $2, $3, $4)`,
    [userId ?? null, action, beforeState ?? null, afterState ?? null],
  );
}
