// =============================================================================
// The PO reconciler (C2-LOOP) — the level-triggered organ that DRIVES a goal toward its target
// (RS-DOS-v1 §4.3 / §4.4 / §15). Sprint 3.3, first slice.
// =============================================================================
// THE SOLE MUTATOR of the GoalContract state machine (§15: "the reconciler (C2-LOOP) is the only mutator").
// Everything else — the Goal Supervisor (C7), the engine tick (C13), the agents — DETECTS, DRAFTS, or REPORTS;
// only THIS module turns a drafted decision into a real §4.3 `transition()`. The GS (src/goal-supervisor-c7.ts)
// drafts a HALT with `executed:false`; this reconciler is what actually flips that draft into a legal
// transition toward HALTED. The single mutator door is `applyReconcilePlan()` — the ONLY call site of
// goal-contract.transition() in the whole application (asserted structurally by the self-test source scan).
//
// ── Level-triggered, not edge-triggered (the load-bearing reconcile property, §4.4) ──
//   reconcile() is a PURE function of (desired, observed): it reads the GoalContract's desired state + the
//   VERIFIED observed state (the goal-delta ledger + the GS verdict — never a worker self-report) and emits a
//   diff + a decision. It does NOT remember whether it fired before. Reconciling the SAME (desired, observed)
//   twice yields the SAME decision; once the contract has reached the target state the decision collapses to
//   SETTLED (a no-op). So a late / repeated tick is safe (the resync property): no double-transition, no
//   edge-triggered drift. This is exactly the heartbeat-sweep discipline (src/heartbeat-api.ts domain runners)
//   generalised to the goal-state machine.
//
// ── What it COMPOSES (every part reuses a now-built piece; nothing re-implemented) ──
//   desired   ← the GoalContract objective/acceptance/target + its current `state` (src/goal-contract.ts).
//   observed  ← the goal-delta ledger ProgressSeries + attempt/cost (src/runtime-stores.ts, 0052) and the
//               GS's GoalSupervisionVerdict (src/goal-supervisor-c7.ts) — CONSUMED, never recomputed (the
//               reconciler does NOT re-detect progress; that is the GS's job, author≠verifier at the goal seam).
//   mutation  ← goal-contract.transition() (src/goal-contract.ts) — the ONE sanctioned §4.3 door; LEGALITY is
//               enforced by the 0053 DB trigger (an illegal edge throws, owner-proof). This module only CHOOSES
//               which legal edge to request; the DB remains authoritative.
//
// ── SHADOW posture (this slice) ──
//   applyReconcilePlan defaults to SHADOW: it computes the would-transition and EXECUTES NOTHING (no live goal
//   is mutated — there is no live goal-submission flow yet, Sprint 5.3). `--enforce` proves the real-transition
//   CAPABILITY against a TEST-DB fixture goal only, behind a "enforce = founder ★ + live flow 5.3" banner; it
//   NEVER touches a production goal. OUT OF SCOPE: the C2-MIND boundary intelligence that PLANS a sprint /
//   runs the completion review (Sprint 3.4 — this reconciler EXECUTES the legal edges, it does not plan); the
//   LLM reachability re-derivation; replacing any live loop.
// =============================================================================

import {
  type GoalState,
  type GoalContractRow,
  transition,
  readContract,
} from "./goal-contract.js";
import type {
  ProgressPoint,
  GoalSupervisionVerdict,
  GoalVerdict,
  AcceptanceShape,
} from "./goal-supervisor-c7.js";

// ── The decision vocabulary (one code per reconcile outcome) ─────────────────────────────────────────────
export type ReconcileDecision =
  | "CONTINUE" //        progressing toward target → keep executing / dispatch the next work package (NO transition)
  | "EXECUTE_HALT" //    the GS drafted HALT_AND_SUMMON → drive the legal §4.3 edge(s) toward HALTED
  | "TRANSITION_DONE" // the acceptance metric is MET → drive the legal edge(s) toward DONE (via the C6 review)
  | "ADVANCE_REVIEW" //  all sprint work posted (not met, not tripped) → advance EXECUTING→REVIEWING for the review
  | "SETTLED" //         the contract is terminal / halted / suspended → no-op (the idempotency + no-idle-daemon floor)
  | "WAIT"; //           live but no boundary/gap this tick → no transition (the no-op-cheap guarantee)

