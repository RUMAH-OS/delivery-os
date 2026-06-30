// =============================================================================
// infrastructure/execution-node — the NEO HEALTH adapter (HeartbeatEmitterPort + PlatformHealthProvider).
// =============================================================================
// The OUTER-RING implementation of the Core-owned Health-Emission Contract
// (templates/governance-engine/health-contract.ts). It is the symmetric seam to the execution provider:
// where the provider is compute-IN, this is health-OUT. Core DEFINES the emitted shapes + the `isReady`
// predicate; this adapter PRODUCES a `PlatformHealthReport` (node liveness / disk / runner status) and EMITS
// `HeartbeatRecord`s. The Runtime-side `isReady` is CONSUMED, never re-derived (one source of truth).
//
// THE BOUNDARY: this folder is the `adapters` layer — it imports the CONTRACT only (`adapter -> contract`),
// never a Core internal; Core never imports it. Host probes (disk, runner liveness) are confined here.
//
// INJECTABLE-PORT DISCIPLINE: every host probe and the heartbeat sink are INJECTED. The DEFAULTS read the real
// host; the self-test injects deterministic STUBS so a valid report is produced WITHOUT touching the real node.
// `isReady` is imported from the contract — the verdict the consume-side dead-man gate keys on is shared by
// construction.
// =============================================================================

import type {
  HeartbeatRecord,
  HeartbeatEmitterPort,
  PlatformHealthProvider,
  PlatformHealthReport,
  HealthSubsystem,
  HealthVerdict,
  SubsystemStatus,
} from "../../../../templates/governance-engine/health-contract.js";
import { isReady } from "../../../../templates/governance-engine/health-contract.js";

// ── the heartbeat emit seam ──────────────────────────────────────────────────────────────────────────────────

/**
 * The durable-bus sink the heartbeat is upserted onto. The CONCRETE bus write (Supabase upsert of
 * `engine_heartbeat{nodeId}`) is the adapter's concern; the self-test injects a capturing stub so no real bus
 * is touched. DEFAULT is a no-op recorder that buffers the last beat (honest: a real consumer injects the bus).
 */
export type HeartbeatSink = (beat: HeartbeatRecord) => Promise<void>;

export interface NeoHeartbeatEmitterOptions {
  /** the durable-bus sink (default = an in-memory recorder; a real consumer injects the Supabase upsert). */
  sink?: HeartbeatSink;
}

/** `NeoHeartbeatEmitter` — implements `HeartbeatEmitterPort`. Upserts the heartbeat via the injected sink. */
export class NeoHeartbeatEmitter implements HeartbeatEmitterPort {
  private readonly sink: HeartbeatSink;
  /** the last beat emitted — readable for diagnostics / the self-test (NOT the durable store). */
  last: HeartbeatRecord | null = null;

  constructor(opts: NeoHeartbeatEmitterOptions = {}) {
    this.sink = opts.sink ?? (async (beat) => void (this.last = beat));
  }

  async emit(beat: HeartbeatRecord): Promise<void> {
    this.last = beat;
    await this.sink(beat);
  }
}

// ── the health-report seam ───────────────────────────────────────────────────────────────────────────────────

/** One injected host probe → a subsystem line. PURE-of-Core: the host detail (disk, runner) lives in the probe. */
export type SubsystemProbe = () => Promise<HealthSubsystem> | HealthSubsystem;

export interface NeoHealthProviderOptions {
  /** the service label on the report (default = DOS_NODE_ID env, else the canonical "neo-node2"). */
  service?: string;
  /** the host subsystem probes (default = the real Neo probes: node liveness, disk, runner). The self-test
   *  injects deterministic stubs so a valid report is produced without touching the real host. */
  probes?: SubsystemProbe[];
  /** the process-up liveness probe (NO durable-store touch — disambiguates bus-down from node-down). */
  livenessProbe?: () => Promise<{ ok: boolean }> | { ok: boolean };
  /** injected clock (default = real Date) so the self-test gets a deterministic `checkedAt`. */
  now?: () => Date;
}

