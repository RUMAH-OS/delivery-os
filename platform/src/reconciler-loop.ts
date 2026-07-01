// =============================================================================
// The reconciler sweep loop (C2-LOOP driver) — the OS's level-triggered tick over the goal portfolio.
// =============================================================================
// The reconciler (po-reconciler-c2.ts) is the SOLE MUTATOR (frozen invariant §15). This driver is NOT a
// second mutator: it only READS the tickable portfolio and asks the reconciler to tick each goal. Every
// contract transition still happens exclusively inside po-reconciler-c2.applyReconcilePlan().
//
// SWEEP = read every non-settled goal_contract, run reconcileTick on each. On a BARE OS the portfolio is
// EMPTY → the sweep is a legal idle no-op (§2.2 step 2: "the reconciler ticks on an empty portfolio without
// error"). Posture is SHADOW by default: there is no live goal-submission flow yet (Sprint 5.3), so the loop
// computes the would-transition and mutates nothing.
//
// ── E-PH M2 WIRING (po-autoloop-c2 → po-reconciler-c2 in the tick loop) ──
//   M2 relocated the full goal-governance spine into the OS. This driver is now wired to two of them:
//     · po-autoloop-c2  — the level-triggered lifecycle controller. Its `isSettled` is the SETTLED predicate
//       the sweep uses (the same list the reconciler enforces); the full per-goal governance tick
//       (po-autoloop.runGoalLifecycle/tick) is the loop DRIVER that activates when the live goal-submission
//       flow lands (it needs the observe/review seams — the metric-probe re-read + the C6 re-probe — which are
//       DEFERRED until the executor/probe organs are provisioned, exactly like §36.3's LLM). The reconciler
//       stays the SOLE mutator: the autoloop never calls transition() (its own §15 source-scan proves it).
//     · runtime-stores  — the durable C12 door (migration 0052). The observed state per goal is now assembled
//       from the REAL platform-owned ledgers (progress series + attempts + cumulative cost) instead of the M1
//       empty view. The GS VERDICT stays null (the C7 judgment organ + the §36.3 LLM reachability are the
//       deferred "judgment edges"), so the reconciler still fails closed to no autonomous mutation.
//   Net: judgment edges deferred (STUB), autonomously-justifiable edges = the reconciler's existing logic; no
//   new transition is invented. On the bare OS the portfolio is empty, so the wiring is an idle no-op.
import { sql } from "./db/client.js";
import { reconcileTick, type ObservedState } from "./po-reconciler-c2.js";
import { isSettled } from "./po-autoloop-c2.js";
import { readProgressSeries, countAttempts, readCumulativeCost } from "./runtime-stores.js";
import type { GoalState } from "./goal-contract.js";
import type { ProgressPoint } from "./goal-supervisor-c7.js";

const SETTLED: ReadonlyArray<GoalState> = ["DONE", "FAILED", "CLOSED", "HALTED", "SUSPENDED"];

/** Assemble the VERIFIED observed view for a goal from the platform-owned durable ledgers (runtime-stores,
 *  0052) — the same door the reconciler documents consuming (progress ← goal_delta_ledger, effort ← attempt +
 *  cost ledgers). The GS verdict is NULL: the C7 supervision organ + the §36.3 LLM reachability are the
 *  deferred judgment edges, so an assembled-but-unsupervised goal yields no autonomous mutation (fail-closed). */
async function observedFor(goalId: string): Promise<ObservedState> {
  const progressSeries = (await readProgressSeries(goalId)) as ProgressPoint[];
  const attempts = await countAttempts(goalId);
  const cumulativeCostCents = await readCumulativeCost(goalId);
  return { progressSeries, attempts, cumulativeCostCents, gsVerdict: null };
}

export interface SweepResult {
  swept: number;
  transitions: number;
  decisions: Record<string, number>;
}

/** One reconciler sweep across the tickable portfolio. Returns how many goals were ticked + the decision
 *  histogram. `enforce` drives REAL transitions (test/live flow only); default SHADOW mutates nothing. */
export async function reconcileSweep(opts: { enforce?: boolean } = {}): Promise<SweepResult> {
  const rows = await sql<{ goal_id: string; state: GoalState }[]>`
    SELECT goal_id, state FROM goal_contract WHERE state <> ALL(${SETTLED as unknown as string[]})`;
  const decisions: Record<string, number> = {};
  let transitions = 0;
  for (const r of rows) {
    // Defensive idempotency guard via po-autoloop-c2.isSettled (the SAME settled-state predicate the lifecycle
    // controller enforces): a row that settled between the SELECT and the tick is skipped (never re-mutated).
    if (isSettled(r.state)) continue;
    const observed = await observedFor(r.goal_id);
    const { plan, execution } = await reconcileTick(r.goal_id, observed, { enforce: opts.enforce });
    decisions[plan.decision] = (decisions[plan.decision] ?? 0) + 1;
    if (execution.executed) transitions++;
  }
  return { swept: rows.length, transitions, decisions };
}