/** One legal §4.3 edge the reconciler may drive, annotated with the guard label it satisfies (transparency).
 *  LEGALITY is enforced by the 0053 DB trigger — this is the reconciler's CHOICE of edge, not the enforcement. */
export interface LegalEdge {
  from: GoalState;
  to: GoalState;
  guard: string;
}

/** The VERIFIED observed state the reconciler reasons over. Assembled from the durable ledgers + the GS verdict
 *  (§4.4 step 1: "the verified observed state, never a worker self-report"). Passing it explicitly keeps
 *  reconcile() a pure, deterministic, unit-testable function. */
export interface ObservedState {
  /** the goal-delta ledger ProgressSeries (runtime-stores.readProgressSeries, 0052). */
  progressSeries: ProgressPoint[];
  /** attempts consumed (runtime-stores.countAttempts) — dEffort. */
  attempts: number;
  /** cumulative cost consumed (runtime-stores.readCumulativeCost) — dEffort. */
  cumulativeCostCents: number;
  /** the GS's drafted verdict — CONSUMED, never recomputed. null = the GS has not (yet) run this goal. */
  gsVerdict: GoalSupervisionVerdict | null;
  /** the GS's external re-probe current value (the preferred current metric value — independent of the loop). */
  currentMetricValue?: number | null;
  /** structured acceptance {op,target,direction} (C2-MIND-derived, like C9/GS) — the desired target. */
  acceptance?: AcceptanceShape;
  /** boundary signal: all sprint work posted, a completion review is due (advance EXECUTING→REVIEWING). */
  allWorkPosted?: boolean;
}

export interface ObservedSummary {
  contractState: GoalState;
  currentMetricValue: number | null;
  acceptanceMet: boolean;
  gsVerdict: GoalVerdict | null;
  gsTrip: boolean;
  attempts: number;
  cumulativeCostCents: number;
  observedCycles: number;
}

export interface ReconcilePlan {
  goalId: string;
  /** the eventual TARGET state (the desired terminal for HALT/DONE; the current execution state for CONTINUE). */
  desired_state: GoalState;
  /** the verified observed state, summarised. */
  observed_state: ObservedSummary;
  /** desired-vs-observed, human-legible (the diff that drives the decision). */
  diff: string;
  decision: ReconcileDecision;
  /** the IMMEDIATE legal edge to apply THIS tick (null for CONTINUE / WAIT / SETTLED). One edge per tick keeps
   *  the organ level-triggered: a multi-edge path (EXECUTING→REVIEWING→HALTED) converges over successive ticks. */
  next_transition: LegalEdge | null;
  /** the FULL legal path current→desired terminal (transparency; the reconciler walks it one edge per tick). */
  chain: LegalEdge[];
  /** the gap-closing operations this decision implies (dispatch / transition / emit FAP …). */
  actions: string[];
  /** provenance — which now-built piece each part composes. */
  consumes: string[];
}

// ── The §4.3 guard labels (for transparency; the DB trigger is the authority) ────────────────────────────
const EDGE_GUARD: Record<string, string> = {
  "ACTIVE->PLANNING": "tick/no-open-sprint",
  "PLANNING->EXECUTING": "sprint-planned",
  "EXECUTING->REVIEWING": "all-work-posted|GS-early-trip",
  "REVIEWING->DONE": "review:complete",
  "REVIEWING->PLANNING": "review:incomplete-but-reachable",
  "REVIEWING->HALTED": "review:unreachable",
};

// The AUTONOMOUS forward graph: the subset of §4.3 edges the reconciler may drive on its OWN (no founder, no
// pre-flight, no cap). Founder-only edges (HALTED→*), pre-flight edges (FEASIBILITY→*), and the cap/freeze
// edges (→FAILED / →SUSPENDED) are deliberately EXCLUDED — the reconciler never forges them. The DB trigger
// still independently rejects anything illegal, so this graph is a CHOICE restriction, not the enforcement.
const AUTONOMOUS_EDGES: Record<string, GoalState[]> = {
  ACTIVE: ["PLANNING"],
  PLANNING: ["EXECUTING"],
  EXECUTING: ["REVIEWING"],
  REVIEWING: ["DONE", "PLANNING", "HALTED"],
};

