// =============================================================================
// The OS heartbeat / tick driver — the liveness keystone (PLATFORM-HOME-EXTRACTION.md §1.1 #6: "heartbeat is
// OS; a tenant does not own liveness").
// =============================================================================
// Each beat does three things, all OS-owned:
//   1. STAMP liveness — upsert engine_heartbeat.last_beat_at for this node_id (migration 0005). A DB-plane
//      watchdog (a DIFFERENT failure domain) reads last_beat_at and alarms if it goes stale (the dead-man
//      switch). PII-free: a node id + a timestamp.
//   2. ENGINE TICK — drive the engine's exactly-once SKIP-LOCKED tick (advances at most one workflow
//      transition per call). On a bare OS with zero runs enqueued this is a legal idle no-op.
//   3. RECONCILER SWEEP — drive the C2-LOOP over the goal portfolio (reconciler-loop.ts). On a bare OS the
//      portfolio is empty → idle.
// The heartbeat NEVER mutates a GoalContract itself — it drives the reconciler, which is the sole mutator.
import { sql } from "./db/client.js";
import { reconcileSweep, type SweepResult, type ReasoningSweepDeps } from "./reconciler-loop.js";
import type { OsEngineRuntime } from "./engine-runtime.js";

export const NODE_ID = process.env.OS_NODE_ID ?? "os-runtime-local";

export interface BeatResult {
  nodeId: string;
  beatAt: string;
  engineTick: { advanced: boolean; note: string };
  reconciler: SweepResult;
}

/** Stamp the liveness row for this node (idempotent upsert). Host-written, host-owned liveness. */
export async function stampHeartbeat(nodeId: string = NODE_ID): Promise<string> {
  const [row] = await sql<{ last_beat_at: string }[]>`
    INSERT INTO engine_heartbeat (node_id, last_beat_at) VALUES (${nodeId}, now())
    ON CONFLICT (node_id) DO UPDATE SET last_beat_at = now()
    RETURNING last_beat_at`;
  return row!.last_beat_at;
}

/** Read the freshest beat for a node (the watchdog's read side). null if the node has never beat. */
export async function readHeartbeat(nodeId: string = NODE_ID): Promise<string | null> {
  const [row] = await sql<{ last_beat_at: string }[]>`
    SELECT last_beat_at FROM engine_heartbeat WHERE node_id = ${nodeId}`;
  return row?.last_beat_at ?? null;
}

/** One beat: stamp liveness → engine tick → reconciler sweep. Returns the observable beat report.
 *  `reasoning` is the enforce-flip capability constructed at boot (undefined ⇒ the sweep keeps its exact
 *  current SHADOW behavior — the double-gate in reconcileSweep is the authority; passing it here just makes the
 *  real bound organs available to a sweep that the flag also arms). */
export async function beat(
  os: OsEngineRuntime,
  opts: { enforce?: boolean; reasoning?: ReasoningSweepDeps } = {},
): Promise<BeatResult> {
  const beatAt = await stampHeartbeat();
  const report = await os.tick();
  const reconciler = await reconcileSweep({ enforce: opts.enforce, reasoning: opts.reasoning });
  return {
    nodeId: NODE_ID,
    beatAt,
    engineTick: { advanced: report.advanced, note: report.detail ?? (report.advanced ? "advanced" : "idle") },
    reconciler,
  };
}

/** The running tick loop. Beats every `intervalMs` until `stop()` is called. Returns a stopper. Errors in a
 *  single beat are logged, never fatal (a late/failed beat must not kill the loop — the resync property). */
export function startHeartbeatLoop(
  os: OsEngineRuntime,
  intervalMs = Number(process.env.OS_TICK_MS ?? 5000),
  opts: { reasoning?: ReasoningSweepDeps } = {},
): { stop: () => void } {
  let running = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const loop = async () => {
    if (!running) return;
    try {
      await beat(os, { reasoning: opts.reasoning });
    } catch (e) {
      console.error(`[heartbeat] beat error (non-fatal):`, e instanceof Error ? e.message : e);
    }
    if (running) timer = setTimeout(loop, intervalMs);
  };
  void loop();
  return {
    stop: () => {
      running = false;
      if (timer) clearTimeout(timer);
    },
  };
}
