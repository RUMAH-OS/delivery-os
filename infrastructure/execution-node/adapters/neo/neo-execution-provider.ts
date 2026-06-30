// =============================================================================
// infrastructure/execution-node — the NEO ExecutionProviderPort ADAPTER (Execution Node 1).
// =============================================================================
// This is the OUTER-RING implementation of the Core-owned `ExecutionProviderPort` contract
// (templates/governance-engine/execution-provider-port.ts). It is the ONLY place in the subsystem where
// host/process vocabulary is legal: the published capability strings ("macos", "arm64", "colima",
// "self-hosted-runner") and the `child_process` subprocess mechanism live HERE, never in Core.
//
// THE BOUNDARY (architecture.config.json — this folder is the `adapters` layer):
//   • it imports the CONTRACT only (`adapter -> contract`, legal) — never a Core internal.
//   • Core never imports this folder (the Delete Test proves Core builds with it removed).
//   • host detail (the spawn, the kind→command map, the node labels) is confined to this adapter.
//
// INJECTABLE-PORT DISCIPLINE (mirrors the governance-engine's adapters/postgres + plane.ts seams):
//   `execute` dispatches host work through an INJECTED `Spawner`. The DEFAULT spawner is the real
//   `node:child_process` mechanism; the self-test injects a STUB spawner so NO real process is ever
//   spawned under test. The `supervise` kind routes to an injected long-lived runner hook (the worker
//   drain path) rather than a one-shot subprocess. Nothing about WHERE/HOW work runs reaches Core.
// =============================================================================

import type {
  ExecutionProviderPort,
  ExecutionRequest,
  ExecutionOutcome,
  ExecutionKind,
  TrustDomain,
} from "../../../../templates/governance-engine/execution-provider-port.js";

// ── the host-mechanism seam (the ONLY process detail in the subsystem) ───────────────────────────────────────

/** The structured result of a one-shot host job. PII-free; the adapter maps it to an `ExecutionOutcome`. */
export interface SpawnResult {
  /** process exit code (0 = success); a non-zero / signalled exit is a job failure. */
  code: number;
  /** captured stdout (best-effort; the durable evidence is the bus ref, not this buffer). */
  stdout: string;
  /** captured stderr (surfaced as the failure `error` when the job is non-zero). */
  stderr: string;
  /** true iff the job was aborted via the `AbortSignal` (the budget/abort path). */
  aborted?: boolean;
}

/** The opaque description of a host job, resolved by the adapter from an `ExecutionRequest`. */
export interface SpawnSpec {
  command: string;
  args: string[];
  /** the wall-clock ceiling that travels with the job (ExecutionRequest.budget.maxWallclockMs). */
  timeoutMs: number;
}

/**
 * The injectable process mechanism. DEFAULT = the real `node:child_process` spawn (`defaultSpawner`); the
 * self-test injects a deterministic stub so the adapter is provable WITHOUT spawning a real process. This is
 * the single seam through which all host execution flows — the host detail is localized to one interface.
 */
export interface Spawner {
  run(spec: SpawnSpec, signal: AbortSignal): Promise<SpawnResult>;
}

/**
 * The injectable long-lived drain mechanism for `kind:"supervise"` — the worker/runner path (NOT a one-shot
 * subprocess). DEFAULT delegates to the spawner against the worker entry; a consumer/daemon supplies the real
 * drain. Returns a bus evidence ref for the supervision window engaged.
 */
export type SuperviseRunner = (req: ExecutionRequest, signal: AbortSignal) => Promise<SpawnResult>;

// ── the default real mechanism (host detail — legal here, never in Core) ─────────────────────────────────────

/**
 * The real `node:child_process` spawner. Honors the budget (`timeoutMs`) and the `AbortSignal` (kills the
 * child on abort). Imported lazily so a STUB-injected self-test never even loads the child_process surface.
 */
