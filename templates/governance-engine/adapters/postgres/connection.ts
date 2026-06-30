// =============================================================================
// governance-engine — REFERENCE POSTGRES ADAPTER · connection + template-migration applier.
// =============================================================================
// CONSUMER-SIDE PLANE (NOT part of the engine organ surface). This file lives under `adapters/` — the directory
// the residency guard scopes OUT — precisely because it DOES what the package never may: it imports the `postgres`
// driver and opens a real connection. A real consumer (admin / PLOS) copies/adapts this; it is shipped as a
// working reference of "how to wire the two store ports to a Postgres", not as engine code.
//
// It provides three things a consumer needs to stand the runtime up on Postgres:
//   * `openPostgres(url)`            — a postgres-js client tuned for this concurrent, multi-statement runtime work
//                                      (SESSION pooler / direct — NEVER the :6543 transaction pooler, per
//                                      runtime-stores.ts:9; advisory locks + multi-statement txns need a session).
//   * `applyTemplateMigrations(sql)` — read the de-admin'd `migrations/0001`+`0002` template, substitute
//                                      `{{app_role}}`, and apply them (the faithfulness self-test uses this to
//                                      stand up a throwaway test DB exactly as a consumer would).
//   * `dropTemplateMigrations(sql)`  — apply the paired DOWN files (clean-room teardown; idempotent).
// =============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres, { type Sql } from "postgres";

export type { Sql };

const HERE = dirname(fileURLToPath(import.meta.url));
// adapters/postgres/ -> ../../migrations/
const MIGRATIONS_DIR = join(HERE, "..", "..", "migrations");

export interface OpenPostgresOptions {
  /** max pool size. The runtime is light + serial; a small pool is plenty (default 4). */
  max?: number;
  /** statement/connect timeouts in seconds. */
  connectTimeout?: number;
}

/**
 * Open a postgres-js client for the governance runtime. Mirrors admin's `src/db/client.ts` posture: the
 * durable-store work is concurrent + multi-statement (advisory locks, `sql.begin`), so it needs a SESSION-level
 * connection — never the :6543 transaction pooler. Pass a direct / session-pooler URL.
 */
export function openPostgres(url: string, opts: OpenPostgresOptions = {}): Sql {
  return postgres(url, {
    max: opts.max ?? 4,
    idle_timeout: 20,
    connect_timeout: opts.connectTimeout ?? 10,
    // prepared statements are fine on a session connection; left default. onnotice silenced for clean test output.
    onnotice: () => {},
  });
}

/** Substitute the de-admin'd `{{app_role}}` token for the consumer's runtime role. */
export function deAdmin(sqlText: string, appRole: string): string {
  return sqlText.replace(/\{\{app_role\}\}/g, appRole);
}

export interface ApplyMigrationsOptions {
  /** the consumer runtime role the RLS policies target (substituted for `{{app_role}}`). */
  appRole: string;
  /** override the migrations dir (default: the package's shipped `migrations/`). */
  migrationsDir?: string;
}

const UP_FILES = ["0001_goal_contract.sql", "0002_runtime_durable_stores.sql"];
const DOWN_FILES = ["0002_runtime_durable_stores.down.sql", "0001_goal_contract.down.sql"];

/**
 * Apply the de-admin'd template migrations (0001 then 0002) to `sql`. Each file is sent as ONE simple-protocol
 * batch (`sql.unsafe`), which is correct for the dollar-quoted PL/pgSQL function bodies + the multi-statement DDL.
 * The `{{app_role}}` token is substituted for `appRole`. This is exactly the path a consumer's migrator takes,
 * minus the consumer's own applied-number bookkeeping.
 */
export async function applyTemplateMigrations(sql: Sql, opts: ApplyMigrationsOptions): Promise<string[]> {
  const dir = opts.migrationsDir ?? MIGRATIONS_DIR;
  const applied: string[] = [];
  for (const file of UP_FILES) {
    const raw = readFileSync(join(dir, file), "utf8");
    await sql.unsafe(deAdmin(raw, opts.appRole));
    applied.push(file);
  }
  return applied;
}

/** Apply the paired DOWN migrations (reverse order; idempotent IF EXISTS). Clean-room teardown only. */
export async function dropTemplateMigrations(sql: Sql, opts: { migrationsDir?: string } = {}): Promise<string[]> {
  const dir = opts.migrationsDir ?? MIGRATIONS_DIR;
  const dropped: string[] = [];
  for (const file of DOWN_FILES) {
    const raw = readFileSync(join(dir, file), "utf8");
    await sql.unsafe(raw);
    dropped.push(file);
  }
  return dropped;
}
