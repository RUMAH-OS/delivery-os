// =============================================================================
// THE REASONING GOAL-DRIVER (the enforce-flip) — reasons about a live GoalContract and PRODUCES the reconcile
// plan the SOLE MUTATOR enacts. It NEVER mutates the state machine itself.
// =============================================================================
// This module is the bridge the "enforce-flip" adds between the ReasoningPipeline (src/reasoning/pipeline) and
// the live GoalContract governance loop (src/reconciler-loop.ts → src/po-reconciler-c2.ts). Given a GoalContract
// row + its verified observed state, it RUNS the reasoning organs and RETURNS a `ReconcilePlan` (plus a founder
// action draft when it must escalate). The reconciler-loop hands that plan to the EXISTING sole mutator door,
// `po-reconciler-c2.applyReconcilePlan()` — the ONE and ONLY `transition()` call site (§15). So this driver
// CHOOSES which legal edge the reasoned lifecycle wants; the DB's 0053 trigger stays authoritative over legality,
// and the reconciler stays the sole mutator.
//
// ── THE SOLE-MUTATOR INVARIANT, PROVEN STRUCTURALLY (§15) ──
//   This file does NOT import `transition` and NEVER calls it (a source-scan test asserts the file contains no
//   `transition(` call). It imports goal-contract ONLY for TYPES and po-reconciler-c2 ONLY for the pure
//   `reconcile()` evaluator + its plan/edge types. Every real state move still happens exclusively inside
//   applyReconcilePlan(). The driver is a PLANNER, not a mutator.
//
// ── WHAT IT DRIVES (the reasoning-justifiable PRE-FLIGHT boundary only) ──
//   The reconciler already owns the AUTONOMOUS forward graph from ACTIVE onward (ACTIVE→PLANNING→EXECUTING→
//   REVIEWING→…), which needs sprint-planning / metric probes that are still deferred (so with gsVerdict=null it
//   WAITs — zero mutation, unchanged). What the reconciler explicitly leaves OUT OF SCOPE is the C9 PRE-FLIGHT
//   admission boundary — the CREATED / FEASIBILITY states, which it returns WAIT for. THIS driver lights that up:
//     · CREATED     → FEASIBILITY   INTAKE. Move a drafted contract into pre-flight assessment. Autonomously
//                                    justifiable by construction: FEASIBILITY's only admission exit (→ACTIVE) is
//                                    reasoning-gated below, and its escape (→HALTED) is always available.
//     · FEASIBILITY → ACTIVE        ADMIT. Driven ONLY when the reasoning positively proves the goal reachable,
//                                    high-confidence, unambiguous, and NOT consequential/irreversible.
//     · FEASIBILITY → HALTED        HALT + a drafted founder action. The fail-closed sink (see the policy below).
//   Every other state DELEGATES to the reconciler's own pure `reconcile()` — so downstream behavior is byte-for-
//   byte the reconciler's existing logic, never re-implemented here.
//
// ── FAIL-CLOSED ADMISSION POLICY (an UNPROVEN forward edge NEVER fires) ──
//   At the FEASIBILITY gate, the driver ADMITS (drives FEASIBILITY→ACTIVE) IFF the reasoning trace ran to
//   completion AND the reachability organ positively asserted reachable AND confidence ≥ θ AND the classifier
//   did NOT flag the goal consequential-or-irreversible. In EVERY other case it HALTs (drives FEASIBILITY→HALTED)
//   and drafts a founder action. The exact HALT triggers:
//     · needs_clarification            — the classifier or planner refused (ambiguous / too vague to decompose).
//     · not_reachable                  — the C9 reachability organ fell closed (unreachable / hedged / unproven).
//     · low_confidence                 — reachable was asserted but confidence < θ (below the admit floor).
//     · consequential_or_irreversible  — the classifier judged high blast-radius or an irreversible action
//                                        (autonomous admission is not justifiable → escalate to the founder).
//     · organ_error                    — a reasoning-organ invocation THREW (model down / router / context). A
//                                        step failure is not a decision; fail closed to HALT (never admit on it).
//   The admission edge (FEASIBILITY→ACTIVE) therefore fires ONLY on a positively-proven, safe, confident goal.