export const defaultSpawner: Spawner = {
  async run(spec: SpawnSpec, signal: AbortSignal): Promise<SpawnResult> {
    const { spawn } = await import("node:child_process");
    return await new Promise<SpawnResult>((resolveResult) => {
      let stdout = "";
      let stderr = "";
      let aborted = false;
      const child = spawn(spec.command, spec.args, { stdio: ["ignore", "pipe", "pipe"] });
      const timer = setTimeout(() => {
        aborted = true;
        child.kill("SIGKILL");
      }, spec.timeoutMs);
      const onAbort = () => {
        aborted = true;
        child.kill("SIGKILL");
      };
      signal.addEventListener("abort", onAbort, { once: true });
      child.stdout?.on("data", (d) => (stdout += String(d)));
      child.stderr?.on("data", (d) => (stderr += String(d)));
      child.on("error", (e) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolveResult({ code: 127, stdout, stderr: stderr + String(e), aborted });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolveResult({ code: code ?? 1, stdout, stderr, aborted });
      });
    });
  },
};

// ── the Neo provider ─────────────────────────────────────────────────────────────────────────────────────────

export interface NeoExecutionProviderOptions {
  /** the process mechanism (default = the real child_process spawner). The self-test injects a stub. */
  spawner?: Spawner;
  /** the long-lived drain for `kind:"supervise"` (default = the spawner against the worker entry). */
  superviseRunner?: SuperviseRunner;
  /** override the published node id (default = DOS_NODE_ID env, else the canonical "neo-node2"). */
  nodeId?: string;
  /** override the published OPAQUE capability strings (default = the Neo label set). */
  labels?: string[];
  /** the abstract RS §54.2 trust posture (default "trusted" — Neo is a node the platform owns). */
  trustDomain?: TrustDomain;
}

/**
 * `NeoExecutionProvider` — the concrete `ExecutionProviderPort` for Execution Node 1.
 *
 * Published surface (all OPAQUE strings — Core never enumerates this vocabulary):
 *   • nodeId      "neo-node2"  (the ONE canonical registry id; sourced from DOS_NODE_ID at the daemon)
 *   • labels      ["macos","arm64","colima","self-hosted-runner","pg","vercel-token"]
 *   • trustDomain "trusted"
 *
 * `canAccept` is PURE (no host probe): a structural match of the request's opaque placement against the
 * node's labels, gated FIRST on `data_class` (an external node refuses PII/SECRET — fail-closed). `execute`
 * dispatches by `ExecutionKind` to the host mechanism and returns an `ExecutionOutcome` carrying a durable-bus
 * `evidenceRef` (the evidence OUTLIVES the ephemeral runner — it is NOT a CI artifact).
 */
export class NeoExecutionProvider implements ExecutionProviderPort {
  readonly nodeId: string;
  readonly labels: string[];
  readonly trustDomain: TrustDomain;

  private readonly spawner: Spawner;
  private readonly superviseRunner: SuperviseRunner;

  constructor(opts: NeoExecutionProviderOptions = {}) {
    // ONE canonical node id: explicit opt wins, else the launchd-injected DOS_NODE_ID, else the
    // canonical default. A running daemon stamps the SAME id verify-health.sh + the deadman expect.
    this.nodeId = opts.nodeId ?? process.env.DOS_NODE_ID ?? "neo-node2";
    // OPAQUE published capability strings — legal in the ADAPTER, never a Core enum (WAVE1 Attack-4 correction).
    this.labels = opts.labels ?? [
      "macos",
      "arm64",
      "colima",
      "self-hosted-runner",
      "pg",
      "vercel-token",
    ];
    this.trustDomain = opts.trustDomain ?? "trusted";
    this.spawner = opts.spawner ?? defaultSpawner;
    this.superviseRunner =
      opts.superviseRunner ??
      ((req, signal) => this.spawner.run(this.resolveSpawnSpec(req), signal));
  }

  /**
   * PURE eligibility test — no side-effect, no host probe. Gates `data_class` FIRST (an external node never
   * takes PII/SECRET), then structurally matches the OPAQUE placement (resource_class + capabilities + labels)
   * against the node's published labels. "any" resource_class is a wildcard.
   */
  canAccept(req: ExecutionRequest): boolean {
    // data-class gate (RS §54.1/§54.2): PII/SECRET never downgrades onto an external node. Encoded generally.
    if ((req.data_class === "PII" || req.data_class === "SECRET") && this.trustDomain === "external") {
      return false;
    }
    if (!SUPPORTED_KINDS.has(req.kind)) return false;
    const have = new Set(this.labels);
    const rc = req.placement.resource_class;
    if (rc && rc !== "any" && !have.has(rc)) return false;
    for (const cap of req.placement.capabilities ?? []) if (!have.has(cap)) return false;
    for (const lbl of req.placement.labels ?? []) if (!have.has(lbl)) return false;
    return true;
  }