const NON_TICKABLE: GoalState[] = ["DONE", "FAILED", "CLOSED", "HALTED", "SUSPENDED"];

function edge(from: GoalState, to: GoalState, guardOverride?: string): LegalEdge {
  return { from, to, guard: guardOverride ?? EDGE_GUARD[`${from}->${to}`] ?? "§4.3 edge" };
}

// BFS the shortest autonomous legal path from `from` to `target` (or [] if none). Used to compute the chain
// toward HALTED / DONE. The reconciler applies only the FIRST edge per tick (level-triggered convergence).
function legalPath(from: GoalState, target: GoalState): LegalEdge[] {
  if (from === target) return [];
  const queue: GoalState[] = [from];
  const prev = new Map<GoalState, GoalState>();
  const seen = new Set<GoalState>([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of AUTONOMOUS_EDGES[cur] ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      if (next === target) {
        // reconstruct
        const path: GoalState[] = [target];
        let n = target;
        while (prev.has(n)) { n = prev.get(n)!; path.unshift(n); }
        const edges: LegalEdge[] = [];
        for (let i = 0; i < path.length - 1; i++) edges.push(edge(path[i]!, path[i + 1]!));
        return edges;
      }
      queue.push(next);
    }
  }
  return [];
}

// ── acceptance: is the VERIFIED current value at/over the target? (desired side of the diff) ──────────────
// Uses the GS's external re-probe value (the verified observed current value — never the loop's self-report).
// Fail-closed: a missing/non-finite value or an ill-formed acceptance is NOT "met" (the reconciler never
// declares DONE on an unconfirmable metric — DONE is owned by C6/C16, §15; this only ROUTES toward the review).
// EXPORTED (Sprint 3.4): the C6 completion review (src/completion-review-c6.ts) reuses this SAME strict,
// finite-guarded value-at-target predicate so the reconciler's routing check and C6's DONE verdict can never
// disagree at the boundary — one source of truth for "is the (verified) value at/over the target".
export function acceptanceMet(value: number | null, a?: AcceptanceShape): boolean {
  if (value == null || !Number.isFinite(value)) return false;
  if (!a || a.op == null || a.target == null || !Number.isFinite(a.target)) return false;
  switch (a.op) {
    case ">=": return value >= a.target;
    case "<=": return value <= a.target;
    case ">": return value > a.target;
    case "<": return value < a.target;
    case "==": return value === a.target;
    default: return false;
  }
}

function currentValueOf(observed: ObservedState): number | null {
  if (observed.currentMetricValue != null && Number.isFinite(observed.currentMetricValue)) return observed.currentMetricValue;
  // fall back to the GS verdict's current value, then the latest ledger sample (the §7.2 preference order).
  const v = observed.gsVerdict?.details.currentValue;
  if (v != null && Number.isFinite(v)) return v;
  const series = [...observed.progressSeries].sort((x, y) => x.cycle - y.cycle);
  const last = series.length ? series[series.length - 1]!.value : null;
  return last != null && Number.isFinite(last) ? last : null;
}

const CONSUMES = [
  "desired ← GoalContract objective/acceptance/state (src/goal-contract.ts)",
  "observed ← goal-delta ProgressSeries + attempt/cost (src/runtime-stores.ts, 0052)",
  "verdict  ← GS GoalSupervisionVerdict (src/goal-supervisor-c7.ts) — consumed, not recomputed",
  "mutation ← goal-contract.transition() (§4.3 door; 0053 trigger is authoritative)",
];