import type { GoalState, GoalContractRow } from "../goal-contract.js";
import {
  reconcile,
  type ReconcilePlan,
  type ObservedState,
  type ObservedSummary,
  type LegalEdge,
  type ReconcileDecision,
} from "../po-reconciler-c2.js";
import { runReasoning, type ReasoningOrgans, type ReasoningTrace } from "./pipeline/reasoning-pipeline.js";
import { REACHABILITY_CONFIDENCE_FLOOR, type ReachabilityVerdict } from "./organs/reachability.js";
import type { IntakeClassification } from "./organs/intake-classifier.js";
import type { ResolveContext } from "./model-router.js";

// ── The driver's OWN semantic decision (richer than the reconciler's ReconcileDecision vocabulary). ──────────
export type GoalDriveDecision =
  | "DRIVE_INTAKE" //  CREATED→FEASIBILITY — move a drafted contract into pre-flight assessment.
  | "DRIVE_ADMIT" //   FEASIBILITY→ACTIVE  — reasoning positively proved the goal admissible.
  | "DRIVE_HALT" //    FEASIBILITY→HALTED  — fail-closed: reasoning refused / unreachable / unsafe / errored.
  | "DELEGATE" //      non-pre-flight state — hand to the reconciler's own pure reconcile() (unchanged behavior).
  | "SETTLED"; //      terminal / halted / suspended — no-op (delegated; the reconciler collapses it to SETTLED).

/** Why the driver fell closed to a HALT (attached to the founder-action draft for the audit). */
export type GoalHaltReason =
  | "needs_clarification"
  | "not_reachable"
  | "low_confidence"
  | "consequential_or_irreversible"
  | "organ_error";

/** A drafted founder action — the re-checkable escalation the driver emits ALONGSIDE a HALT. It is a DRAFT: the
 *  driver does not persist it (no side effect); the reconciler-loop forwards it to whatever sink the caller
 *  injects (a FAP writer, a Slack draft, a log). Cited by construction: it carries the organ trace provenance. */
export interface FounderActionDraft {
  readonly goalId: string;
  readonly kind: "PREFLIGHT_HALT";
  readonly reason: GoalHaltReason;
  /** A one-line, founder-facing summary of why the goal was halted at pre-flight. */
  readonly summary: string;
  /** The CITED blockers the reachability organ surfaced (empty for non-reachability halts). */
  readonly blockers: ReadonlyArray<{ readonly claim: string; readonly source: string }>;
  /** Provenance: the organ names that ran, in order (the reasoning trace's citation spine). */
  readonly traceStages: readonly string[];
}

/** The driver's result: the plan the SOLE MUTATOR enacts, the semantic decision, an optional founder-action
 *  draft (present iff DRIVE_HALT), the reasoning trace (null when no reasoning ran — DELEGATE/SETTLED/INTAKE),
 *  and a human-legible rationale. */
export interface GoalDriveResult {
  readonly goalId: string;
  readonly driveDecision: GoalDriveDecision;
  readonly plan: ReconcilePlan;
  readonly founderAction: FounderActionDraft | null;
  readonly trace: ReasoningTrace | null;
  readonly rationale: string;
}

/** The inputs one drive needs: the durable contract row, its verified observed state (for the DELEGATE path),
 *  the resolve context, and the injected reasoning organs (stubs in tests; the real bound organs in production). */
export interface DriveGoalInput {
  readonly contract: GoalContractRow;
  readonly observed: ObservedState;
  readonly ctx: ResolveContext;
  readonly organs: ReasoningOrgans;
}

const PRE_FLIGHT_GUARD: Record<string, string> = {
  "CREATED->FEASIBILITY": "intake/contract-drafted",
  "FEASIBILITY->ACTIVE": "pre-flight:reachable(reasoned)",
  "FEASIBILITY->HALTED": "pre-flight:unreachable(reasoned)",
};

function edge(from: GoalState, to: GoalState): LegalEdge {
  return { from, to, guard: PRE_FLIGHT_GUARD[`${from}->${to}`] ?? "§4.3 pre-flight edge" };
}

