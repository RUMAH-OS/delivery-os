// Apply the app's migration sequence into its OWN throwaway DB plane.
//   0000_app_role.sql            — app infra: create the least-privilege role the engine RLS policies grant.
//   0001_engine_core.sql         — the CANONICAL engine core DDL (applied verbatim from .claude/os/engine).
//   0002_engine_await_loop.sql   — the CANONICAL engine Slice-1 DDL (applied verbatim).
// This proves "the engine OWNS the DDL; the app APPLIES it per-plane." Each file runs in its own statement
// batch via postgres.js .unsafe(). Re-runnable from a fresh DB (the engine DDL is forward-only, not idempotent
// across re-applies — run against a clean throwaway DB, e.g. `npm run db:down && npm run db:up`).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "../src/engine-app/db.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

const FILES = [
  "0000_app_role.sql",      // app infra: the least-privilege role the engine RLS policies grant
  "0001_engine_core.sql",   // CANONICAL engine core DDL (verbatim)
  "0001a_app_outbox.sql",   // app infra: the outbox the engine emits to (engine DDL deliberately omits it)
  "0002_engine_await_loop.sql",   // CANONICAL engine Slice-1 DDL (verbatim)
  "0003_engine_agent_runner.sql", // CANONICAL engine runner claim/lease DDL (verbatim)
  "0004_engine_agent_id.sql",     // CANONICAL engine per-step agent requirement/resolved-id DDL (verbatim)
];

export async function migrate(): Promise<void> {
  // gen_random_uuid() lives in pgcrypto on older PG; PG13+ has it built-in, but enable to be safe on the image.
  await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  for (const f of FILES) {
    const ddl = readFileSync(join(migrationsDir, f), "utf8");
    await sql.unsafe(ddl);
    console.log(`  applied ${f}`);
  }
}

// allow `tsx scripts/migrate.ts` directly.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("migrate.ts")) {
  migrate()
    .then(() => sql.end())
    .then(() => console.log("migrate: done"))
    .catch((e) => {
      console.error("migrate: FAILED", e);
      process.exit(1);
    });
}
