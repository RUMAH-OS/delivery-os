// Governance Engine — the PORTS (the DB-agnostic seams the organs depend on).
//
// SLICE 1 scope: `GoalContractStorePort` + its lifted data types.
// SLICE 2 scope (THIS file's second half): `RuntimeStoresPort` (the 6 C12 durable stores) + its lifted data
//   types — the seam the Goal Supervisor (C7) and the rest of the runtime organs read/append through.
// The probe/config/notifier/founder-binding ports and `createGovernanceRuntime` remain LATER slices (see
//   PLATFORM-EXTRACTION-BLUEPRINT-2026-06-29 §1, §3).
//
// Every type below is lifted VERBATIM from `rumah-admin/src/goal-contract.ts` (slice 1) and
// `rumah-admin/src/runtime-stores.ts` (slice 2) — no method is invented; the bodies that exist today become the
// consumer's Postgres adapter (the SQL, `pg_advisory_xact_lock`, the 0053/0052 trigger paths live BEHIND these
// ports). This file imports NO `./db/client.js`, NO `postgres`, NO `execFileSync` (the residency invariant —
// enforced by `residency-guard.mjs`).

import type { GoalState } from "./state-machine.js";

export type { GoalState } from "./state-machine.js";

export type DataClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII" | "SECRET";

/**
 * The H1 budget-cap envelope (§4.1 budget). All fields optional — an unset bound is "uncapped on that axis"
 * (the H1 cap composes from whatever axes are present). Stored as jsonb by the adapter.
 */
export interface BudgetCap {
  max_turns?: number;
  max_wallclock_seconds?: number;
  max_cost_cents?: number;
  [k: string]: unknown;
}

export interface CreateGoalContractInput {
  /** Optional explicit goal_id (else the adapter generates one). */
  goalId?: string;
  objective: string;
  acceptanceMetric: string;
  /** §4.1 acceptance.metric_source — a REGISTERED MetricProbe probe_id + PINNED version. */
  metricSourceProbeId: string;
  metricSourceVersion: number;
  dataClass: DataClass;
  budgetCap?: BudgetCap;
  /** Logical ref into goal_delta_ledger. Defaults to the contract's own goal_id (the ledger scope key). */
  goalDeltaLedgerRef?: string;
}

export interface GoalContractRow {
  goalId: string;
  objective: string;
  acceptanceMetric: string;
  metricSourceProbeId: string;
  metricSourceVersion: number;
  dataClass: DataClass;
  budgetCap: BudgetCap;
  goalDeltaLedgerRef: string;
  state: GoalState;
  prevState: GoalState | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * `GoalContractStorePort` — the durable PO-contract STORAGE seam (lifted from `goal-contract.ts`'s 5 exported
 * functions). DB-agnostic: an adapter implements these over Postgres (admin), Supabase (PLOS), or anything else
 * (the in-memory adapter in `scripts/in-memory-store.ts` proves the seam is genuinely DB-free).
 *
 * NOTE on enforcement (the load-bearing fact): these are the RAW storage operations. The §4.3 legality is NOT
 * the port's job — `transition()` here simply PERSISTS a CAS state move (in admin's adapter, the 0053 trigger is
 * the owner-proof backstop). Portable enforcement is added by the ORGAN wrapper (`goal-contract.ts`
 * `createGoalContractOrgan`), which runs the TS validator FIRST (fail-closed) and only THEN calls the port — so
 * a consumer is protected even before its DB trigger fires, and even off Postgres (where there is no trigger).
 */