const DRIVER_CONSUMES = [
  "reasoning ← runReasoning(organs) (src/reasoning/pipeline) — classify → reachability → plan → narrate",
  "policy   ← θ admit floor (reachability REACHABILITY_CONFIDENCE_FLOOR) + consequential/irreversible escalation",
  "mutation ← po-reconciler-c2.applyReconcilePlan() (the SOLE §4.3 door; this driver NEVER calls transition())",
];

/** A minimal, HONEST observed summary for a pre-flight goal (no execution has happened yet — no metric, no
 *  progress, no effort). Used only to shape the ReconcilePlan the sole mutator logs; the mutation itself is
 *  driven by `next_transition`, never by these fields. */
function preFlightObservedSummary(state: GoalState): ObservedSummary {
  return {
    contractState: state,
    currentMetricValue: null,
    acceptanceMet: false,
    gsVerdict: null,
    gsTrip: false,
    attempts: 0,
    cumulativeCostCents: 0,
    observedCycles: 0,
  };
}

/** Build a pre-flight ReconcilePlan. `decision` is mapped to the NEAREST existing reconciler vocabulary purely
 *  for the sole mutator's audit note — applyReconcilePlan applies the edge from `next_transition`, never from
 *  `decision`. The driver's true semantic decision lives in GoalDriveResult.driveDecision. */
function preFlightPlan(
  contract: GoalContractRow,
  next: LegalEdge | null,
  desired: GoalState,
  decision: ReconcileDecision,
  diff: string,
  actions: string[],
): ReconcilePlan {
  return {
    goalId: contract.goalId,
    desired_state: desired,
    observed_state: preFlightObservedSummary(contract.state),
    diff,
    decision,
    next_transition: next,
    chain: next ? [next] : [],
    actions,
    consumes: DRIVER_CONSUMES,
  };
}

/** Compose the goal statement the reasoning organs judge — the objective plus its acceptance metric (the goalId
 *  is passed separately so the context-aware organs pull THAT contract's live state). */
function goalStatement(contract: GoalContractRow): string {
  return `${contract.objective} (acceptance: ${contract.acceptanceMetric})`;
}

/** The fail-closed classification of a completed/short-circuited reasoning trace into an admission verdict. */
type Assessment =
  | { admit: true }
  | { admit: false; reason: GoalHaltReason; summary: string; blockers: ReachabilityVerdict["blockers"] };

/** Locate a stage's typed output in the trace (undefined if that organ did not run). */
function stageOutput<T>(trace: ReasoningTrace, organ: string): T | undefined {
  return trace.stages.find((s) => s.organ === organ)?.output as T | undefined;
}

/**
 * Map a reasoning trace to an admission verdict, FAIL-CLOSED. ADMIT only when the trace ran to completion AND
 * reachability positively asserted reachable AND confidence ≥ θ AND the classifier flagged neither high
 * blast-radius nor irreversibility. Any refusal / unproven-reachability / low confidence / unsafe judgment HALTs.
 */
