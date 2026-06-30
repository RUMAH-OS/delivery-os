// Governance Engine — the EXECUTION-PROVIDER CONTRACT (Core-owned; the compute-in seam an Execution Node
// adapter implements OUTSIDE Core).
//
// POSITION (the Repository & Dependency Principle): this file is a CONTRACT — the ONLY legal cross-layer
// surface between the infrastructure-agnostic Runtime (Core) and the outer Adapter ring. Core DEFINES + CALLS
// this port; the node adapter (under `infrastructure/execution-node/adapters/<node>/provider.ts`) IMPLEMENTS it.
// It imports NOTHING outward, NO infra SDK. Per `architecture.config.json` this path is pinned to the
// `contracts` layer (alongside `ports.ts` / `metric-probe.ts`) so the adapter may import it (`adapter -> contract`)
// while Core never imports the adapter (`core <- contract <- adapter`, dependencies flow strictly inward).
//
// HOST-AGNOSTIC BY CONSTRUCTION (WAVE1-CHALLENGE Attack 4, the AUTHORITATIVE correction):
//   NO field names a host, a socket, a container, a private network, or any concrete environment. There is NO
//   Core enum of host/hardware classes — in particular `resource_class` is an OPAQUE string, NOT a closed union
//   of OS / hardware class names (enumerating an OS or hardware noun in a Core type IS a knowledge leak — the
//   exact defect the AUTHORITATIVE correction names). `labels`, `capabilities`, and `resource_class` are ALL
//   opaque capability strings the selector matches STRUCTURALLY against a node's published labels — the string is
//   the entire coupling; Core never enumerates the vocabulary. A node adapter is free to publish
//   `resource_class:"<anything>"`; Core neither knows nor constrains what the value means.
//
// Pure types + interfaces. No implementation, no driver import, no host name anywhere — not even in a literal.

import type { DataClass } from "./ports.js";

/** The class of unattended work a node can be asked to run. Process-shaped, NOT host-shaped — none of these
 *  names a machine. The selector + the node adapter decide WHERE each kind runs (author≠verifier is enforced at
 *  placement by policy, e.g. a `verify` job is placed on a different node than its `build` job). */
export type ExecutionKind = "build" | "verify" | "deploy" | "supervise" | "migrate" | "probe";

/** The RS §54.2 trust gate a node carries — an abstract trust posture, NOT a network/host fact. */
export type TrustDomain = "trusted" | "contractual" | "external";

/**
 * The OPAQUE placement constraint that travels with a request. Every match field is a plain string (or string
 * list) the `PlacementPort` matches STRUCTURALLY against a node's `labels` — there is deliberately NO closed
 * union of host/hardware classes here (the WAVE1-CHALLENGE Attack-4 correction). Core enumerates only the
 * abstract SHAPE of placement (lane = work-duration class; isolation = sharing posture); the concrete vocabulary
 * (`resource_class`, `capabilities`, `labels`) is adapter-owned and opaque to Core.
 */
export interface PlacementConstraint {
  /** work-duration class: "short" = a check/probe; "long" = a soak / build / autonomy run. Abstract, not a host. */
  lane: "short" | "long";
  /** sharing posture: "shared" = may co-tenant; "dedicated" = sole-tenant. Abstract, not a host. */
  isolation: "shared" | "dedicated";
  /** OPAQUE capability string matched structurally against a node label. NEVER a Core enum of host/hardware
   *  classes — any string a node adapter publishes may appear here; Core never names an OS or hardware class. */
  resource_class: string;
  /** OPAQUE capability strings matched against a node's `labels`. Never an infra type, never a host/socket/token. */
  capabilities?: string[];
  /** OPAQUE additional node-label requirements the selector matches structurally (superset of `capabilities`). */
  labels?: string[];
}

/** The H1 budget cap that travels WITH the job (it bounds any re-run). All host-free numbers. */
export interface ExecutionBudget {
  /** the wall-clock ceiling for the whole job, in ms. */
  maxWallclockMs: number;
  /** an optional cost ceiling (units are the adapter's concern; Core only carries the number). */
  maxCost?: number;
}

/**
 * `ExecutionRequest` — what the Runtime EMITS to ask for compute. It carries an idempotency key, the tenancy
 * scope, the work kind, an OPAQUE payload, the data-class gate, the OPAQUE placement constraint, and the budget.
 * NOTHING in it is an infra handle: `payload` is PII-free refs/codes (NEVER a host/socket/token), `placement` is
 * opaque strings. The same request shape routes to ANY node — whatever its host — unchanged; the Runtime never
 * learns which.
 */
export interface ExecutionRequest {
  /** idempotency key (write-ahead-intent; a duplicate is a no-op). */
  jobId: string;
  /** tenancy scope — a node may only touch its own goal_id (RS §54.3). */
  goalId: string;
  /** the class of work requested. */
  kind: ExecutionKind;
  /** OPAQUE, PII-free refs/codes the adapter resolves internally — NEVER an infra handle (no host/socket/token). */
  payload: Record<string, unknown>;
  /** gates eligibility FIRST (RS §54.1/§54.2) — PII never downgrades onto an external node. */
  data_class: DataClass;
  /** the OPAQUE placement constraint (opaque `resource_class`/`capabilities`/`labels` strings). */
  placement: PlacementConstraint;
  /** the H1 cap that travels with the job. */
  budget: ExecutionBudget;
}

