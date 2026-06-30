// =============================================================================
// infrastructure/execution-node — the WORKER DAEMON entry (the launchd-supervised drain loop on Neo).
// =============================================================================
// The process that, on Neo, OWNS ITS OWN CLOCK: each tick it advances the runtime (drains the durable bus) and
// EMITS a heartbeat via the Core-owned Health-Emission Contract. This is the `com.deliveryos.worker`
// LaunchDaemon's long-lived body (NEO-EXEC-07 §4 / §5.1). Liveness is proven by ADVANCING data (the heartbeat's
// monotonic `tickSeq` + the consumer cursor), not by a live process — alive ≠ moving.
//
// ── THE BOUNDARY (the keystone this whole subsystem proves) ──────────────────────────────────────────────────
// This file is in the `adapters` layer (architecture.config.json → infrastructure). It may import CONTRACTS and
// sibling ADAPTERS — it may NOT import a Core internal. In particular it does NOT `import { createGovernanceRuntime }`
// from templates/governance-engine: that is a Core symbol, and an adapter reaching it would VIOLATE the inward-only
// rule (and the arch-boundary-guard would fail the push). Instead the daemon depends on a minimal INJECTED
// `RuntimeTick` seam. The Core↔adapter WIRING is performed by an UNCLASSIFIED composition root (the launchd
// `WORKER_ENTRY`, outside every gated layer) — see "THE COMPOSITION ROOT" below. That the composition root is the
// ONLY place allowed to touch both Core and this adapter IS the architecture working as designed.
//
// ── THE COMPOSITION ROOT (documented wiring — NOT built here; it is the unclassified `main`) ─────────────────
//   // worker-entry.mjs  (the launchd WORKER_ENTRY — an unclassified bootstrap, NOT under a gated layer)
//   import { createGovernanceRuntime } from "<core>/runtime.js";           // Core — legal ONLY in the unclassified root
//   import { createPostgresRuntimeStores, createPostgresGoalContractStore, openPostgres }
//     from "<core>/adapters/postgres/index.js";                            // the durable-bus adapter
//   import { NeoExecutionProvider } from "./adapters/neo/neo-execution-provider.js";
//   import { NeoHeartbeatEmitter, NeoHealthProvider } from "./adapters/neo/neo-health.js";
//   import { WorkerDaemon } from "./worker-daemon.js";
//
//   const sql = openPostgres(secret("DATABASE_URL"));
//   const runtime = createGovernanceRuntime({ runtimeStores: createPostgresRuntimeStores(sql),
//                                             goalContractStore: createPostgresGoalContractStore(sql) });
//   const registry = [ new NeoExecutionProvider() ];        // the ExecutionProviderPort registry the selector reads
//   const daemon = new WorkerDaemon({
//     nodeId: process.env.DOS_NODE_ID ?? "neo-node2",   // the ONE canonical id (launchd-injected)
//     runtimeTick: { tick: () => adaptDrain(runtime, registry) },   // adapt the runtime drain → the tick seam
//     heartbeatEmitter: new NeoHeartbeatEmitter({ sink: busUpsert(sql) }),
//     healthProvider:   new NeoHealthProvider(),
//   });
//   daemon.start();   // KeepAlive-supervised; config-doctor --enforce runs FIRST (fail-closed boot)
//
// ── SELF-TEST DISCIPLINE: an INJECTABLE clock/scheduler. The self-test calls `tickOnce()` (or `start()` with a
//    stub scheduler) — there is NO infinite loop and NO real process under test.
// =============================================================================

import type {
  HeartbeatRecord,
  HeartbeatEmitterPort,
  PlatformHealthProvider,
  PlatformHealthReport,
} from "../../templates/governance-engine/health-contract.js";

// ── the minimal runtime seam the daemon depends on (NOT a Core import — an injected interface) ────────────────

/** What one runtime tick advances. The composition root adapts `createGovernanceRuntime(...)`'s drain into this
 *  shape; the daemon never learns what the runtime IS. `advanced=false` is the no-op tick (null-registry case). */
export interface RuntimeTickResult {
  /** the bus drain cursor after this tick (feeds the heartbeat's `consumerCursor`). */
  consumerCursor?: string;
  /** the last Goal-Supervisor ProgressSample timestamp this tick observed (feeds `gsPostedAt`). */
  gsPostedAt?: string;
  /** did this tick advance any durable state? (false = a quiescent / null-registry no-op tick). */
  advanced: boolean;
}

/** The injected runtime drain seam. In production it wraps the Core runtime's drain; in the self-test it is a
 *  deterministic stub. The daemon holds ONLY this interface — never the Core factory. */
export interface RuntimeTick {
  tick(): Promise<RuntimeTickResult>;
}

/** A cancellable schedule handle (the launchd-supervised interval, or a stub in the self-test). */
export interface DaemonHandle {
  stop(): void;
}

/** The injectable scheduler — DEFAULT = `setInterval`. The self-test injects a stub that fires zero times (it
 *  drives `tickOnce()` directly), so no real timer/loop runs under test. */
