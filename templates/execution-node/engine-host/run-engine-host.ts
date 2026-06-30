// Delivery OS — platform Engine Host (M2, ADR-005). The thin runnable that hosts the platform Execution
// Engine on an Execution Node. The engine itself is the vendored, domain-free library
// (../../workflow-engine); this host supplies the EngineContext impls (a Drizzle db over the PLATFORM
// durable store + the engine tables) and drives the tick CONTINUOUSLY — the always-on Execution Node's
// advantage over a serverless `*/5` cron (no cron-granularity limit; liveness is continuous).
//
// REPLACEABILITY (ADR-005): the node provides COMPUTE (this tick process); the DURABLE STORE is a MANAGED
// platform Postgres reached via ENGINE_DATABASE_URL — it is NOT node-local, so a node can be replaced
// without losing platform run/step state. Never point ENGINE_DATABASE_URL at a consumer's database.
//
// DOMAIN-FREE: this host runs the durable run/step/tick. Workflow DEFINITIONS + handlers + agents are
// domain code; they are registered into the engine registry at startup by the configured definition packs
// (ENGINE_PACKS), so consumers contribute their workflows without this host importing any consumer module.
//
// Run:  ENGINE_DATABASE_URL=postgres://… [TICK_IDLE_MS=2000] [TICK_BUSY_MS=50] tsx run-engine-host.ts
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Import the RUNNER directly from engine.js — NOT the barrel (index.js), which re-exports the HTTP route
// factories (goals/workflow/approvals-route) that pull in `hono`. The tick daemon serves no HTTP; the
// goal-API is a separate capability (Sprint 5.3 / control surface), so the daemon stays dependency-light.
import { createEngine } from "../../workflow-engine/engine.js";
import { workflowRun, workflowStep, outbox } from "../../workflow-engine/schema.js";

// The launchd service passes secrets via a 0600 ENGINE_ENV_FILE (KEY=VALUE lines) rather than the
// world-readable plist. Load it into process.env before reading config. Direct env still wins (tests).
const ENV_FILE = process.env.ENGINE_ENV_FILE;
if (ENV_FILE) {
  try {
    for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch (e) {
    console.error(`FATAL: ENGINE_ENV_FILE set but unreadable (${ENV_FILE}):`, e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

const DB_URL = process.env.ENGINE_DATABASE_URL;
if (!DB_URL) {
  console.error("FATAL: ENGINE_DATABASE_URL required (the MANAGED platform durable store — never node-local, never a consumer DB).");
  process.exit(1);
}
const TICK_BUSY_MS = Number(process.env.TICK_BUSY_MS ?? 50);   // keep draining while a tick advanced something
const TICK_IDLE_MS = Number(process.env.TICK_IDLE_MS ?? 2000); // back off when idle (still far tighter than */5)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  // Compute lives on the node; durable state lives in the managed store.
  const sqlClient = postgres(DB_URL, { max: 4, prepare: false });
  const db = drizzle(sqlClient);
  const engine = createEngine({ db: db as any, tables: { workflowRun, workflowStep, outbox } });

  // Domain definition packs (consumer-contributed; configured, never hard-imported here).
  await loadPacks();

  let stopping = false;
  const stop = () => { stopping = true; };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  console.log("Delivery OS engine host LIVE (continuous tick) — durable store is managed/off-node.");
  while (!stopping) {
    try {
      const report = await engine.tick();
      await sleep(report.advanced ? TICK_BUSY_MS : TICK_IDLE_MS);
    } catch (e) {
      // a transient store blip must not kill the host (the node is the liveness anchor); log + back off.
      console.error("tick error (continuing):", e instanceof Error ? e.message : String(e));
      await sleep(TICK_IDLE_MS);
    }
  }
  await sqlClient.end({ timeout: 5 });
  console.log("engine host stopped cleanly.");
}

// ENGINE_PACKS = comma-list of importable definition-pack modules (each does its own registerDefinition/
// registerHandler/registerVerifier on import). Empty is valid (a bare engine that only drains durable runs).
async function loadPacks(): Promise<void> {
  const packs = (process.env.ENGINE_PACKS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of packs) {
    try { await import(p); console.log(`registered definition pack: ${p}`); }
    catch (e) { console.error(`FATAL: could not load ENGINE_PACK '${p}':`, e instanceof Error ? e.message : String(e)); process.exit(1); }
  }
}

main().catch((e) => { console.error("engine host fatal:", e); process.exit(1); });
