// Durable Execution Engine — the 7-state machine + transition validator (Slice 0).
// §11 DECISION-REVIEW-2026-06-18-execution-engine.md C8: this validator is the thing the golden-master
// CI cage pins. It is the APP-LEVEL fail-closed guard; the DB BEFORE UPDATE trigger (migration 0034) is the
// backstop (C3). Both must agree on the SAME legal-edge whitelist — that is the invariant the cage protects.
//
// No new DSL, no third lifecycle list (C7): the run states EXTEND the existing created->closed /
// pending->verified records into a live machine; the step states are an internal roll-up.

// ── Run states (the 7 the §11 record fixes) ──────────────────────────────────────────────────────
export const RUN_STATES = [
  "queued", // a run exists; not yet planned
  "planned", // dispatch-route produced the step plan; steps materialized
  "executing", // a step is leased and advancing
  "blocked", // paused on an external/human/irreversible dependency (C6)
  "completed", // TERMINAL success (never previously failed/interrupted)
  "failed", // TERMINAL failure (retries exhausted / non-retryable)
  "recovered", // TERMINAL success-after-failure — the criterion #5 proof state
] as const;
export type RunState = (typeof RUN_STATES)[number];

export const TERMINAL_RUN_STATES: readonly RunState[] = ["completed", "failed", "recovered"];
export function isTerminal(s: RunState): boolean {
  return TERMINAL_RUN_STATES.includes(s);
}

// ── The ONLY legal run edges (must mirror the DB trigger whitelist in 0034 exactly) ──────────────
// Mirror of EXECUTION-ENGINE-DESIGN.md §1.2. Any edge not in this set is REFUSED (fail-closed).
export const LEGAL_RUN_EDGES: ReadonlyArray<readonly [RunState, RunState]> = [
  ["queued", "planned"], // dispatch-route planned the run
  ["queued", "failed"], // planning itself failed, non-retryable
  ["planned", "executing"], // first step leased
  ["executing", "executing"], // next step leased (multi-step progress)
  ["executing", "blocked"], // step yields: human/gate/irreversible dependency (C6)
  ["executing", "completed"], // all steps done, never previously failed/interrupted
  ["executing", "failed"], // retries exhausted / non-retryable
  ["blocked", "executing"], // dependency satisfied (approval, callback, timer)
  ["blocked", "failed"], // escalation SLA expired with no resolution
  ["failed", "executing"], // auto-retry / manual resume re-leases — the recovery edge (heart of #5)
  ["executing", "recovered"], // a previously failed/interrupted run completes
];

const LEGAL_RUN_EDGE_SET = new Set(LEGAL_RUN_EDGES.map(([a, b]) => `${a}->${b}`));

export function isLegalRunTransition(from: RunState, to: RunState): boolean {
  return LEGAL_RUN_EDGE_SET.has(`${from}->${to}`);
}

// Fail-closed assert — throws on an illegal edge (the engine never advances an unknown transition).
export function assertLegalRunTransition(from: RunState, to: RunState): void {
  if (!isLegalRunTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
}

export class IllegalTransitionError extends Error {
  readonly from: RunState;
  readonly to: RunState;
  constructor(from: RunState, to: RunState) {
    super(`illegal workflow_run transition ${from} -> ${to} (fail-closed; not in the legal-edge whitelist)`);
    this.name = "IllegalTransitionError";
    this.from = from;
    this.to = to;
  }
}

// ── Step states (internal; roll up to the run) ───────────────────────────────────────────────────
export const STEP_STATES = ["ready", "leased", "done", "failed", "blocked"] as const;
export type StepState = (typeof STEP_STATES)[number];

// ── The ONLY legal STEP edges (Slice 1, 0037) — must mirror the DB step trigger whitelist EXACTLY ──
// 0034 declared the step states but had NO step-level transition guard (only the run-level one). Slice 1
// adds the block/resume await primitive whose completer is the FIRST cross-process writer of step state, so
// the step transitions are now whitelist-guarded at BOTH the app (here) and the DB (0037 trigger). The
// golden-master cage pins that these two lists describe the SAME graph (drift = the failure it catches).
export const LEGAL_STEP_EDGES: ReadonlyArray<readonly [StepState, StepState]> = [
  ["ready", "leased"], // lease a ready step
  ["leased", "done"], // step succeeded (incl. verify pass / cap-trip judged)
  ["leased", "failed"], // step failed (transient retry or terminal)
  ["leased", "blocked"], // await step yields: block on a correlation key (R1)
  ["leased", "ready"], // the verify step re-readies itself on a failing check (loop back-edge)
  ["failed", "leased"], // auto-retry re-lease (D3 retry path bumps attempt)
  ["done", "ready"], // the loop BACK-EDGE: re-open a done act step for another attempt (Improve)
  ["ready", "done"], // SKIP: a conditional step (the cap-trip gate) is skipped on a clean loop stop
  ["ready", "blocked"], // a step blocked for a human without leasing (C6 / cap-trip human gate, R1)
  ["blocked", "done"], // the await resolved — the COMPLETER advances it (the new cross-process write, D2)
  ["blocked", "failed"], // the await escalated to terminal failure
];

const LEGAL_STEP_EDGE_SET = new Set(LEGAL_STEP_EDGES.map(([a, b]) => `${a}->${b}`));

export function isLegalStepTransition(from: StepState, to: StepState): boolean {
  return LEGAL_STEP_EDGE_SET.has(`${from}->${to}`);
}

export function assertLegalStepTransition(from: StepState, to: StepState): void {
  if (!isLegalStepTransition(from, to)) {
    throw new IllegalStepTransitionError(from, to);
  }
}

export class IllegalStepTransitionError extends Error {
  readonly from: StepState;
  readonly to: StepState;
  constructor(from: StepState, to: StepState) {
    super(`illegal workflow_step transition ${from} -> ${to} (fail-closed; not in the step legal-edge whitelist)`);
    this.name = "IllegalStepTransitionError";
    this.from = from;
    this.to = to;
  }
}

// ── Step kind / idempotency classification (C6) ──────────────────────────────────────────────────
// The engine executes emit-only / idempotent steps UNATTENDED. A non-idempotent / irreversible step
// (would assign a number, mutate a balance, send money/email directly) is NEVER run unattended:
// the engine leaves the run `blocked` for a human. This mirrors dispatch-route's no-spawn ceiling and
// ratifies OPEN-Q7 as an invariant. Emit-only steps are idempotent because the outbox emit is
// idempotent on its row id and the transition is idempotent on (run_id, seq, attempt).
export type StepEffect = "emit-only" | "idempotent" | "irreversible";

export function isUnattendedSafe(effect: StepEffect): boolean {
  return effect === "emit-only" || effect === "idempotent";
}
