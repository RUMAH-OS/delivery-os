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
// computes the would-transition and mutates nothing. The observed state is the M1 empty view (no ledger/GS
// organs yet — those move in M2); a goal with no progress + no GS verdict reconciles to WAIT/CONTINUE/SETTLED
// with no transition, which is exactly the idle behaviour M1 must prove.
import { sql } from "./db/client.js";
import { reconcileTick, type ObservedState } from "./po-reconciler-c2.js";
import type { GoalState } from "./goal-contract.js";

const SETTLED: ReadonlyArray<GoalState> = ["DONE", "FAILED", "CLOSED", "HALTED", "SUSPENDED"];

/** The empty M1 observed view for a goal (no ledger samples, no GS verdict — the organs that produce them
 *  move to the OS in M2). Fail-closed: an empty progress series + null verdict yields no autonomous mutation. */
function emptyObserved(): ObservedState {
  return { progressSeries: [], attempts: 0, cumulativeCostCents: 0, gsVerdict: null };
}

export interface SweepResult {
  swept: number;
  transitions: number;
  decisions: Record<string, number>;
}

/** One reconciler sweep across the tickable portfolio. Returns how many goals were ticked + the decision
 *  histogram. `enforce` drives REAL transitions (test/live flow only); default SHADOW mutates nothing. */
export async function reconcileSweep(opts: { enforce?: boolean } = {}): Promise<SweepResult> {
  const rows = await sql<{ goal_id: string }[]>`
    SELECT goal_id FROM goal_contract WHERE state <> ALL(${SETTLED as unknown as string[]})`;
  const decisions: Record<string, number> = {};
  let transitions = 0;
  for (const r of rows) {
    const { plan, execution } = await reconcileTick(r.goal_id, emptyObserved(), { enforce: opts.enforce });
    decisions[plan.decision] = (decisions[plan.decision] ?? 0) + 1;
    if (execution.executed) transitions++;
  }
  return { swept: rows.length, transitions, decisions };
}