function assess(trace: ReasoningTrace): Assessment {
  // Classifier or planner refused → ambiguous / too vague. Never plan (or admit) on ambiguity.
  if (trace.needsClarification) {
    return { admit: false, reason: "needs_clarification", summary: "the goal is ambiguous or too vague to decompose — the reasoning refused to commit", blockers: [] };
  }
  // Reachability short-circuited the loop → the goal was not shown reachable.
  if (trace.haltedAt === "reachability") {
    const reach = stageOutput<ReachabilityVerdict>(trace, "reachability");
    return { admit: false, reason: "not_reachable", summary: "the goal was not shown reachable on the available evidence (C9 fail-closed)", blockers: reach?.blockers ?? [] };
  }
  // No reachability stage AND no refusal → the classifier judged the utterance non-consequential, so the loop
  // never proved reachability. A governance goal admitted without a proven feasibility judgment would be an
  // unproven forward edge → fail closed.
  const reach = stageOutput<ReachabilityVerdict>(trace, "reachability");
  if (!reach) {
    return { admit: false, reason: "needs_clarification", summary: "the goal was not established as a consequential, reachable objective — no feasibility judgment was produced", blockers: [] };
  }
  // Defensive: a non-reachable verdict that somehow did not short-circuit still fails closed.
  if (!reach.reachable) {
    return { admit: false, reason: "not_reachable", summary: "the reachability organ did not positively assert reachable", blockers: reach.blockers };
  }
  // Reachable, but below the driver's admit floor θ → uncertain ⇒ escalate rather than autonomously admit.
  if (reach.confidence < REACHABILITY_CONFIDENCE_FLOOR) {
    return { admit: false, reason: "low_confidence", summary: `reachability confidence ${reach.confidence} is below the admit floor ${REACHABILITY_CONFIDENCE_FLOOR}`, blockers: reach.blockers };
  }
  // Reachable + confident, BUT high blast-radius or irreversible → not autonomously justifiable ⇒ escalate.
  const cls = stageOutput<IntakeClassification>(trace, "classify");
  if (cls && (cls.consequentiality === "high" || cls.reversibility === "irreversible")) {
    return { admit: false, reason: "consequential_or_irreversible", summary: `the goal is ${cls.consequentiality ?? "?"} blast-radius / ${cls.reversibility ?? "?"} — a consequential admission is escalated to the founder`, blockers: [] };
  }
  // Positively proven reachable, confident, and safe → the ONLY path to an autonomous ADMIT.
  return { admit: true };
}

/** Run the reasoning pipeline for a goal; a thrown organ-invocation error is caught and reported (fail-closed
 *  HALT is decided by the caller — a step failure is never an admission). */
async function tryReason(input: DriveGoalInput): Promise<{ trace: ReasoningTrace } | { error: unknown }> {
  try {
    const trace = await runReasoning({
      utterance: goalStatement(input.contract),
      goalId: input.contract.goalId,
      ctx: input.ctx,
      organs: input.organs,
    });
    return { trace };
  } catch (error) {
    return { error };
  }
}

// The non-pre-flight states the driver DELEGATES to the reconciler's own pure evaluator (unchanged behavior).
// CREATED / FEASIBILITY are handled here; everything else (ACTIVE / PLANNING / EXECUTING / REVIEWING and the
// terminal / halted / suspended states) is the reconciler's existing domain.
function isPreFlight(state: GoalState): boolean {
  return state === "CREATED" || state === "FEASIBILITY";
}

/**
 * Reason about ONE GoalContract and produce the ReconcilePlan the SOLE MUTATOR (applyReconcilePlan) will enact.
 * NEVER calls transition(). See the fail-closed policy at the top of this file.
 */
