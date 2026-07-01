// =============================================================================
// OS migration apply CORE — the ONE transactional-apply implementation (OS-owned).
// =============================================================================
// Faithful to rumah-admin/src/db/migrate-core.ts: discover forward migrations, per-file transactional apply,
// the `_migrations` ledger. Re-homed into the OS: MIGRATIONS_DIR points at the OS's OWN migration set
// (platform/migrations — the engine set 0001-0005 + the platform spine 0052/0053/0054/0055 + the 0000 role
// bootstrap). The tenant founder-gated denylist (0033/0035/0036) is INTENTIONALLY ABSENT — those are tenant
// domain riders and never live in the OS; the OS applies its whole own set forward-only.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Sql } from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, "..", "..", "migrations"); // src/db -> platform/migrations

/** Discover the forward migration files (sorted, excludes *.down.sql). Sort puts 0000_ role bootstrap first. */
export async function listForwardMigrations(): Promise<string[]> {
  return (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();
}

/** The _migrations ledger table (idempotent create). */
export async function ensureLedger(sql: Sql): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
}

export async function isApplied(sql: Sql, name: string): Promise<boolean> {
  const done = await sql`SELECT 1 FROM _migrations WHERE name = ${name}`;
  return done.length > 0;
}

/** The ONE per-file transactional apply: DDL + ledger row in a SINGLE tx (no half-apply). Idempotent. */
export async function applyOne(sql: Sql, name: string): Promise<boolean> {
  if (await isApplied(sql, name)) {
    console.log(`skip   ${name} (already applied)`);
    return false;
  }
  const ddl = await readFile(join(MIGRATIONS_DIR, name), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(ddl);
    await tx`INSERT INTO _migrations (name) VALUES (${name})`;
  });
  console.log(`apply  ${name}`);
  return true;
}

/** Apply every forward OS migration in order against `sql`. Returns { discovered, applied }. Re-runnable. */
export async function migrateUp(sql: Sql): Promise<{ discovered: number; applied: number; files: string[] }> {
  await ensureLedger(sql);
  const files = await listForwardMigrations();
  let applied = 0;
  for (const name of files) {
    if (await applyOne(sql, name)) applied++;
  }
  return { discovered: files.length, applied, files };
}
