// =============================================================================
// The PO reconciler (C2-LOOP) — the level-triggered organ that DRIVES a goal toward its target
// (RS-DOS-v1 §4.3 / §4.4 / §15).
// =============================================================================
// PLATFORM EXTRACTION SLICE 3 — the port-injected mirror of `rumah-admin/src/po-reconciler-c2.ts`. THE SOLE
// MUTATOR of the GoalContract state machine (§15: "the reconciler (C2-LOOP) is the only mutator"). Everything
// else — the Goal Supervisor (C7), the sprint engine (C10), the agents — DETECTS, DRAFTS, or REPORTS; only THIS
// module turns a drafted decision into a real §4.3 `transition()`.
//
// WHAT CHANGED vs admin (and ONLY this): the CONTRACT-STORE access path. Admin imported the value functions
// `transition` + `readContract` directly from `./goal-contract.js` (which imports `./db/client.js`). THIS module
// imports NO DB — the SINGLE mutator door (`applyReconcilePlan`) and the tick/settle drivers cross an injected
// `GoalContractStorePort` (supply the `createGoalContractOrgan`-wrapped store so the §4.3 TS validator + the
// 0053 trigger both gate the edge). The pure decision core — `reconcile()` (the level-triggered evaluator),
// `acceptanceMet`, `legalPath`/BFS, `currentValueOf`, the EDGE_GUARD / AUTONOMOUS_EDGES / NON_TICKABLE tables —
// is BYTE-FOR-BYTE the verified admin logic; not one line of the reconcile rule changed.
//
// ── §15 SOLE-MUTATOR INVARIANT, PRESERVED STRUCTURALLY ──
//   `createReconciler(contract).applyReconcilePlan` is the ONLY place a `.transition(` is called to DRIVE the
//   lifecycle (the single call site). `reconcile()` is a PURE function of (desired, observed): it computes the
//   would-transition and EXECUTES NOTHING. The package's regression self-test re-runs the verified reconcile
//   table AND the single-mutator source scan against this file — both still hold.
//
// ── SHADOW posture (this slice) ──
//   applyReconcilePlan defaults to SHADOW: it computes the would-transition and EXECUTES NOTHING. `enforce`
//   proves the real-transition CAPABILITY against a supplied store (in-memory / TEST-DB fixture) only.
// =============================================================================

import type { GoalState, GoalContractRow, GoalContractStorePort } from "./ports.js";
import type {
  ProgressPoint,
  GoalSupervisionVerdict,
  GoalVerdict,
  AcceptanceShape,
} from "./goal-supervisor.js";

// ── The decision vocabulary (one code per reconcile outcome) ─────────────────────────────────────────────
export type ReconcileDecision =
  | "CONTINUE" //        progressing toward target → keep executing / dispatch the next work package (NO transition)
  | "EXECUTE_HALT" //    the GS drafted HALT_AND_SUMMON → drive the legal §4.3 edge(s) toward HALTED
  | "TRANSITION_DONE" // the acceptance metric is MET → drive the legal edge(s) toward DONE (via the C6 review)
  | "ADVANCE_REVIEW" //  all sprint work posted (not met, not tripped) → advance EXECUTING→REVIEWING for the review
  | "SETTLED" //         the contract is terminal / halted / suspended → no-op (the idempotency + no-idle-daemon floor)
  | "WAIT"; //           live but no boundary/gap this tick → no transition (the no-op-cheap guarantee)

/** One legal §4.3 edge the reconciler may drive, annotated with the guard label it satisfies (transparency).
 *  LEGALITY is enforced by the §4.3 validator/trigger — this is the reconciler's CHOICE of edge, not the enforcement. */
export interface LegalEdge {
  from: GoalState;
  to: GoalState;
  guard: string;
}

/** The VERIFIED observed state the reconciler reasons over. Assembled from the durable ledgers + the GS verdict
 *  (§4.4 step 1: "the verified observed state, never a worker self-report"). Passing it explicitly keeps
 *  reconcile() a pure, deterministic, unit-testable function. */
