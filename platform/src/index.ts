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
import { PgCapabilityRegistrationStore } from "./capability-registration-store-pg.js";
import { rehydrateRegistrations } from "./capability-registration.js";
import { loadRoutingConfig, RoutingConfigError } from "./reasoning/routing-config.js";
import { ModelRouter } from "./reasoning/model-router.js";
import { armedReasoning } from "./reasoning/boot-organs.js";

// BOOT RESOLUTION MAP (ADR-reasoning-model-routing.md §"Model-agnostic enforcement"): resolve every reasoning
// class against the deployment's model access and LOG the map. Availability is runtime-resolved — a not-yet-
// provisioned model simply reports resolves=false and falls through its fallback chain. This is diagnostic
// only; it must NEVER crash boot (a config fault is logged loud; unavailable models are expected + fine).
function logReasoningResolutionMap(): void {
  try {
    const router = new ModelRouter(loadRoutingConfig()); // default predicate: all available (no runtime probe yet)
    const map = router.resolveAll();
    const classes = Object.keys(map);
    const unresolvable = classes.filter((c) => !map[c as keyof typeof map].resolvable);
    console.log(
      `[boot] reasoning resolution map — ${classes.length} classes resolved` +
        (unresolvable.length ? ` (UNRESOLVABLE: ${unresolvable.join(", ")})` : " (all resolvable)"),
    );
    for (const c of classes) {
      const e = map[c as keyof typeof map];
      console.log(`[boot]   ${c}: ${e.candidates.map((x) => `${x.model}${x.resolves ? "" : "(x)"}`).join(" → ")}`);
    }
  } catch (e) {
    const why = e instanceof RoutingConfigError ? e.message : e instanceof Error ? e.message : String(e);
    console.warn(`[boot] reasoning resolution map SKIPPED (routing config fault, non-fatal): ${why}`);
  }
}

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

  // Log the class→model resolution map (diagnostic; never crashes boot — see logReasoningResolutionMap).
  logReasoningResolutionMap();

  // DURABILITY (E-PH M3a): the platform-owned registration store. On boot the OS RE-HYDRATES tenant
  // registrations persisted across a restart — re-synthesizing each tenant's proxy handlers (never importing
  // tenant code). Skipped when migrations are off (the DB-free test/boot posture keeps the bare OS bare).
  const registrationStore = new PgCapabilityRegistrationStore();
  if (doMigrate) {
    const rehydrated = await rehydrateRegistrations(os, registrationStore);
    console.log(
      `[boot] re-hydrated ${rehydrated.tenants} tenant registration(s) (${rehydrated.packs} pack(s))` +
        (rehydrated.failures.length ? ` — ${rehydrated.failures.length} failed: ${rehydrated.failures.map((f) => f.tenantId).join(", ")}` : ""),
    );
  }

  const app = createServer(os, { registrationStore });
  let stopTick: (() => void) | undefined;
  let server: ReturnType<typeof serve> | undefined;

  if (doTick) {
    // THE ENFORCE-FLIP ACTIVATION (PLATFORM_REASONING_DRIVES_GOALS): flag ON ⇒ CONSTRUCT the real bound organs
    // once and inject them into the sweep, so the reconciler drives goals by reasoning (fail-closed to the
    // founder on hard pre-flight calls). Flag OFF (the DEFAULT) ⇒ armedReasoning() constructs NOTHING and returns
    // undefined — the loop stays inert SHADOW (zero autonomous mutation), byte-for-byte the prior behavior. The
    // double-gate lives in reconcileSweep; this only decides whether the capability is even built + handed in.
    const reasoning = armedReasoning();
    console.log(
      reasoning
        ? "[boot] enforce-flip ARMED — reasoning drives goals (fail-closed to founder on hard calls)"
        : "[boot] enforce-flip OFF — shadow reconcile (zero autonomous mutation)",
    );
    stopTick = startHeartbeatLoop(os, undefined, { reasoning }).stop;
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
