// =============================================================================
// Boundary next-sprint planning (C2-MIND structure) — RS-DOS-v1 §4 C2-MIND / §4.3 / §9.2 / §21.1.
// =============================================================================
// PLATFORM EXTRACTION SLICE 4 — the port-injected mirror of `rumah-admin/src/boundary-plan-c2mind.ts`. C2-MIND is
// the PO's EPHEMERAL boundary-intelligence (§4): a bounded session invoked ONLY to (a) run a completion review
// (`completion-review.ts`) and (b) PLAN the next sprint. This module is the (b) half: the DETERMINISTIC plan
// skeleton computed at a goal/sprint boundary, with the actual goal-decomposition DEFERRED — that is LLM judgment
// (§15), kept behind a pluggable hook exactly like the §36.3 reachability evaluator: the GATE/STRUCTURE is built;
// the JUDGMENT is deferred.
//
// WHAT CHANGED vs admin (and ONLY this): the IMPORT residency. Admin pulled `GoalContractRow`/`GoalState` from
// `./goal-contract.js` (DB-coupled), `AcceptanceShape` from `./goal-supervisor-c7.js`, and the verdict types from
// `./completion-review-c6.js`. THIS module imports the contract row TYPE from `./ports.js`, `AcceptanceShape` from
// the inverted `./goal-supervisor.js`, and the verdict types from the inverted `./completion-review.js`. The
// deterministic logic — `decideNextBoundary` (the §4.3 three-way), `computeRemaining` (the desired-vs-observed
// gap), and the DEFERRED `planNextSprint` hook — is BYTE-FOR-BYTE the verified admin logic. This module imports
// NO DB; it is PURE (the residency invariant, enforced by `residency-guard.mjs`).
//
// ── SHADOW posture (unchanged) ──
//   computeBoundaryPlan is PURE: it builds the would-plan and MUTATES NOTHING (no contract transitioned, no
//   sprint created). The deferred hook THROWS until built, so no path silently depends on an un-built planner.
// =============================================================================

import type { GoalContractRow, GoalState } from "./ports.js";
import type { AcceptanceShape } from "./goal-supervisor.js";
import type { CompletionVerdict, CompletionReview } from "./completion-review.js";

// ── The §4.3 legal next boundary out of REVIEWING (the three-way, §9.2) ────────────────────────────────
export interface NextBoundary {
  /** the §4.3 legal next PO state. */
  to: Extract<GoalState, "DONE" | "PLANNING" | "HALTED">;
  /** the §4.3 guard label the edge satisfies (transparency; the 0053 DB trigger is the authority). */
  guard: "review:complete" | "review:incomplete-but-reachable" | "review:unreachable";
  rationale: string;
}

/** The DETERMINISTIC three-way rule over the C6 verdict (+ the GS's reachability signal). The analogue of
 *  §36.3's `decideReachability`: a pure, fail-closed mapping with NO LLM. C6 owns COMPLETE|INCOMPLETE; the
 *  "unreachable" determination is the GS's (§15: feasibility belongs to the GS/Founder, never the PO/review),
 *  so it is passed IN, never invented here. INCOMPLETE + unreachable → HALTED; INCOMPLETE + reachable →
 *  PLANNING (the next sprint, re-planned from verified state). */
export function decideNextBoundary(verdict: CompletionVerdict, opts: { gsUnreachable?: boolean } = {}): NextBoundary {
  if (verdict === "COMPLETE") {
    return { to: "DONE", guard: "review:complete", rationale: "C6 independently confirmed the acceptance metric is genuinely met → DoD-validated DONE." };
  }
  if (opts.gsUnreachable === true) {
    return {
      to: "HALTED",
      guard: "review:unreachable",
      rationale: "the goal is incomplete AND the GS judged it unreachable (flat goal-delta) → HALT + feasibility FAP → Founder (feasibility is the GS's/Founder's, never the review's).",
    };
  }
  return {
    to: "PLANNING",
    guard: "review:incomplete-but-reachable",
    rationale: "C6 found the goal incomplete but the GS has not judged it unreachable → open the NEXT sprint, re-planned from verified state (the stale plan tail discarded — anti-windup, §21.1).",
  };
}