export interface GoalContractStorePort {
  /** Create a new contract at the initial state CREATED (§4.3). */
  createContract(input: CreateGoalContractInput): Promise<GoalContractRow>;
  /** Read the durable contract by goal_id (null if none). */
  readContract(goalId: string): Promise<GoalContractRow | null>;
  /** Write-through the MUTABLE metadata (never touches `state`). Idempotent upsert keyed on goal_id. */
  persistContract(input: CreateGoalContractInput & { goalId: string }): Promise<GoalContractRow>;
  /** Persist a LEGAL state move (CAS on the observed `from` state). In Postgres the 0053 trigger is the backstop. */
  transition(goalId: string, to: GoalState): Promise<GoalContractRow>;
  /** Founder-resume a SUSPENDED contract back to its captured prev_state. */
  resume(goalId: string): Promise<GoalContractRow>;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SLICE 2 — `RuntimeStoresPort` (the 6 C12 durable stores) + its lifted data types.
//
// Lifted VERBATIM from `rumah-admin/src/runtime-stores.ts` (the 14 exported functions over the 6 governance
// tables, migration 0052). The Postgres-specifics — `pg_advisory_xact_lock(hashtext(goalId))` for `appendCost`,
// `ON CONFLICT … DO NOTHING/DO UPDATE`, `make_interval`, the CAS `UPDATE … WHERE breaker_state='open'`, and the
// 0052 RLS + append-only / idempotency / breaker guard triggers — all live BEHIND this port (the adapter owns
// them; the organ only calls a method). The in-memory adapter in `scripts/in-memory-store.ts` proves the seam is
// genuinely DB-free.
//
// THE C12 APPEND-ONLY INVARIANT IS STRUCTURAL IN THIS INTERFACE (the load-bearing design fact):
//   the 4 APPEND-ONLY stores (goal_delta_ledger · attempt_ledger · dead_letter · portfolio_cost_ledger) expose
//   ONLY an append method + read method(s) — there is NO update/delete method on the port for any of them. A
//   consumer therefore CANNOT mutate history through this seam regardless of adapter; the 0052
//   `c12_append_only_guard` trigger is the owner-proof DB backstop, but the port itself makes the illegal
//   operation un-namable. (Only the two MUTABLE stores — circuit_breaker, idempotency_store — expose state-
//   advance methods, and those mutations are themselves constrained: the breaker is a closed→open→half_open→
//   closed CAS; consume is write-once. The TS-side cage `runtime-stores-cage.ts` pins those non-structural
//   invariants against the 0052 DDL the same way the golden-master cage pins the §4.3 state machine.)
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type BreakerState = "closed" | "open" | "half_open";

export interface ProgressSampleInput {
  goalId: string;
  cycle: number;
  value?: number | null;
  predicted?: number | null;
  fixRef?: string | null;
}

export interface AttemptInput {
  goalId?: string | null;
  runId?: string | null;
  stepId: string;
  attempt: number;
  hypothesis?: string | null;
  action?: string | null;
  delta?: number | null;
  outcome: string;
}

export interface BreakerRow {
  stepId: string;
  goalId: string | null;
  runId: string | null;
  breakerState: BreakerState;
  breakerCount: number;
  breakerCooldownUntil: Date | null;
  updatedAt: Date;
}

export interface DeadLetterInput {
  stepId: string;
  runId?: string | null;
  goalId?: string | null;
  reason: string;
  payload?: unknown;
}

export interface CostInput {
  goalId: string;
  runId?: string | null;
  costCents: number;
  currency?: string;
}

/**
 * `RuntimeStoresPort` — the 6 C12 durable stores as ONE DB-agnostic seam (RS-DOS-v1 §8.3, migration 0052). The
 * sole application-side door to the durable runtime state, re-typed from `runtime-stores.ts`'s 14 functions. The
 * store INVARIANTS (append-only, write-once-consume, durable breaker) are enforced in the consumer's DB (RLS +
 * 0052 guard triggers) AND structurally by this interface (the 4 append-only stores have no mutation method).
 *
 * APPEND/READ-ONLY BY DESIGN for the four append-only stores — there is deliberately no `updateProgressSample`,
 * `deleteAttempt`, etc. The only mutation methods belong to the two genuinely-mutable stores (circuit_breaker,
 * idempotency_store), and they are CAS / write-once by construction.
 */
export interface RuntimeStoresPort {
  // ── 1) goal_delta_ledger (APPEND-ONLY) — the GS dGoal/dEffort series; idempotent on (goal_id, cycle). ──
  /** Append one ProgressSample. Idempotent on (goal_id, cycle): returns true if inserted, false if the cycle was already recorded. */
  appendProgressSample(s: ProgressSampleInput): Promise<boolean>;
  /** Read the goal-delta series in cycle order (the GS's dGoal + loop-fingerprint input). */
  readProgressSeries(goalId: string): Promise<
    Array<{ cycle: number; value: number | null; predicted: number | null; fixRef: string | null; ts: Date }>
  >;

