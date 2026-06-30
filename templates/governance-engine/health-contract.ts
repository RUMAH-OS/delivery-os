// Governance Engine — the HEALTH-EMISSION CONTRACT (Core-owned; the health-out seam the infra Monitoring CONSUMES
// OUTSIDE Core).
//
// THE SYMMETRIC SEAM to the ExecutionProviderPort: where `execution-provider-port.ts` is compute-IN, this is
// health-OUT. The Runtime EMITS two things — a liveness heartbeat and a structured health report — into surfaces
// the infra Monitoring CONSUMES (the off-node dead-man pusher, the off-node pull-watchdog, the status page).
// Core knows NOTHING of any monitor: it names no SaaS, no pusher, no scheduled task, no transport. It owns only
// the EMITTED data SHAPES + the one `isReady` predicate; the consume side is 100% adapter, 100% invisible to Core.
//
// POSITION (the Repository & Dependency Principle): a CONTRACT (the only legal cross-layer surface). Core defines
// + emits; the monitoring adapter (OUTSIDE Core) consumes. Pinned to the `contracts` layer in
// `architecture.config.json` so a monitoring adapter may import it (`adapter -> contract`) while Core never
// imports the adapter. Imports NOTHING outward, NO infra SDK.
//
// ONE SOURCE OF TRUTH (CLAUDE.md — the canonical source wins): the report shape STANDARDIZES on the canonical
// `templates/tools/platform-health.mjs` output (its `CANONICAL_SHAPE` / `buildReport()` — `service` · `verdict`
// · `ok` · `checkedAt` · `subsystems[]` · `summary`). This is the TYPED MIRROR of that runtime shape so a
// `buildReport()` result IS a `PlatformHealthReport` — it REUSES, it does not reinvent. (The shape is also pinned
// as `platform-health.schema.json`.) A Linux node's health bridge consumes the IDENTICAL contract — the host
// migration re-points the TRANSPORT, never this emit side.

/**
 * (a) The liveness heartbeat the engine-tick stamps every tick (emitted in the SAME txn as the step it advanced,
 * so liveness is proven by ADVANCING data, not by a live process — alive ≠ moving). `nodeId` is an opaque ID, NOT
 * an address; no field names a host/socket/monitor.
 */
export interface HeartbeatRecord {
  /** which node is ticking — an opaque ID, not an address. */
  nodeId: string;
  /** strictly monotonic — a wedged-but-alive daemon stops advancing this (staleness ⇒ HEARTBEAT_STALE). */
  tickSeq: number;
  /** ISO-8601; a beat older than the staleness threshold ⇒ HEARTBEAT_STALE (classifyFailure cause). */
  lastTickAt: string;
  /** the bus drain cursor — must advance, else STUCK_CONSUMER_CURSOR (classifyFailure cause). */
  consumerCursor?: string;
  /** last Goal-Supervisor ProgressSample timestamp (its in-window-ness feeds the readiness verdict). */
  gsPostedAt?: string;
}

/** The EMIT side of the heartbeat: the Runtime upserts a `HeartbeatRecord` onto the durable bus each tick. The
 *  consumer (status page / off-node pull) READS the row; Core never names the consumer. The concrete bus write is
 *  the consumer adapter's job (this port only carries the shape across the boundary). */
export interface HeartbeatEmitterPort {
  emit(beat: HeartbeatRecord): Promise<void>;
}

/** The overall verdict — the canonical platform-health vocabulary. `ok` = serve · `degraded` = serve+alarm ·
 *  `down` = fail-closed (the readiness route answers 503). */
export type HealthVerdict = "ok" | "degraded" | "down";

/** A per-subsystem status — the canonical platform-health vocabulary (worst→best for the worst-wins fold).
 *  `unknown` is NEVER silently treated as `ok` (fail-closed). */
export type SubsystemStatus = "ok" | "degraded" | "down" | "unknown";

/** One subsystem line of the report — the typed mirror of a platform-health.mjs `subsystems[]` entry. */
export interface HealthSubsystem {
  name: string;
  status: SubsystemStatus;
  /** does a failure here take the whole platform down? (a CRITICAL subsystem that is down/unknown ⇒ verdict down). */
  critical: boolean;
  /** one-line human reason (the named classifyFailure cause when not ok — NEVER a silent omission). */
  detail?: string;
  latencyMs?: number;
  /** the next action when not ok. */
  actionable?: string;
}

/**
 * (b) The structured health report — the SAME canonical shape `platform-health.mjs` already produces. The Runtime
 * COMPUTES it from the durable bus (DB reachable · heartbeat fresh · cursor advancing · config valid · GS in
 * window); every failure is a NAMED cause, never a silent omission. `ok === (verdict === "ok")`.
 */
export interface PlatformHealthReport {
  service: string;
  verdict: HealthVerdict;
  /** === (verdict === "ok"). */
  ok: boolean;
  /** ISO-8601 — the canonical platform-health.mjs field name (reused, not renamed). */
  checkedAt: string;
  subsystems: HealthSubsystem[];
  /** the per-status counts platform-health.mjs emits (total/ok/degraded/down/unknown). Optional for callers that
   *  build the report without the fold helper. */
  summary?: { total: number; ok: number; degraded: number; down: number; unknown: number };
}

/**
 * The EMIT side of health: the Runtime exposes a readiness report + a DB-independent liveness ping. `buildReport`
 * is the readiness body (the consumer's dead-man gate keys on it via `isReady`); `liveness` is the process-up
 * ping that touches NO durable store (so a consumer can disambiguate "bus down" from "node down"). Core defines
 * these; the worker daemon exposes them; the monitoring adapter consumes them. Core names no endpoint, no port,
 * no transport.
 */
export interface PlatformHealthProvider {
  /** the full readiness report (the consume side fails closed — answers 503 — when verdict === "down"). */
  buildReport(): Promise<PlatformHealthReport>;
  /** process-up liveness with NO durable-store touch (store-independent — disambiguates bus-down from node-down). */
  liveness(): Promise<{ ok: boolean }>;
}

/**
 * (c) The ONE predicate the consume-side dead-man gate keys on. Core EXPORTS it so the emit and the consume side
 * agree BY CONSTRUCTION — the monitoring adapter NEVER re-derives "is it healthy", it asks THIS. A `down` verdict
 * (a critical subsystem unprovable-healthy) withholds the readiness signal; `degraded` still serves. PURE — no
 * I/O, no env, no host.
 */
export function isReady(report: PlatformHealthReport): boolean {
  return report.verdict !== "down";
}