// ── The remaining-work summary (the desired-vs-observed gap — the same diff the reconciler computes) ────
export interface RemainingWork {
  acceptanceMetric: string;
  op: string | null;
  target: number | null;
  /** the verified observed value (C6's independent re-read — never the loop's self-report). */
  observedValue: number | null;
  /** the signed gap remaining toward the target (target − observed for "increase"; observed − target for
   *  "decrease"; |observed − target| for "=="). null when uncomputable (non-finite/missing) — fail-soft. */
  gap: number | null;
  /** is the target already met? (mirrors C6's verdict; a met goal has no remaining work). */
  met: boolean;
  summary: string;
}

function computeRemaining(contract: GoalContractRow, acceptance: AcceptanceShape, observedValue: number | null, met: boolean): RemainingWork {
  const op = acceptance?.op ?? null;
  const target = acceptance?.target ?? null;
  let gap: number | null = null;
  if (observedValue != null && Number.isFinite(observedValue) && target != null && Number.isFinite(target)) {
    if (op === "<=" || op === "<") gap = observedValue - target; // overshoot to bring down
    else if (op === "==") gap = Math.abs(observedValue - target); // distance to close
    else gap = target - observedValue; // ">=" / ">" / default: shortfall to climb
  }
  const summary = met
    ? `no remaining work: '${contract.acceptanceMetric} ${op ?? "?"} ${target ?? "?"}' is met at observed ${observedValue ?? "n/a"}.`
    : gap == null
      ? `remaining work UNQUANTIFIED: the observed value (${observedValue ?? "n/a"}) or target (${target ?? "?"}) is non-finite/missing — the next sprint must first re-establish a readable metric.`
      : `remaining gap ${gap} toward '${contract.acceptanceMetric} ${op} ${target}' (observed ${observedValue}) — the next sprint must close it.`;
  return { acceptanceMetric: contract.acceptanceMetric, op, target, observedValue, gap, met, summary };
}

// ── The deferred LLM next-sprint planner (the §36.3-style hook) ─────────────────────────────────────────
export interface NextSprintInput {
  goalId: string;
  objective: string;
  /** the verified remaining-work summary (the deterministic input to the LLM decomposition). */
  remaining: RemainingWork;
  /** the verified observed state to re-plan FROM (§21.1: re-plan from verified state, discard the stale tail). */
  verifiedState: { observedValue: number | null; observedCycles: number };
}

/** The LLM's output (the next sprint), pinned as a frozen contract so the deferred planner builds against a
 *  stable interface — exactly like §36.3's ReachabilityVerdict. */
export interface NextSprintPlan {
  objective: string;
  acceptanceCriteria: AcceptanceShape;
  workPackages: Array<{ id: string; summary: string }>;
}

/**
 * DEFERRED — the actual goal-decomposition into the next sprint is LLM judgment (§15: C2-MIND, never a per-tick
 * LLM; §21.1 sizing/prioritization). Calling it now THROWS by design, exactly like §36.3's
 * `evaluateReachability`, so no path silently depends on an un-built planner and any premature wiring fails
 * LOUDLY rather than fakes a plan. When the LLM planner is built, pass it as `plan` to computeBoundaryPlan and
 * it slots in with ZERO structure changes.
 */
export async function planNextSprint(_input: NextSprintInput): Promise<NextSprintPlan> {
  throw new Error(
    "boundary-plan: the next-sprint LLM decomposition is DEFERRED — the actual goal→slice planning (objective + " +
      "frozen acceptance criteria + work packages) is C2-MIND LLM judgment, slotted in by a later slice; the " +
      "gate/structure is built, the judgment is deferred",
  );
}