/**
 * `ExecutionOutcome` — what a node returns. Success carries an `evidenceRef` (a pointer onto the durable bus —
 * it OUTLIVES an ephemeral runner; evidence is NOT a CI artifact); failure carries a named error + a retryable
 * flag. A discriminated union so a caller cannot read `evidenceRef` off a failure.
 */
export type ExecutionOutcome =
  | { ok: true; jobId: string; evidenceRef: string; metrics?: Record<string, number> }
  | { ok: false; jobId: string; error: string; retryable: boolean };

/**
 * `ExecutionProviderPort` — the ONE app/runtime coupling for COMPUTE. Each node is an adapter implementing this
 * interface; Core DEFINES it, the node adapter (OUTSIDE Core, in `infrastructure/execution-node/adapters/<node>`)
 * IMPLEMENTS it. NO member names a host, a socket, a container, or a private network: `nodeId` is an ID (not an
 * address), `labels` are opaque capability strings, `trustDomain` is an abstract posture. Every node adapter is
 * interchangeable behind this surface; Core never knows which one is registered.
 */
export interface ExecutionProviderPort {
  /** an opaque node ID (e.g. a logical name), NOT an address. */
  readonly nodeId: string;
  /** the node's published OPAQUE capability strings (matched by the selector against a request's placement). */
  readonly labels: string[];
  /** the RS §54.2 trust gate this node carries. */
  readonly trustDomain: TrustDomain;
  /** PURE eligibility test (labels + resource + data_class) — no side-effect, no host probe. */
  canAccept(req: ExecutionRequest): boolean;
  /** do the work, honoring the budget; abort on the signal; return evidence on the durable bus. */
  execute(req: ExecutionRequest, signal: AbortSignal): Promise<ExecutionOutcome>;
}

/** A selector's fail-closed refusal: NO eligible node exists for the request (NO node is invented; PII never
 *  downgrades to an external node). The selector returns this rather than placing the job. */
export type PlacementHalt = { halt: "no-eligible-node"; reason: string };

/**
 * `PlacementPort` — the constraint-first, fail-closed SELECTOR (Core-owned; mirrors RS §54.2). It chooses an
 * eligible `ExecutionProviderPort` from the registry by matching the OPAQUE placement constraint against each
 * node's opaque labels and gating on `data_class`/`trustDomain` — or returns a `PlacementHalt`. It invents no
 * node and never downgrades PII to an external node. With an EMPTY registry it ALWAYS returns `no-eligible-node`
 * (the null-registry case — see the runSprint mapping below).
 */
export interface PlacementPort {
  select(
    req: ExecutionRequest,
    registry: ReadonlyArray<ExecutionProviderPort>,
  ): ExecutionProviderPort | PlacementHalt;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE SPRINT-ENGINE SEAM MAPPING (documentation only — NO rewire here; the verified po-autoloop.ts / sprint-
// engine.ts logic stays BYTE-UNCHANGED). This records HOW the existing narrow `SprintExecutor` hook subsumes
// onto this port WHEN the node adapter is built (a LATER slice). It changes no runtime behavior today.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
//
//   TODAY (unchanged): `po-autoloop.ts` drives execution through `SprintExecutor`:
//     • `admitToExecuting(contract)`  — ramp a CREATED contract to EXECUTING (DEFERRED — throws by default).
//     • `runSprint({goalId,tickIndex,contractState})` — the unattended work that advances the metric between
//        ticks (DEFERRED — throws by default). `DEFERRED_EXECUTOR` is the null-execution no-op: every hook
//        throws, the controller catches it, and the governance still ticks over the INJECTED observed-state,
//        spawning no real work.
//
//   THE MAP (when a node adapter is registered — additive, zero controller-shape churn intended):
//     • `runSprint(input)`  ==>  build an `ExecutionRequest{ kind:"supervise", placement.lane:"long",
//        goalId: input.goalId, jobId: <idempotency key from goalId+tickIndex>, payload: <PII-free refs>,
//        data_class: <the contract's data_class>, budget: <the contract's H1 cap> }`, then:
//          1. `PlacementPort.select(req, registry)` picks an eligible node (or returns `no-eligible-node`).
//          2. `port.execute(req, signal)` does the work and returns an `ExecutionOutcome`.
//          3. the controller completes the step from `ExecutionOutcome.evidenceRef` via the EXISTING idempotent,
//             CAS-guarded completion path — it never calls `transition()` itself (§15 sole-mutator preserved).
//     • `admitToExecuting`  ==>  the same emit, with `kind:"build"`/`"supervise"` for the ramp; same select →
//        execute → complete shape.
//     • `DEFERRED_EXECUTOR`  ==>  the NULL-REGISTRY case: an EMPTY provider registry makes `select` return
//        `{halt:"no-eligible-node"}`, so the controller takes the identical "no real work spawned, governance
//        still ticks" path it takes today when the hook throws. Back-compatible: with no adapter registered the
//        Runtime behaves exactly as it does now.
//
//   THE INVARIANT: nothing in the controller learns what a node IS. The wiring (replacing the held
//   `SprintExecutor` with a held `PlacementPort` + registry) is a SEPARATE, panel-gated slice that ships WITH
//   the first node adapter; this file only DEFINES the contract the wiring will target. The §44 acceptance test
//   ("zero Runtime-behavior change") is graded THEN, against the real controller — not asserted here.