// =============================================================================
// reconcile() — the LEVEL-TRIGGERED pure evaluator: (desired, observed) → diff + decision.
// MUTATES NOTHING. Deterministic. Idempotent on (desired, observed). The ONLY place the GoalContract state is
// actually moved is applyReconcilePlan() below — reconcile() only DECIDES which legal edge to request.
// =============================================================================
export function reconcile(contract: GoalContractRow, observed: ObservedState): ReconcilePlan {
  const state = contract.state;
  const value = currentValueOf(observed);
  const met = acceptanceMet(value, observed.acceptance);
  const gsTrip = observed.gsVerdict?.trip === true || observed.gsVerdict?.verdict === "HALT_AND_SUMMON";
  const gsVerdict: GoalVerdict | null = observed.gsVerdict?.verdict ?? null;
  const observedCycles = observed.progressSeries.length;

  const observed_state: ObservedSummary = {
    contractState: state,
    currentMetricValue: value,
    acceptanceMet: met,
    gsVerdict,
    gsTrip,
    attempts: observed.attempts,
    cumulativeCostCents: observed.cumulativeCostCents,
    observedCycles,
  };

  const targetDesc = observed.acceptance
    ? `${contract.acceptanceMetric} ${observed.acceptance.op ?? "?"} ${observed.acceptance.target ?? "?"}`
    : contract.acceptanceMetric;

  const base = { goalId: contract.goalId, observed_state, consumes: CONSUMES };

  // ── 1) SETTLED — terminal / halted / suspended states are NOT ticked (§21.4: no PO lingers as an idle
  //       daemon). This is the IDEMPOTENCY FLOOR: once a prior tick drove the contract into HALTED/DONE, every
  //       subsequent reconcile of the same goal collapses to SETTLED (no second transition).
  if (NON_TICKABLE.includes(state)) {
    return {
      ...base,
      desired_state: state,
      diff: `contract is in non-tickable state ${state} — settled; the reconciler does not tick it (§21.4).`,
      decision: "SETTLED",
      next_transition: null,
      chain: [],
      actions: [`no-op: ${state} is settled (terminal / halted / suspended) — nothing to reconcile`],
    };
  }

  // ── 2) EXECUTE_HALT — the GS drafted HALT_AND_SUMMON. The reconciler is the ONLY thing that turns that
  //       `executed:false` draft into a real transition: drive the legal §4.3 path toward HALTED (which must
  //       route through REVIEWING — REVIEWING→HALTED is review:unreachable; from EXECUTING the path is
  //       EXECUTING→REVIEWING (GS-early-trip)→HALTED). One edge per tick → converges over ticks.
  if (gsTrip) {
    const chain = legalPath(state, "HALTED").map((e) =>
      e.from === "EXECUTING" && e.to === "REVIEWING" ? { ...e, guard: "GS-early-trip" } : e,
    );
    const next = chain[0] ?? null;
    const actions: string[] = [];
    if (next) {
      actions.push(`execute the legal edge ${next.from}→${next.to} (${next.guard}) — the GS draft (executed:false) becomes a real transition`);
      if (chain.length > 1) actions.push(`subsequent ticks continue toward HALTED: ${chain.map((e) => `${e.from}→${e.to}`).join(" then ")}`);
      actions.push("emit the feasibility/strategy FAP the GS drafted (§3.1) — summon the founder with the flat-delta evidence");
    } else {
      actions.push(`GS tripped but no autonomous legal edge to HALTED exists from ${state} — defer to the GS/founder (the reconciler forges no illegal edge)`);
    }
    return {
      ...base,
      desired_state: "HALTED",
      diff: `GS verdict = HALT_AND_SUMMON (effort-without-progress); desired = HALTED, observed = ${state}. The reconciler EXECUTES the GS's drafted halt.`,
      decision: "EXECUTE_HALT",
      next_transition: next,
      chain,
      actions,
    };
  }

  // ── 3) TRANSITION_DONE — the acceptance metric is MET. Route toward DONE through the C6 completion review
  //       (REVIEWING→DONE is review:complete; from EXECUTING the path is EXECUTING→REVIEWING→DONE). NOTE (§15):
  //       the DONE verdict is OWNED by the C6 review / C16 DoD — the reconciler EXECUTES the resulting legal
  //       edge; in this evaluator the verified acceptance-met signal stands in for review:complete.
  if (met) {
    const chain = legalPath(state, "DONE");
    const next = chain[0] ?? null;
    const actions: string[] = [];
    if (next) {
      if (chain.length > 1) actions.push(`advance ${chain[0]!.from}→${chain[0]!.to} (all-work-posted) — the acceptance metric is met, route to the completion review`);
      actions.push("trigger the C6 completion review (owns the DONE verdict, §15) — re-probe the metric under its own identity");
      actions.push(`execute the legal edge to DONE: ${chain.map((e) => `${e.from}→${e.to}`).join(" then ")}`);
    } else {
      actions.push(`acceptance met but no autonomous legal edge to DONE exists from ${state}`);
    }
    return {
      ...base,
      desired_state: "DONE",
      diff: `acceptance MET: ${targetDesc} satisfied at value ${value} (verified). desired = DONE, observed = ${state}. Route to the completion review → DONE.`,
      decision: "TRANSITION_DONE",
      next_transition: next,
      chain,
      actions,
    };
  }

  // ── 4) ADVANCE_REVIEW — all sprint work is posted (a review is due) but the metric is not yet met and the
  //       GS has not tripped. Advance EXECUTING→REVIEWING so the C6 completion review can adjudicate (§4.4).
  if (observed.allWorkPosted && state === "EXECUTING") {
    const next = edge("EXECUTING", "REVIEWING", "all-work-posted");
    return {
      ...base,
      desired_state: "REVIEWING",
      diff: `all sprint work posted; metric ${targetDesc} not yet met (value ${value}), GS not tripped → advance to REVIEWING for the completion review.`,
      decision: "ADVANCE_REVIEW",
      next_transition: next,
      chain: [next],
      actions: ["advance EXECUTING→REVIEWING (all-work-posted) — hand to the C6 completion review (§4.4 step 4)"],
    };
  }

  // ── 5) CONTINUE / WAIT — the goal is live and progressing (GS = CONTINUE, or not yet supervised): keep
  //       executing / dispatch the next work package. NO transition (level-triggered: nothing to close yet).
  //       The PLANNING boundary (ACTIVE→PLANNING→EXECUTING) needs C2-MIND to PLAN a sprint (Sprint 3.4) —
  //       OUT OF SCOPE here; the reconciler EXECUTES edges, it does not plan. So those states WAIT.
  const progressing = gsVerdict === "CONTINUE";
  if (state === "EXECUTING") {
    return {
      ...base,
      desired_state: "EXECUTING",
      diff: progressing
        ? `progressing: ${targetDesc} at value ${value}, GS = CONTINUE → keep executing toward the target (no boundary, no transition).`
        : `executing: ${targetDesc} at value ${value}, GS has not yet run → keep executing (no boundary, no transition).`,
      decision: "CONTINUE",
      next_transition: null,
      chain: [],
      actions: ["dispatch the next work package / keep executing toward the target (§4.4 step 3) — no state transition this tick"],
    };
  }

  // ACTIVE / PLANNING / FEASIBILITY / CREATED — these boundaries need C9 (pre-flight) or C2-MIND (planning),
  // both OUT OF SCOPE for this reconcile slice. WAIT (no autonomous transition).
  return {
    ...base,
    desired_state: state,
    diff: `state ${state} advances via C9 pre-flight (CREATED/FEASIBILITY) or C2-MIND sprint-planning (ACTIVE/PLANNING) — out of scope for this reconcile slice. Wait.`,
    decision: "WAIT",
    next_transition: null,
    chain: [],
    actions: [`wait: ${state} is advanced by C9 / C2-MIND (deferred), not by this reconcile slice — no transition`],
  };
}