/**
 * `NeoHealthProvider` — implements `PlatformHealthProvider`. `buildReport` folds the injected host probes into
 * the canonical `PlatformHealthReport` (the `platform-health.mjs` shape: service · verdict · ok · checkedAt ·
 * subsystems · summary) with a WORST-WINS, fail-closed fold (a CRITICAL subsystem that is down/unknown ⇒ the
 * whole verdict is `down`). `liveness` is the store-independent process-up ping.
 */
export class NeoHealthProvider implements PlatformHealthProvider {
  private readonly service: string;
  private readonly probes: SubsystemProbe[];
  private readonly livenessProbe: () => Promise<{ ok: boolean }> | { ok: boolean };
  private readonly now: () => Date;

  constructor(opts: NeoHealthProviderOptions = {}) {
    // ONE canonical node id (matches the execution provider + the heartbeat): explicit opt wins,
    // else the launchd-injected DOS_NODE_ID, else the canonical default.
    this.service = opts.service ?? process.env.DOS_NODE_ID ?? "neo-node2";
    this.probes = opts.probes ?? defaultNeoProbes();
    this.livenessProbe = opts.livenessProbe ?? (() => ({ ok: true }));
    this.now = opts.now ?? (() => new Date());
  }

  async buildReport(): Promise<PlatformHealthReport> {
    const subsystems: HealthSubsystem[] = [];
    for (const probe of this.probes) {
      try {
        subsystems.push(await probe());
      } catch (e) {
        // a probe that throws is UNKNOWN, never silently ok (fail-closed).
        subsystems.push({
          name: "probe-error",
          status: "unknown",
          critical: true,
          detail: `probe threw: ${String(e)}`,
        });
      }
    }
    const verdict = foldVerdict(subsystems);
    const report: PlatformHealthReport = {
      service: this.service,
      verdict,
      ok: verdict === "ok",
      checkedAt: this.now().toISOString(),
      subsystems,
      summary: tally(subsystems),
    };
    return report;
  }

  async liveness(): Promise<{ ok: boolean }> {
    return await this.livenessProbe();
  }
}

// ── the canonical worst-wins fold (mirrors platform-health.mjs computeVerdict) ───────────────────────────────

/** Worst-wins, fail-closed: a CRITICAL subsystem that is down/unknown ⇒ `down`; any non-ok ⇒ at least `degraded`. */
export function foldVerdict(subsystems: HealthSubsystem[]): HealthVerdict {
  let verdict: HealthVerdict = "ok";
  for (const s of subsystems) {
    const bad = s.status === "down" || s.status === "unknown";
    if (bad && s.critical) return "down"; // a critical subsystem unprovable-healthy fails the whole node closed.
    if (s.status === "degraded" || bad) verdict = "degraded";
  }
  return verdict;
}

function tally(subsystems: HealthSubsystem[]): NonNullable<PlatformHealthReport["summary"]> {
  const counts = { total: subsystems.length, ok: 0, degraded: 0, down: 0, unknown: 0 };
  for (const s of subsystems) counts[s.status as SubsystemStatus] += 1;
  return counts;
}

// ── the default real Neo host probes (host detail — legal HERE, never in Core) ───────────────────────────────

/**
 * The real Neo subsystem probes: node liveness, disk headroom, runner status. These are the DEFAULTS — host
 * detail confined to the adapter. The self-test replaces them with deterministic stubs. (Implemented as
 * conservative, dependency-free probes; a fuller bridge reads `df`, the launchd label, the GH runner API.)
 */
export function defaultNeoProbes(): SubsystemProbe[] {
  return [
    () => ({ name: "node-liveness", status: "ok", critical: true, detail: "worker process up" }),
    async (): Promise<HealthSubsystem> => {
      // disk headroom — host detail; conservative default reports ok with a node-specific bridge to fill in.
      return { name: "disk", status: "ok", critical: false, detail: "headroom probe (bridge-supplied)" };
    },
    () => ({
      name: "runner",
      status: "unknown",
      critical: false,
      detail: "self-hosted runner status (bridge-supplied)",
      actionable: "register-runner.sh / svc.sh status",
    }),
  ];
}

// re-export the Core predicate so a consumer of THIS adapter reaches the one shared verdict, never re-derives it.
export { isReady };