export interface ObservedState {
  /** the goal-delta ledger ProgressSeries (RuntimeStoresPort.readProgressSeries, 0052). */
  progressSeries: ProgressPoint[];
  /** attempts consumed (RuntimeStoresPort.countAttempts) — dEffort. */
  attempts: number;
  /** cumulative cost consumed (RuntimeStoresPort.readCumulativeCost) — dEffort. */
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

// ── The §4.3 guard labels (for transparency; the validator/trigger is the authority) ─────────────────────
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
// edges (→FAILED / →SUSPENDED) are deliberately EXCLUDED — the reconciler never forges them. The validator/
// trigger still independently rejects anything illegal, so this graph is a CHOICE restriction, not the enforcement.
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
// EXPORTED: the C6 completion review (completion-review.ts) reuses this SAME strict, finite-guarded value-at-
// target predicate so the reconciler's routing check and C6's DONE verdict can never disagree at the boundary —
// one source of truth for "is the (verified) value at/over the target".
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
  "desired ← GoalContract objective/acceptance/state (GoalContractStorePort)",
  "observed ← goal-delta ProgressSeries + attempt/cost (RuntimeStoresPort, 0052)",
  "verdict  ← GS GoalSupervisionVerdict (goal-supervisor.ts) — consumed, not recomputed",
  "mutation ← GoalContractStorePort.transition() (§4.3 door; the validator/trigger is authoritative)",
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
  //       The PLANNING boundary (ACTIVE→PLANNING→EXECUTING) needs C2-MIND to PLAN a sprint (a later slice) —
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
// The SOLE MUTATOR door + the tick/settle drivers — bound to an injected `GoalContractStorePort`.
// =============================================================================
export interface ReconcileExecution {
  goalId: string;
  posture: "SHADOW" | "ENFORCE";
  decision: ReconcileDecision;
  /** did a REAL transition() happen? Always false in SHADOW. */
  executed: boolean;
  applied_edge: LegalEdge | null;
  /** post-transition state (read from the store in enforce); the would-be `to` in SHADOW; the current state if no edge. */
  resulting_state: GoalState | null;
  note: string;
}

export interface ApplyOptions {
  /** founder-gated: even true does NOT mutate a live goal — there is no live goal flow yet. Supplied store only. */
  enforce?: boolean;
}

export interface ReconcileTickResult {
  plan: ReconcilePlan;
  execution: ReconcileExecution;
}

export interface ReconcileToSettledResult {
  ticks: ReconcileTickResult[];
  transitions: number;
  finalState: GoalState;
}

export interface Reconciler {
  /** THE SOLE MUTATOR DOOR — the ONLY function that calls `contract.transition()`. SHADOW by default (computes
   *  the would-transition, executes NOTHING). With `enforce` it applies the SINGLE next legal edge against the
   *  injected store. The §4.3 validator/trigger rejects any illegal edge (so even a buggy plan cannot smuggle
   *  one past). This is the single-mutator invariant (§15) made structurally true. */
  applyReconcilePlan(plan: ReconcilePlan, opts?: ApplyOptions): Promise<ReconcileExecution>;
  /** read durable state → reconcile → apply (one tick). Stateless: re-reads the contract every tick. */
  reconcileTick(goalId: string, observed: ObservedState, opts?: ApplyOptions): Promise<ReconcileTickResult>;
  /** drive the same (observed) until the decision collapses to SETTLED (or maxTicks), for a multi-edge path. */
  reconcileToSettled(goalId: string, observed: ObservedState, opts?: ApplyOptions, maxTicks?: number): Promise<ReconcileToSettledResult>;
}

/**
 * Compose the reconciler onto an injected `GoalContractStorePort` (supply the `createGoalContractOrgan`-wrapped
 * store so the §4.3 TS validator gates every edge, with the 0053 trigger as the owner-proof backstop on
 * Postgres). This is the WHOLE of the contract-store inversion vs admin: admin bound `transition`/`readContract`
 * to the `./goal-contract.js` DB functions; here they cross the injected port. NO DB, NO default.
 */
export function createReconciler(contract: GoalContractStorePort): Reconciler {
  return {
    async applyReconcilePlan(plan: ReconcilePlan, opts: ApplyOptions = {}): Promise<ReconcileExecution> {
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

      // ── ENFORCE: THE SINGLE transition() CALL SITE. CAS-guarded + validator/trigger-enforced inside the port:
      //    an illegal edge throws (owner-proof). ──
      const row = await contract.transition(plan.goalId, edge.to);
      return {
        goalId: plan.goalId,
        posture: "ENFORCE",
        decision: plan.decision,
        executed: true,
        applied_edge: edge,
        resulting_state: row.state,
        note: `EXECUTED the legal edge ${edge.from}→${edge.to} (${edge.guard}) — the SOLE mutator transitioned the contract`,
      };
    },

    async reconcileTick(goalId: string, observed: ObservedState, opts: ApplyOptions = {}): Promise<ReconcileTickResult> {
      const row = await contract.readContract(goalId);
      if (!row) throw new Error(`po-reconciler-c2: goal_contract ${goalId} not found`);
      const plan = reconcile(row, observed);
      const execution = await this.applyReconcilePlan(plan, opts);
      return { plan, execution };
    },

    async reconcileToSettled(
      goalId: string,
      observed: ObservedState,
      opts: ApplyOptions = {},
      maxTicks = 12,
    ): Promise<ReconcileToSettledResult> {
      const ticks: ReconcileTickResult[] = [];
      let transitions = 0;
      for (let i = 0; i < maxTicks; i++) {
        const t = await this.reconcileTick(goalId, observed, opts);
        ticks.push(t);
        if (t.execution.executed) transitions++;
        if (t.plan.decision === "SETTLED") break;
        // In SHADOW nothing advances → a second tick would loop forever; stop once we've produced the (un-applied)
        // plan (executed:false and not settled means SHADOW with a pending edge — we've shown the would-transition).
        if (!opts.enforce && t.execution.applied_edge) break;
      }
      const row = await contract.readContract(goalId);
      if (!row) throw new Error(`po-reconciler-c2: goal_contract ${goalId} not found after reconcile loop`);
      return { ticks, transitions, finalState: row.state };
    },
  };
}
