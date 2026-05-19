/**
 * LDAP authentication against @sd.zain.com Active Directory.
 * Ported from old-website/server.js:122-166 (behavior reference, rewritten clean).
 *
 * LDAP is reachable from the deploy host but NOT from CI runners.
 * CI tests run with AUTH_LOCAL_ONLY=true (Phase 0 Q3 resolution).
 */

import ldap from 'ldapjs';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export class LdapUnreachableError extends Error {
  constructor(message = 'LDAP server unreachable') {
    super(message);
    this.name = 'LdapUnreachableError';
  }
}

export class LdapInvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'LdapInvalidCredentialsError';
  }
}

/**
 * Binds to LDAP with the supplied credentials.
 * Returns the normalized username (stripped of @domain) on success.
 * Throws LdapUnreachableError or LdapInvalidCredentialsError.
 */
export async function ldapAuthenticate(
  username: string,
  password: string,
): Promise<string> {
  if (!env.LDAP_URL) {
    throw new LdapUnreachableError('LDAP_URL not configured');
  }

  // UPN format — old-website uses @sd.zain.com; LDAP_BIND_DN_TEMPLATE can override
  // if it contains a {username} placeholder (e.g. "{username}@corporate.example.com").
  const bindDn = env.LDAP_BIND_DN_TEMPLATE?.includes('{username}')
    ? env.LDAP_BIND_DN_TEMPLATE.replace('{username}', username)
    : username.includes('@')
      ? username
      : `${username}@sd.zain.com`;
  const normalizedUsername = username.includes('@') ? username.split('@')[0] : username;

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: env.LDAP_URL!,
      timeout: 5000,
      connectTimeout: 10000,
    });

    // Transport-level errors (host unreachable, connection refused)
    client.on('error', (err: Error) => {
      logger.warn({ err: err.message }, 'LDAP transport error');
      client.destroy();
      reject(new LdapUnreachableError(err.message));
    });

    client.bind(bindDn, password, (err) => {
      if (err) {
        client.destroy();
        logger.warn({ ldap_error: err.message }, 'LDAP bind failed');
        // ldapjs error code 49 = LDAP_INVALID_CREDENTIALS
        const code = (err as { code?: number }).code;
        if (code === 49 || err.message.toLowerCase().includes('invalid credentials')) {
          reject(new LdapInvalidCredentialsError());
        } else {
          reject(new LdapUnreachableError(err.message));
        }
        return;
      }

      logger.info({ username: normalizedUsername }, 'LDAP authentication successful');
      client.unbind(() => undefined);
      resolve(normalizedUsername);
    });
  });
}