// =============================================================================
// applyReconcilePlan() — THE SOLE MUTATOR DOOR. The ONLY function in the application that calls
// goal-contract.transition(). SHADOW by default (computes the would-transition, executes NOTHING). With
// `enforce` it applies the SINGLE next legal edge against the supplied goal (TEST-DB fixture only) — proving
// the real-transition capability. The 0053 trigger rejects any illegal edge (so even a buggy plan cannot
// smuggle one past the DB). This is the single-mutator invariant (§15) made structurally true.
// =============================================================================
export interface ReconcileExecution {
  goalId: string;
  posture: "SHADOW" | "ENFORCE";
  decision: ReconcileDecision;
  /** did a REAL transition() happen? Always false in SHADOW. */
  executed: boolean;
  applied_edge: LegalEdge | null;
  /** post-transition state (read from the DB in enforce); the would-be `to` in SHADOW; the current state if no edge. */
  resulting_state: GoalState | null;
  note: string;
}

export interface ApplyOptions {
  /** founder-gated: even true does NOT mutate a live goal — there is no live goal flow (Sprint 5.3). Test-DB only. */
  enforce?: boolean;
}

export async function applyReconcilePlan(plan: ReconcilePlan, opts: ApplyOptions = {}): Promise<ReconcileExecution> {
  const edge = plan.next_transition;
  const enforce = opts.enforce === true;

  // No edge to apply (CONTINUE / WAIT / SETTLED) — nothing to mutate, in either posture.
  if (!edge) {
    return {
      goalId: plan.goalId,
      posture: enforce ? "ENFORCE" : "SHADOW",
      decision: plan.decision,
      executed: false,
      applied_edge: null,
      resulting_state: plan.observed_state.contractState,
      note: `no transition required (${plan.decision}) — the reconciler mutates nothing this tick`,
    };
  }

  if (!enforce) {
    // SHADOW: draft only. DO NOT call transition() on ANY goal (no live goal exists to mutate).
    return {
      goalId: plan.goalId,
      posture: "SHADOW",
      decision: plan.decision,
      executed: false,
      applied_edge: edge,
      resulting_state: edge.to, // the would-be state — NOT applied
      note: `SHADOW: would transition ${edge.from}→${edge.to} (${edge.guard}) — DRAFTED, not executed; no live goal mutated`,
    };
  }

  // ── ENFORCE (TEST-DB fixture only): THE SINGLE transition() CALL SITE IN THE APPLICATION. ──
  // CAS-guarded + 0053-trigger-enforced inside transition(): an illegal edge throws (owner-proof).
  const row = await transition(plan.goalId, edge.to);
  return {
    goalId: plan.goalId,
    posture: "ENFORCE",
    decision: plan.decision,
    executed: true,
    applied_edge: edge,
    resulting_state: row.state,
    note: `EXECUTED the legal edge ${edge.from}→${edge.to} (${edge.guard}) — the SOLE mutator transitioned the contract`,
  };
}

