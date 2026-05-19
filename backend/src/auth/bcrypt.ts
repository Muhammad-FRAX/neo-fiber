/**
 * Local-fallback auth using bcrypt-hashed passwords stored in the app DB.
 * Active when AUTH_LOCAL_ONLY=true (CI, dev without LDAP).
 * Production uses pure LDAP (see DESIGN.md Phase 0 Q3).
 */

import bcrypt from 'bcrypt';
import { appPool } from '../db/app-pool.js';
import { logger } from '../lib/logger.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

interface LocalUser {
  id: number;
  ldap_username: string;
  display_name: string | null;
  role: string;
}

/**
 * Looks up a user by username, compares the bcrypt-hashed password.
 * Returns the user row on success, null on any failure (user not found / wrong password).
 * Constant-time comparison via bcrypt prevents timing attacks.
 */
export async function localAuthenticate(
  username: string,
  password: string,
): Promise<LocalUser | null> {
  const { rows } = await appPool.query<LocalUser & { password_hash: string | null }>(
    `SELECT id, ldap_username, display_name, role, password_hash
     FROM users WHERE ldap_username = $1`,
    [username],
  );

  const user = rows[0];
  if (!user?.password_hash) {
    logger.warn({ username }, 'Local auth: user not found or no password set');
    // Run a dummy compare to avoid timing leak on missing user
    await bcrypt.compare(password, '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    return null;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    logger.warn({ username }, 'Local auth: password mismatch');
    return null;
  }

  return { id: user.id, ldap_username: user.ldap_username, display_name: user.display_name, role: user.role };
}