export type Scheduler = (fn: () => void, intervalMs: number) => DaemonHandle;

const defaultScheduler: Scheduler = (fn, intervalMs) => {
  const id = setInterval(fn, intervalMs);
  // do not keep the event loop alive on the daemon's account if the host is shutting down.
  if (typeof (id as { unref?: () => void }).unref === "function") (id as { unref: () => void }).unref();
  return { stop: () => clearInterval(id) };
};

export interface WorkerDaemonOptions {
  /** the opaque node id stamped on every heartbeat (default = DOS_NODE_ID env, else canonical "neo-node2"). */
  nodeId?: string;
  /** the injected runtime drain seam (REQUIRED) — wraps the Core runtime; the daemon never imports Core. */
  runtimeTick: RuntimeTick;
  /** the Core-owned heartbeat emit port (REQUIRED) — the Neo adapter upserts onto the durable bus. */
  heartbeatEmitter: HeartbeatEmitterPort;
  /** the Core-owned health provider (optional) — exposed so the supervisor's /ready + the dead-man key on it. */
  healthProvider?: PlatformHealthProvider;
  /** the tick cadence (default 15000ms — §5.1 DOS_TICK_INTERVAL_MS; 15–30s on battery). */
  tickIntervalMs?: number;
  /** injected clock (default real Date) so the self-test gets deterministic timestamps. */
  now?: () => Date;
  /** injected scheduler (default setInterval) so the self-test never starts a real loop. */
  scheduler?: Scheduler;
}

/**
 * `WorkerDaemon` — the launchd-supervised drain loop. Each tick: advance the runtime (drain the bus), then EMIT a
 * `HeartbeatRecord` (monotonic `tickSeq`, the advanced cursor, the GS sample time) through the Core contract. A
 * wedged-but-alive daemon stops advancing `tickSeq` → staleness → the off-node dead-man fires. The daemon holds
 * only contract ports + the injected runtime seam — it is fully boundary-clean (no Core import).
 */
export class WorkerDaemon {
  readonly nodeId: string;
  private readonly runtimeTick: RuntimeTick;
  private readonly heartbeatEmitter: HeartbeatEmitterPort;
  private readonly healthProvider?: PlatformHealthProvider;
  private readonly tickIntervalMs: number;
  private readonly now: () => Date;
  private readonly scheduler: Scheduler;

  private tickSeq = 0;
  private handle: DaemonHandle | null = null;

  constructor(opts: WorkerDaemonOptions) {
    // ONE canonical node id: explicit opt wins, else the launchd-injected DOS_NODE_ID, else the
    // canonical default — so every heartbeat is stamped with the id the go-live gate + deadman expect.
    this.nodeId = opts.nodeId ?? process.env.DOS_NODE_ID ?? "neo-node2";
    this.runtimeTick = opts.runtimeTick;
    this.heartbeatEmitter = opts.heartbeatEmitter;
    this.healthProvider = opts.healthProvider;
    this.tickIntervalMs = opts.tickIntervalMs ?? 15000;
    this.now = opts.now ?? (() => new Date());
    this.scheduler = opts.scheduler ?? defaultScheduler;
  }

  /** Advance the runtime ONE tick and emit the heartbeat in lock-step. Returns the emitted beat (for diagnostics
   *  / the self-test). This is the unit the scheduler repeats — and the unit the self-test drives directly. */
  async tickOnce(): Promise<HeartbeatRecord> {
    const result = await this.runtimeTick.tick();
    this.tickSeq += 1; // strictly monotonic — staleness here is what the off-node dead-man catches.
    const beat: HeartbeatRecord = {
      nodeId: this.nodeId,
      tickSeq: this.tickSeq,
      lastTickAt: this.now().toISOString(),
      consumerCursor: result.consumerCursor,
      gsPostedAt: result.gsPostedAt,
    };
    await this.heartbeatEmitter.emit(beat);
    return beat;
  }

  /** Start the supervised loop (the launchd body). Returns a stop handle. The self-test does NOT call this with
   *  the real scheduler — it injects a stub scheduler or drives `tickOnce()` directly (no infinite loop). */
  start(): DaemonHandle {
    if (this.handle) return this.handle;
    this.handle = this.scheduler(() => {
      // fire-and-forget the async tick; a thrown tick is swallowed so the loop survives to the next beat
      // (a persistently failing tick stops advancing tickSeq → the dead-man fires — honest failure).
      void this.tickOnce().catch(() => undefined);
    }, this.tickIntervalMs);
    return this.handle;
  }

  /** Stop the supervised loop. */
  stop(): void {
    this.handle?.stop();
    this.handle = null;
  }

  /** The readiness body the on-node supervisor serves on /ready (the dead-man gate keys on `isReady(report)`). */
  async readiness(): Promise<PlatformHealthReport | null> {
    return this.healthProvider ? await this.healthProvider.buildReport() : null;
  }
}