  // ── 2) attempt_ledger (APPEND-ONLY) — immutable attempt history; unique on (step_id, attempt). ──
  /** Append one immutable attempt record. A duplicate (step_id, attempt) throws (unique violation), surfacing a double-record bug. */
  recordAttempt(a: AttemptInput): Promise<void>;
  /** Count immutable attempt records for a goal — the GS's dEffort "attempts consumed" input. */
  countAttempts(goalId: string): Promise<number>;

  // ── 3) circuit_breaker (DURABLE / MUTABLE) — survives a reconciler restart. ──
  /** Read the durable breaker for a step (null if never tripped). */
  getBreaker(stepId: string): Promise<BreakerRow | null>;
  /** Record a failure and durably advance the breaker (OPEN with a cooldown once count reaches threshold). */
  recordFailure(stepId: string, opts?: {
    goalId?: string | null; runId?: string | null; threshold?: number; cooldownMs?: number;
  }): Promise<BreakerRow>;
  /** Move an OPEN breaker to half_open once its cooldown has elapsed (no-op otherwise). */
  coolBreaker(stepId: string): Promise<BreakerRow | null>;
  /** Close (reset) the breaker after a successful trial — count back to 0, cooldown cleared. */
  closeBreaker(stepId: string): Promise<BreakerRow | null>;

  // ── 4) idempotency_store (MUTABLE, write-once consume) — write-ahead-intent; PK race ⇒ exactly-one reserved. ──
  /** Reserve an intent BEFORE a side-effect. Exactly one concurrent caller gets reserved=true (it owns the side-effect). */
  reserveIntent(key: string, opts?: {
    ttlSeconds?: number; scope?: string | null; runId?: string | null;
  }): Promise<{ reserved: boolean }>;
  /** Confirm the side-effect completed (write-once). Returns true if THIS call set consumed_at, false if already consumed. */
  consumeIntent(key: string): Promise<{ consumed: boolean }>;
  /** Has this intent been consumed? */
  isConsumed(key: string): Promise<boolean>;

  // ── 5) dead_letter (APPEND-ONLY) — poison-step terminal record (before the boundary FAP). ──
  /** Record a poison-step terminal record (append-only). Returns the new record id. */
  recordDeadLetter(d: DeadLetterInput): Promise<string>;

