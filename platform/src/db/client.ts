// =============================================================================
// The OS runtime DB client — the platform-owned Postgres connection.
// =============================================================================
// A single shared postgres-js client + a drizzle instance bound to the ENGINE schema (the OS owns
// goal_contract / goal_contract_event / workflow_run / workflow_step / outbox / the durable stores — the
// platform DB, PLATFORM-HOME-EXTRACTION.md §1). Faithful to rumah-admin/src/db/client.ts (SESSION pooler
// posture: max small pool, prepare:false, fail-fast connect) but reads the OS's own DATABASE_URL and binds
// the ENGINE's own table objects — no tenant schema.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { workflowRun, workflowStep, outbox, workflowApprovalAudit } from "../engine/schema.js";
import { databaseUrl } from "../env.js";

const schema = { workflowRun, workflowStep, outbox, workflowApprovalAudit };

// Serverless Postgres posture (inherited lesson, rumah-admin prod incident 2026-06-13): connect via the
// SESSION pooler (5432), small pool so concurrent requests get separate dedicated backends, prepare:false.
export const sql = postgres(databaseUrl(), {
  max: Number(process.env.DB_POOL_MAX ?? 5),
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle(sql, { schema });
