// =============================================================================
// infrastructure/execution-node/bootstrap/worker-entry.mjs  —  the WORKER_ENTRY (the launchd `main`).
// -----------------------------------------------------------------------------
// THE COMPOSITION ROOT (architecture.config.json layer "composition"). This is the Clean-Architecture
// `main` — the OUTERMOST ring, outside every gated layer. It is the ONLY place in the subsystem allowed
// to import BOTH Core (`createGovernanceRuntime`) AND the adapters, because wiring an inner organ to an
// outer adapter is exactly what a composition root does. worker-daemon.ts documents why the daemon
// itself must NOT do this (an adapter importing a Core internal would trip arch-boundary-guard).
//
// The `com.deliveryos.worker` LaunchDaemon invokes this file (NEO-EXEC-07 §5.1):
//     /usr/bin/caffeinate -dimsu  {{NODE_BIN}}  {{WORKER_ENTRY=this}}
// FAIL-CLOSED BOOT: config-doctor runs FIRST and exits non-zero on an incomplete secret set, so a
// half-bootstrapped node never starts draining (KeepAlive throttles → the off-node dead-man fires).
//
// Secrets come ONLY from the macOS SYSTEM keychain (DOS_SECRET_SOURCE=system-keychain) — never a file,
// never a dotenv. This file reads nothing secret from its own tree.
// =============================================================================

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Core — legal ONLY in this unclassified composition root (mayImport: core, contracts, adapters).
import { createGovernanceRuntime } from "../../../templates/governance-engine/runtime.js";
// the durable-bus adapter (Postgres/Supabase) — the consumer plane.
import {
  openPostgres,
  createPostgresRuntimeStores,
  createPostgresGoalContractStore,
} from "../../../templates/governance-engine/adapters/postgres/index.js";
// the Neo adapters (ExecutionProviderPort + the Health-Emission Contract impl).
import { NeoExecutionProvider } from "../adapters/neo/neo-execution-provider.js";
import { NeoHeartbeatEmitter, NeoHealthProvider } from "../adapters/neo/neo-health.js";
import { WorkerDaemon } from "../worker-daemon.js";
// the sibling composition entry (RUNTIME_TICK_ENTRY) — the runtime-drain seam this daemon advances.
import { createRuntimeTick } from "./runtime-tick.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");

// ── the ONE canonical node id: launchd injects DOS_NODE_ID; default = the canonical registry id. ──
const nodeId = process.env.DOS_NODE_ID ?? "neo-node2";
const runnerUser = process.env.DOS_RUNNER_USER ?? "ci-runner";
const tickIntervalMs = Number(process.env.DOS_TICK_INTERVAL_MS ?? "20000");

// ── secret resolution: System keychain ONLY (root-readable at boot; never the login keychain). ──
function secret(key) {
  if ((process.env.DOS_SECRET_SOURCE ?? "system-keychain") !== "system-keychain") {
    throw new Error(`worker-entry: refusing to read '${key}' from a non-keychain source (fail-closed).`);
  }
  try {
    return execFileSync(
      "/usr/bin/security",
      ["find-generic-password", "-a", runnerUser, "-s", key, "-w", "/Library/Keychains/System.keychain"],
      { encoding: "utf8" },
    ).trim();
  } catch {
    throw new Error(`worker-entry: secret '${key}' not present in the System keychain — run bootstrap-secrets.sh (fail-closed).`);
  }
}

// ── FAIL-CLOSED BOOT: config-doctor must pass before we open a single connection. ──
function configDoctorGate() {
  const doctor = resolve(REPO_ROOT, "templates", "tools", "config-doctor.mjs");
  try {
    execFileSync(process.execPath, [doctor, "--include-local"], { stdio: "inherit" });
  } catch {
    throw new Error("worker-entry: config-doctor FAILED CLOSED — a required secret is missing/invalid. Refusing to start.");
  }
}

async function main() {
  configDoctorGate();

  // (1) open the durable bus on the keychain-resolved DATABASE_URL (Supabase pooler).
  const sql = openPostgres(secret("DATABASE_URL"));

  // (2) wire the Core runtime onto the Postgres adapter ports (the only Core touch in the subsystem).
  const runtime = createGovernanceRuntime({
    runtimeStores: createPostgresRuntimeStores(sql),
    goalContractStore: createPostgresGoalContractStore(sql),
  });

  // (3) the ExecutionProviderPort registry the placement selector reads — Neo = the one node here.
  const registry = [new NeoExecutionProvider({ nodeId })];

  // (4) the heartbeat sink: upsert engine_heartbeat{nodeId} onto the durable bus (Layer A/B).
  const heartbeatEmitter = new NeoHeartbeatEmitter({
    sink: async (beat) => {
      await sql`
        insert into engine_heartbeat (node_id, tick_seq, last_tick_at, consumer_cursor, gs_posted_at)
        values (${beat.nodeId}, ${beat.tickSeq}, ${beat.lastTickAt}, ${beat.consumerCursor ?? null}, ${beat.gsPostedAt ?? null})
        on conflict (node_id) do update set
          tick_seq = excluded.tick_seq,
          last_tick_at = excluded.last_tick_at,
          consumer_cursor = excluded.consumer_cursor,
          gs_posted_at = excluded.gs_posted_at
      `;
    },
  });

  // (5) the health provider (service = the SAME canonical id stamped on every heartbeat).
  const healthProvider = new NeoHealthProvider({ service: nodeId });

  // (6) the daemon — drain seam + heartbeat in lock-step; KeepAlive-supervised.
  const daemon = new WorkerDaemon({
    nodeId,
    runtimeTick: createRuntimeTick({ runtime, registry }),
    heartbeatEmitter,
    healthProvider,
    tickIntervalMs,
  });

  daemon.start();
  // eslint-disable-next-line no-console
  console.error(`[worker-entry] started: node=${nodeId} tick=${tickIntervalMs}ms (KeepAlive-supervised)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[worker-entry] FATAL: ${err?.message ?? err}`);
  process.exit(1);
});