  // ── 6) portfolio_cost_ledger (APPEND-ONLY) — runtime spend; per-goal serialized cumulative. ──
  /** Append a cost row and atomically compute the running cumulative for the goal (per-goal serialized). */
  appendCost(c: CostInput): Promise<{ cumulativeCostCents: number }>;
  /** Read the current cumulative spend for a goal (0 if none). */
  readCumulativeCost(goalId: string): Promise<number>;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SLICE 3 — the 4 remaining ports: `ProbeReaderPort` (+ `CredentialResolver`) · `ConfigReadinessPort` ·
//   `NotifierPort` · `FounderBindingPort`. All DB-agnostic — no SQL, no `postgres`, no `execFileSync`. Each
//   signature is lifted VERBATIM from a seam that already exists on disk (blueprint §1.3–§1.5); the concrete
//   plane impls (the `postgres`-backed reader, the `i-config.mjs` shell-out, the webhook secrets, the founder-id
//   value) stay CONSUMER-SIDE — only these interfaces cross the package boundary.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════

// ── `ProbeReaderPort` (+ `CredentialResolver`) — the MetricProbe read seam (from `metric-probe.ts:96-104`) ──
//
// The seam ALREADY EXISTS on the admin organ (`ProbeReader`/`CredentialResolver`); the only coupling was the
// top-level `import postgres` used by the DEFAULT reader (`makeReadOnlySqlReader`). Extraction moves the
// substrate (descriptor type, `ProbeRegistry`, `invokeProbe`, the L3 allow-list guard) into the package WITHOUT
// the driver import; the `postgres`-backed `makeReadOnlySqlReader` + `sqlCredentialResolver` ship as the
// CONSUMER adapter. The four-layer least-privilege guarantee is preserved across the split: L1 (read-only DB
// role) + L2 (`SET TRANSACTION READ ONLY`) live in the consumer adapter's connection; L3 (`assertReadOnlyTarget`)
// + L4 (NO write method on this port) live in the package. (blueprint §1.3.)

/** The ONLY surface a probe is given over a data source: a single `read()`. There is NO write method (L4) —
 *  the read-only-ness is structural in the port, not enforced by discipline. The consumer's adapter
 *  (`makeReadOnlySqlReader`) is what opens the least-privilege connection; the package only ever calls `read`. */
export interface ProbeReaderPort {
  read(target: string): Promise<ReadonlyArray<Record<string, unknown>>>;
  close(): Promise<void>;
}

/** Resolves a descriptor's `credential_ref` → a least-privilege `ProbeReaderPort`. In production the consumer
 *  maps a ref to a read-only DB role's connection (from the config registry); in tests it maps to a fake reader.
 *  This crosses the package boundary; the `postgres`-backed `sqlCredentialResolver` is the consumer adapter. */
export type CredentialResolver = (credentialRef: string) => Promise<ProbeReaderPort>;

// ── `ConfigReadinessPort` — the I-Config readiness seam (from `preflight-gate-c9.ts:108-117`) ──
//
// The C9 pre-flight gate already depends on this as its `ctx.configReadiness` seam; only the DEFAULT coupled —
// `makeIConfigReadiness()` `execFileSync`-shells `infra/i-config.mjs` at a relative path. Extraction makes the
// INJECTED port the only path the package knows; the `execFileSync`-to-`i-config.mjs` default ships as the
// consumer adapter (plane wiring). The gate depends ONLY on the PRESENT/MISSING/INVALID/DRIFTED verdict, never
// on how I-Config computes it. (blueprint §1.4.)
export type ReadinessState =
  | "PRESENT" | "MISSING" | "INVALID" | "DRIFTED" | "OPTIONAL-ABSENT" | "UNDECLARED";

export interface KeyReadiness {
  key: string;
  state: ReadinessState;
  detail?: string;
}

/** Resolve the readiness verdict for a set of keys in an env. The consumer injects the real I-Config oracle
 *  (`makeIConfigReadiness`, the `execFileSync` shell-out) or a deterministic fake; the package NEVER defaults to
 *  a concrete plane (residency invariant). `ConfigReadinessPort` is the named alias for the function seam. */
export type ConfigReadinessFn = (env: string, keys: string[]) => Promise<KeyReadiness[]>;
export type ConfigReadinessPort = ConfigReadinessFn;

// ── `NotifierPort` — the FAP-delivery seam (from `founder-summon-c1.ts:225-234,356` + the GS `GS_FAP_WEBHOOK`) ──
//
// Not a store port, but lifted to a typed port so the package holds NO raw `process.env` read. The founder-summon
// 3-tier reach chain reads a channel's `credential_ref` env var directly (`defaultProbe`: `process.env[ref]`) and
// the GS annotates a `GS_FAP_WEBHOOK` configured flag; both become an INJECTED resolver. The webhook URLs +
// secrets are injected config — the package gets the reach LOGIC, never a hard-coded secret. The real-send seam
// (`SendSeam`) is lifted verbatim. (blueprint §1.5.) The organs that CONSUME this (founder-summon, goal-intake)
// are LATER slices; this slice defines the port type so the package's `process.env` residency is already closed.
export interface NotifierChannelRef {
  /** the channel id (slack-primary / nonsaas-fallback / durable-last-resort). */
  id: string;
  /** the env-gated secret seam (NEVER hard-coded). null only for the durable last-resort (needs none). */
  credentialRef: string | null;
}

export interface NotifierPort {
  /** Is the channel's `credential_ref` configured? Replaces the direct `process.env[credential_ref]` read in
   *  founder-summon's `defaultProbe` + the GS's `GS_FAP_WEBHOOK` env check. (Always true for the credential-less
   *  durable terminal.) Pure from the organ's view — the consumer decides how a ref resolves to "configured". */
  isConfigured(credentialRef: string | null): boolean;
  /** The real-send seam (ENFORCE only). ABSENT/undefined ⇒ no real send (draft-don't-send) ⇒ the chain escalates
   *  to the durable last-resort. Lifted verbatim from founder-summon's `SendSeam`. NEVER invoked in SHADOW. */
  send?(channel: NotifierChannelRef, payload: unknown): Promise<{ ok: boolean; ref?: string; note?: string }>;
}

// ── `FounderBindingPort` — the founder-identity seam (from `goal-intake-c1.ts:104-120`, `RUNTIME_FOUNDER_ID`) ──
//
// Replaces goal-intake's raw `process.env.RUNTIME_FOUNDER_ID` read with an injected resolver (a config-registry
// key, not `process.env`). Fail-closed by construction: a null `founderId` means UNSET ⇒ nobody can be verified
// as the founder ⇒ every submission/approval is rejected. The shape is lifted verbatim from admin's
// `FounderBinding` ({ founderId, source }). The consuming organ (goal-intake) is a LATER slice; the port type is
// defined now so no package file reads `process.env`. (blueprint §1.5.)
export interface FounderBinding {
  /** the single subject id authorized to submit/approve. null = UNSET ⇒ fail-closed (no founder configured). */
  founderId: string | null;
  /** provenance of the binding (e.g. "config-registry RUNTIME_FOUNDER_ID" / "injected (test/override)"). */
  source: string;
}

export interface FounderBindingPort {
  /** Resolve the bound founder identity from the consumer's config registry — NEVER a raw `process.env` read in
   *  the package. A null `founderId` is the fail-closed default (the organ rejects every submission/approval). */
  resolveFounderBinding(): Promise<FounderBinding> | FounderBinding;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// P2.1 — the two EXECUTION-INFRASTRUCTURE contracts (re-exported here so the full cross-layer contract surface is
//   reachable from one barrel). Both live in their OWN files (legibility) and are pinned to the `contracts` layer
//   in `architecture.config.json` so the Execution-Node / Monitoring adapters may import them (`adapter -> contract`)
//   while Core never imports the adapter. They import NOTHING outward, NO infra SDK, and name NO host (the WAVE1
//   correction: `resource_class`/`labels`/`capabilities` are OPAQUE strings — no `"macos"`/`"gpu"` Core enum).
//
//   • ExecutionProviderPort (compute-IN)   — Core DEFINES + CALLS; the node adapter IMPLEMENTS it.
//   • Health-Emission Contract (health-OUT) — Core DEFINES + EMITS; the monitoring adapter CONSUMES it.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type {
  ExecutionKind,
  TrustDomain,
  PlacementConstraint,
  ExecutionBudget,
  ExecutionRequest,
  ExecutionOutcome,
  ExecutionProviderPort,
  PlacementHalt,
  PlacementPort,
} from "./execution-provider-port.js";

export type {
  HeartbeatRecord,
  HeartbeatEmitterPort,
  HealthVerdict,
  SubsystemStatus,
  HealthSubsystem,
  PlatformHealthReport,
  PlatformHealthProvider,
} from "./health-contract.js";
export { isReady } from "./health-contract.js";
