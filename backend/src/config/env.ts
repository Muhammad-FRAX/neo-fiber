import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('5000')
    .transform((v) => parseInt(v, 10)),

  // Databases — both required at startup (see §9 databases)
  APP_DB_URL: z.string().min(1, 'APP_DB_URL is required'),
  DWH_URL: z.string().min(1, 'DWH_URL is required'),

  // LDAP auth (§9 auth) — LDAP is reachable from deploy host but NOT from CI
  // Set AUTH_LOCAL_ONLY=true in CI or local dev without LDAP (Phase 0 Q3)
  LDAP_URL: z.string().optional(),
  LDAP_BIND_DN_TEMPLATE: z.string().optional(),
  AUTH_LOCAL_ONLY: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  // JWT — localStorage, 8h TTL, no refresh token (DESIGN.md §9 auth + A4)
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL_SECONDS: z
    .string()
    .default('28800')
    .transform((v) => parseInt(v, 10)),

  // Fiber-cut alarm filter (§7 premise 8): empty = no alarm triggers reachability
  FIBER_CUT_ALARM_NAME: z.string().default(''),

  // DWH polling — default 30s; DWH has 1-2 min new-row latency (Phase 0 Q4)
  DWH_POLL_INTERVAL_MS: z
    .string()
    .default('30000')
    .transform((v) => parseInt(v, 10)),

  // SSE heartbeat to defeat corporate proxy idle-timeout (§9 A6)
  SSE_HEARTBEAT_MS: z
    .string()
    .default('25000')
    .transform((v) => parseInt(v, 10)),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`Fatal: invalid environment variables:\n${errors}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