// =============================================================================
// reconcileTick() — read durable state → reconcile → apply (one tick). The production wire would call this on
// the RESERVED tier-2a scheduler (separate job from the GS's tier-2b, §7.5). Stateless: holds no RAM, re-reads
// the contract every tick (the crash/late-tick resync property, §4.4 failure note).
// =============================================================================
export interface ReconcileTickResult {
  plan: ReconcilePlan;
  execution: ReconcileExecution;
}

export async function reconcileTick(goalId: string, observed: ObservedState, opts: ApplyOptions = {}): Promise<ReconcileTickResult> {
  const contract = await readContract(goalId);
  if (!contract) throw new Error(`po-reconciler-c2: goal_contract ${goalId} not found`);
  const plan = reconcile(contract, observed);
  const execution = await applyReconcilePlan(plan, opts);
  return { plan, execution };
}

// reconcileToSettled() — drive the same (observed) until the decision collapses to SETTLED (or maxTicks), for a
// multi-edge path (EXECUTING→REVIEWING→HALTED). Re-reads the contract each tick (the contract STATE advances;
// the observed progress/effort/GS-verdict stay the same). Proves convergence + that a re-run after SETTLED is a
// pure no-op (idempotency). In SHADOW it cannot advance (no real transition) → it returns after one tick.
export interface ReconcileToSettledResult {
  ticks: ReconcileTickResult[];
  transitions: number;
  finalState: GoalState;
}

export async function reconcileToSettled(
  goalId: string,
  observed: ObservedState,
  opts: ApplyOptions = {},
  maxTicks = 12,
): Promise<ReconcileToSettledResult> {
  const ticks: ReconcileTickResult[] = [];
  let transitions = 0;
  for (let i = 0; i < maxTicks; i++) {
    const t = await reconcileTick(goalId, observed, opts);
    ticks.push(t);
    if (t.execution.executed) transitions++;
    if (t.plan.decision === "SETTLED") break;
    // In SHADOW nothing advances → a second tick would loop forever; stop once we've produced the (un-applied)
    // plan (executed:false and not settled means SHADOW with a pending edge — we've shown the would-transition).
    if (!opts.enforce && t.execution.applied_edge) break;
  }
  const contract = await readContract(goalId);
  if (!contract) throw new Error(`po-reconciler-c2: goal_contract ${goalId} not found after reconcile loop`);
  return { ticks, transitions, finalState: contract.state };
}
