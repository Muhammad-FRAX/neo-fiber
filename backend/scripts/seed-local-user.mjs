// One-shot helper: create a local bcrypt user for AUTH_LOCAL_ONLY=true mode.
// Run with: node scripts/seed-local-user.mjs [username] [password] [role]
// Defaults: admin / admin123 / admin
// Idempotent — re-running updates the password.

import bcrypt from 'bcrypt';
import pg from 'pg';
import 'dotenv/config';

const [, , username = 'admin', password = 'admin123', role = 'admin'] = process.argv;

const connectionString =
  process.env.APP_DB_URL ||
  'postgres://neo_fiber:neo_fiber_dev@localhost:5432/neo_fiber';

const client = new pg.Client({ connectionString });
await client.connect();

const hash = await bcrypt.hash(password, 12);

await client.query(
  `INSERT INTO users (ldap_username, display_name, role, password_hash)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (ldap_username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
  [username, username, role, hash],
);

await client.end();
console.log(`Ready: username='${username}' password='${password}' role='${role}'`);
