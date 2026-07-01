// =============================================================================
// OS migration runner (CLI) — forward-only, idempotent, re-runnable.
// =============================================================================
// Applies the OS's own migration set (platform/migrations) to the platform-owned DATABASE_URL. This is the
// re-homed migrator (rumah-admin/src/db/migrate.ts logic, moved) that applies ONLY OS migrations. Usage:
//   DATABASE_URL=postgres://... tsx src/db/migrate.ts
import postgres from "postgres";
import { databaseUrl } from "../env.js";
import { migrateUp } from "./migrate-core.js";

const sql = postgres(databaseUrl(), { max: 1 });

async function main() {
  const { discovered, applied } = await migrateUp(sql);
  console.log(`✓ OS migrations up to date (${discovered} discovered, ${applied} applied)`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("OS migration failed:", e);
  await sql.end();
  process.exit(1);
});
