// =============================================================================
// The OS runtime ENTRYPOINT — boot the platform as a running process.
// =============================================================================
// This is what makes delivery-os a RUNNABLE PLATFORM (PLATFORM-HOME-EXTRACTION.md §0.1: today delivery-os is
// "a library + standards repo, not a runtime"; M1 makes it boot). The boot sequence:
//   1. MIGRATE — apply the OS's own migration set to the platform-owned DATABASE_URL (forward-only).
//   2. CONSTRUCT — build the engine with ZERO tenant packs (the vendor→consume flip).
//   3. SERVE — start the /v1 HTTP surface.
//   4. TICK — start the heartbeat/reconciler loop (liveness + the C2-LOOP sweep).
// The OS boots BARE: no tenant program is required, imported, or registered.
import postgres from "postgres";
import { serve } from "@hono/node-server";
import { databaseUrl } from "./env.js";
import { migrateUp } from "./db/migrate-core.js";
import { createOsEngineRuntime } from "./engine-runtime.js";
import { createServer, OS_VERSION } from "./server.js";
import { startHeartbeatLoop, NODE_ID } from "./heartbeat.js";

async function migrate(): Promise<void> {
  const sql = postgres(databaseUrl(), { max: 1 });
  try {
    const { discovered, applied } = await migrateUp(sql);
    console.log(`[boot] migrations up to date (${discovered} discovered, ${applied} applied)`);
  } finally {
    await sql.end();
  }
}

export async function boot(opts: { migrate?: boolean; serve?: boolean; tick?: boolean } = {}) {
  const doMigrate = opts.migrate ?? true;
  const doServe = opts.serve ?? true;
  const doTick = opts.tick ?? true;

  if (doMigrate) await migrate();

  // THE FLIP: construct the engine with zero tenant packs.
  const os = createOsEngineRuntime();
  console.log(`[boot] ${OS_VERSION} engine constructed — registered tenant packs: ${os.registeredPackIds().length} (bare OS)`);

  const app = createServer(os);
  let stopTick: (() => void) | undefined;
  let server: ReturnType<typeof serve> | undefined;

  if (doTick) {
    stopTick = startHeartbeatLoop(os).stop;
    console.log(`[boot] heartbeat/reconciler loop started (node ${NODE_ID})`);
  }
  if (doServe) {
    const port = Number(process.env.PORT ?? 8787);
    server = serve({ fetch: app.fetch, port });
    console.log(`[boot] OS listening on :${port} — bare (zero tenants). Front door: POST /v1/goals`);
  }

  return {
    os,
    app,
    stop: () => {
      stopTick?.();
      (server as any)?.close?.();
    },
  };
}

// Run when invoked directly (not when imported by tests).
const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (invokedDirectly) {
  boot().catch((e) => {
    console.error("[boot] FAILED:", e);
    process.exit(1);
  });
}