// ── The boundary plan skeleton ─────────────────────────────────────────────────────────────────────────
export interface BoundaryPlan {
  goalId: string;
  /** the current PO lifecycle state at the boundary (the boundary is reached at REVIEWING). */
  currentState: GoalState;
  /** the C6 review verdict that drives the boundary (COMPLETE | INCOMPLETE). */
  reviewVerdict: CompletionVerdict;
  /** the §4.3 LEGAL next boundary given the verdict (+ the GS reachability signal). */
  nextBoundary: NextBoundary;
  /** the desired-vs-observed remaining-work summary. */
  remaining: RemainingWork;
  /** the next-sprint decomposition slot — DEFERRED. `status:"DEFERRED"` until the LLM planner is wired; the
   *  hook is present only when the next boundary is PLANNING (a met/halted goal opens no next sprint). */
  nextSprint:
    | { status: "DEFERRED"; reason: string; input: NextSprintInput }
    | { status: "NONE"; reason: string }
    | { status: "PLANNED"; plan: NextSprintPlan };
  /** provenance — which now-built piece each part composes. */
  consumes: string[];
}

export interface ComputeBoundaryPlanOptions {
  /** the GS's reachability signal (feasibility is the GS's, never the review's). Default: reachable. */
  gsUnreachable?: boolean;
  /** an OPTIONAL real LLM planner. Default = the DEFERRED `planNextSprint` (throws → the slot stays DEFERRED).
   *  Pass a real planner (a later slice) and the PLANNING slot becomes a real plan with ZERO other changes. */
  plan?: (input: NextSprintInput) => Promise<NextSprintPlan>;
}

const CONSUMES = [
  "verdict   ← C6 completion review (completion-review.ts) — the DONE-verdict owner",
  "boundary  ← §4.3 three-way legal next state (decideNextBoundary — deterministic, no LLM)",
  "remaining ← desired-vs-observed gap (the same diff the reconciler computes, §4.4 step 2)",
  "nextSprint ← planNextSprint — DEFERRED LLM judgment (§36.3-style hook; throws until built)",
];

/**
 * Compute the deterministic boundary plan skeleton from a C6 review. PURE: mutates nothing. The next-sprint
 * decomposition is DEFERRED (the hook throws) unless a real planner is injected. The `plan` override is awaited
 * ONLY when the legal next boundary is PLANNING — a met (DONE) or unreachable (HALTED) goal opens no next sprint.
 */
export async function computeBoundaryPlan(
  contract: GoalContractRow,
  review: CompletionReview,
  acceptance: AcceptanceShape,
  opts: ComputeBoundaryPlanOptions = {},
): Promise<BoundaryPlan> {
  const nextBoundary = decideNextBoundary(review.verdict, { gsUnreachable: opts.gsUnreachable });
  const observedValue = review.evidence.reprobe.value;
  const remaining = computeRemaining(contract, acceptance, observedValue, review.evidence.met);

  let nextSprint: BoundaryPlan["nextSprint"];
  if (nextBoundary.to !== "PLANNING") {
    nextSprint = {
      status: "NONE",
      reason: `the next boundary is ${nextBoundary.to} (${nextBoundary.guard}) — no next sprint is planned (a ${nextBoundary.to === "DONE" ? "completed" : "halted"} goal opens no new sprint).`,
    };
  } else {
    const input: NextSprintInput = {
      goalId: contract.goalId,
      objective: contract.objective,
      remaining,
      verifiedState: { observedValue, observedCycles: 0 },
    };
    const planner = opts.plan ?? planNextSprint;
    try {
      const plan = await planner(input);
      nextSprint = { status: "PLANNED", plan };
    } catch (e) {
      // The DEFERRED case (planNextSprint throws by design) lands here → the slot stays DEFERRED, never faked.
      nextSprint = {
        status: "DEFERRED",
        reason: `next-sprint decomposition DEFERRED: ${(e as Error).message.split(" — ")[0]}`,
        input,
      };
    }
  }

  return { goalId: contract.goalId, currentState: contract.state, reviewVerdict: review.verdict, nextBoundary, remaining, nextSprint, consumes: CONSUMES };
}