  /**
   * Do the work, honoring the budget, aborting on the signal, returning evidence on the durable bus. Dispatches
   * by `ExecutionKind`: build/verify/deploy/migrate/probe → the host subprocess; supervise → the long-lived
   * worker/runner drain. The `evidenceRef` is a durable-bus pointer (survives the ephemeral runner).
   */
  async execute(req: ExecutionRequest, signal: AbortSignal): Promise<ExecutionOutcome> {
    // fail-closed: never run a request the node would not accept (eligibility is the selector's job, but the
    // adapter re-checks structurally so a mis-routed job cannot run on the wrong node).
    if (!this.canAccept(req)) {
      return { ok: false, jobId: req.jobId, error: `node ${this.nodeId} rejects job ${req.jobId} (ineligible)`, retryable: false };
    }
    if (signal.aborted) {
      return { ok: false, jobId: req.jobId, error: "aborted before start", retryable: true };
    }

    try {
      const result =
        req.kind === "supervise"
          ? await this.superviseRunner(req, signal)
          : await this.spawner.run(this.resolveSpawnSpec(req), signal);

      if (result.aborted) {
        return { ok: false, jobId: req.jobId, error: "budget/abort exceeded", retryable: true };
      }
      if (result.code !== 0) {
        return {
          ok: false,
          jobId: req.jobId,
          error: `kind=${req.kind} exited ${result.code}: ${result.stderr.slice(-280)}`.trim(),
          retryable: result.code >= 100, // infra/transport-class exits are retryable; a real verify failure is not.
        };
      }
      // SUCCESS — evidence is a durable-bus ref, NOT a CI artifact (it outlives the ephemeral runner).
      return {
        ok: true,
        jobId: req.jobId,
        evidenceRef: this.evidenceRef(req),
        metrics: { exitCode: 0, stdoutBytes: result.stdout.length },
      };
    } catch (e) {
      return { ok: false, jobId: req.jobId, error: `host mechanism error: ${String(e)}`, retryable: true };
    }
  }

  // ── host detail (the ONLY place the kind→command map + the bus ref scheme live) ──

  /** Resolve the OPAQUE request into a concrete host command. The kind→entry map is adapter-owned host detail. */
  private resolveSpawnSpec(req: ExecutionRequest): SpawnSpec {
    const entry = ENTRY_BY_KIND[req.kind];
    return {
      command: entry.command,
      // payload is OPAQUE PII-free refs/codes the adapter resolves internally — passed as opaque positional args.
      args: [...entry.args, ...resolveOpaqueArgs(req)],
      timeoutMs: req.budget.maxWallclockMs,
    };
  }

  /** The durable-bus evidence pointer scheme. A stable, idempotency-keyed ref the controller completes from. */
  private evidenceRef(req: ExecutionRequest): string {
    return `bus://evidence/${this.nodeId}/${req.goalId}/${req.jobId}`;
  }
}

// ── adapter-owned host vocabulary (legal HERE; would be a knowledge leak in Core) ─────────────────────────────

const SUPPORTED_KINDS = new Set<ExecutionKind>(["build", "verify", "deploy", "supervise", "migrate", "probe"]);

/** The kind → local host entrypoint map. Concrete process detail, confined to the adapter. */
const ENTRY_BY_KIND: Record<ExecutionKind, { command: string; args: string[] }> = {
  // verify/build/migrate/probe run as a job on the ephemeral self-hosted runner against the colima postgres:16.
  build: { command: "node", args: ["--run", "build"] },
  verify: { command: "node", args: ["--run", "verify"] },
  migrate: { command: "node", args: ["--run", "migrate"] },
  probe: { command: "node", args: ["--run", "probe"] },
  // deploy → the token-attributed Vercel job (the token carries identity; the host does not).
  deploy: { command: "node", args: ["--run", "deploy"] },
  // supervise is dispatched via the SuperviseRunner (worker drain), not this map — present for totality.
  supervise: { command: "node", args: ["--run", "supervise"] },
};

/** Resolve the request's OPAQUE payload into positional args. PII-free refs/codes only — never a host handle. */
function resolveOpaqueArgs(req: ExecutionRequest): string[] {
  const out: string[] = ["--job", req.jobId, "--goal", req.goalId];
  const ref = req.payload["ref"];
  if (typeof ref === "string") out.push("--ref", ref);
  return out;
}