export async function driveGoalContract(input: DriveGoalInput): Promise<GoalDriveResult> {
  const { contract } = input;
  const state = contract.state;

  // ── NON-PRE-FLIGHT → DELEGATE to the reconciler's own pure evaluator (its existing logic, not re-implemented).
  //    Terminal / halted / suspended states collapse to SETTLED inside reconcile(); ACTIVE..REVIEWING keep the
  //    reconciler's exact WAIT/CONTINUE/… decision. The driver adds NO judgment to those states.
  if (!isPreFlight(state)) {
    const plan = reconcile(contract, input.observed);
    return {
      goalId: contract.goalId,
      driveDecision: plan.decision === "SETTLED" ? "SETTLED" : "DELEGATE",
      plan,
      founderAction: null,
      trace: null,
      rationale: `state ${state} is outside the pre-flight boundary — delegated to the reconciler (decision ${plan.decision}); the reasoning driver adds no judgment here`,
    };
  }

  // ── CREATED → FEASIBILITY (INTAKE). Deterministic, autonomously-justifiable: enter pre-flight assessment. The
  //    reasoned ADMIT/HALT decision is applied one tick later at the FEASIBILITY gate (level-triggered
  //    convergence, exactly like the reconciler's multi-edge HALT path). No model call is spent on intake.
  if (state === "CREATED") {
    const e = edge("CREATED", "FEASIBILITY");
    const plan = preFlightPlan(
      contract,
      e,
      "FEASIBILITY",
      "CONTINUE",
      "state CREATED → move the drafted contract into pre-flight assessment (FEASIBILITY); the reasoned admit/halt decision is applied at the FEASIBILITY gate.",
      [`drive the intake edge ${e.from}→${e.to} (${e.guard}) — enter pre-flight; the reasoning gate at FEASIBILITY decides ADMIT vs HALT next tick`],
    );
    return {
      goalId: contract.goalId,
      driveDecision: "DRIVE_INTAKE",
      plan,
      founderAction: null,
      trace: null,
      rationale: "CREATED → FEASIBILITY: intake into pre-flight assessment (deterministic; the FEASIBILITY→ACTIVE admission edge is reasoning-gated and FEASIBILITY→HALTED is always available)",
    };
  }

  // ── FEASIBILITY → the REASONING GATE. Reason, then ADMIT (→ACTIVE) or fail-closed HALT (→HALTED). ────────────
  const reasoned = await tryReason(input);

  // organ invocation error → fail closed to HALT (a step failure is never an admission). HALTED is legal from
  // FEASIBILITY, so the fail-closed sink lands exactly where the state machine permits it.
  if ("error" in reasoned) {
    const e = edge("FEASIBILITY", "HALTED");
    const message = reasoned.error instanceof Error ? reasoned.error.message : String(reasoned.error);
    const plan = preFlightPlan(
      contract,
      e,
      "HALTED",
      "EXECUTE_HALT",
      `state FEASIBILITY → a reasoning-organ invocation FAILED (${message}); fail closed to HALTED (never admit on a step failure).`,
      [`drive the halt edge ${e.from}→${e.to} (${e.guard}) — organ error, fail closed`, "emit the drafted founder action (pre-flight halted: reasoning unavailable)"],
    );
    return {
      goalId: contract.goalId,
      driveDecision: "DRIVE_HALT",
      plan,
      founderAction: {
        goalId: contract.goalId,
        kind: "PREFLIGHT_HALT",
        reason: "organ_error",
        summary: `pre-flight halted: the reasoning organs could not be invoked (${message}) — the OS refuses to admit a goal it cannot assess`,
        blockers: [],
        traceStages: [],
      },
      trace: null,
      rationale: `FEASIBILITY → HALTED: fail-closed on organ invocation error (${message})`,
    };
  }

  const { trace } = reasoned;
  const verdict = assess(trace);
  const traceStages = trace.stages.map((s) => s.organ);

  if (verdict.admit) {
    const e = edge("FEASIBILITY", "ACTIVE");
    const plan = preFlightPlan(
      contract,
      e,
      "ACTIVE",
      "CONTINUE",
      "state FEASIBILITY → the goal was positively proven reachable, confident, and safe → ADMIT to ACTIVE.",
      [`drive the admission edge ${e.from}→${e.to} (${e.guard}) — reasoning proved the goal admissible`],
    );
    return {
      goalId: contract.goalId,
      driveDecision: "DRIVE_ADMIT",
      plan,
      founderAction: null,
      trace,
      rationale: "FEASIBILITY → ACTIVE: reasoning positively proved the goal reachable (≥ θ), unambiguous, and not consequential/irreversible",
    };
  }

  // Fail-closed HALT: drive FEASIBILITY→HALTED and draft the founder action (cited by the organ trace).
  const e = edge("FEASIBILITY", "HALTED");
  const plan = preFlightPlan(
    contract,
    e,
    "HALTED",
    "EXECUTE_HALT",
    `state FEASIBILITY → fail-closed (${verdict.reason}): ${verdict.summary}. Drive to HALTED and summon the founder.`,
    [`drive the halt edge ${e.from}→${e.to} (${e.guard}) — ${verdict.reason}`, "emit the drafted founder action (pre-flight halted) — summon the founder with the cited reasoning"],
  );
  return {
    goalId: contract.goalId,
    driveDecision: "DRIVE_HALT",
    plan,
    founderAction: {
      goalId: contract.goalId,
      kind: "PREFLIGHT_HALT",
      reason: verdict.reason,
      summary: verdict.summary,
      blockers: verdict.blockers.map((b) => ({ claim: b.claim, source: b.source })),
      traceStages,
    },
    trace,
    rationale: `FEASIBILITY → HALTED: fail-closed (${verdict.reason}) — ${verdict.summary}`,
  };
}
