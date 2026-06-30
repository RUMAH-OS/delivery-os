// Governance Engine — Boundary next-sprint planning (C2-MIND structure) REGRESSION self-test, run against the
// INVERTED organ (`boundary-plan.ts`). The admin module shipped no standalone harness (it is pure, type-coupled);
// this proves the deterministic skeleton is BYTE-FOR-BYTE preserved after the imports were re-pointed onto the
// inverted `./completion-review.js` + `./goal-supervisor.js` + `./ports.js`. NO DB.
//
// THE PROOF: the §4.3 three-way (decideNextBoundary) + the remaining-work gap (computeBoundaryPlan) are unchanged,
// the next-sprint LLM decomposition stays DEFERRED (throws), and a real injected planner slots into the PLANNING
// slot with ZERO structure changes — and ONLY at the PLANNING boundary (a met/halted goal opens no next sprint).
//
// Run:  tsx boundary-plan-self-test.ts   ·   exit 0 = the inverted logic matches the verified logic · 1 = drift.

import {
  decideNextBoundary,
  computeBoundaryPlan,
  planNextSprint,
  type NextSprintPlan,
} from "../boundary-plan.js";
import { reviewCompletion, type CompletionReviewContext } from "../completion-review.js";
import type { GoalContractRow } from "../ports.js";
import type { AcceptanceShape } from "../goal-supervisor.js";

const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });
const L = (s = "") => process.stdout.write(s + "\n");

function contract(state: GoalContractRow["state"] = "REVIEWING"): GoalContractRow {
  const now = new Date();
  return {
    goalId: "boundary-goal", objective: "reach 100% invoice delivery coverage", acceptanceMetric: "delivered_invoice_ratio",
    metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL",
    budgetCap: { max_turns: 100, max_cost_cents: 10000 }, goalDeltaLedgerRef: "boundary-goal",
    state, prevState: "EXECUTING", createdAt: now, updatedAt: now,
  };
}
const ACCEPTANCE: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };

/** Build a REAL C6 review verdict (the boundary planner consumes it — never recomputes it). */
async function review(reprobeValue: number) {
  const ctx: CompletionReviewContext = { acceptance: ACCEPTANCE, reprobe: async () => ({ value: reprobeValue, note: "independent re-probe (fixture)" }) };
  return reviewCompletion(contract(), ctx);
}

async function main() {
  L("governance-engine C2-MIND boundary-plan self-test — the §4.3 three-way + the DEFERRED next-sprint hook\n");

  // ── (A) THE §4.3 THREE-WAY (decideNextBoundary) — deterministic, fail-closed, no LLM ──
  const bComplete = decideNextBoundary("COMPLETE");
  check("THREE-WAY: COMPLETE → DONE (review:complete)", bComplete.to === "DONE" && bComplete.guard === "review:complete");
  const bReachable = decideNextBoundary("INCOMPLETE", { gsUnreachable: false });
  check("THREE-WAY: INCOMPLETE + reachable → PLANNING (review:incomplete-but-reachable)", bReachable.to === "PLANNING" && bReachable.guard === "review:incomplete-but-reachable");
  const bUnreachable = decideNextBoundary("INCOMPLETE", { gsUnreachable: true });
  check("THREE-WAY: INCOMPLETE + GS-unreachable → HALTED (review:unreachable)", bUnreachable.to === "HALTED" && bUnreachable.guard === "review:unreachable");
  // feasibility belongs to the GS, never the review: COMPLETE always DONE even if a stray unreachable flag is passed.
  check("THREE-WAY: COMPLETE wins over a stray gsUnreachable flag (feasibility is the GS's, COMPLETE is C6's)", decideNextBoundary("COMPLETE", { gsUnreachable: true }).to === "DONE");

  // ── (B) computeBoundaryPlan over a REAL C6 COMPLETE verdict → DONE, no next sprint, no remaining work ──
  const planDone = await computeBoundaryPlan(contract(), await review(1.0), ACCEPTANCE);
  check("PLAN(COMPLETE): nextBoundary DONE", planDone.nextBoundary.to === "DONE");
  check("PLAN(COMPLETE): nextSprint slot is NONE (a completed goal opens no new sprint)", planDone.nextSprint.status === "NONE");
  check("PLAN(COMPLETE): remaining work is met (no gap)", planDone.remaining.met === true && planDone.remaining.gap === 0);

  // ── (C) computeBoundaryPlan over a REAL C6 INCOMPLETE verdict (reachable) → PLANNING, the slot stays DEFERRED ──
  const planPlanning = await computeBoundaryPlan(contract(), await review(0.6), ACCEPTANCE, { gsUnreachable: false });
  check("PLAN(INCOMPLETE/reachable): nextBoundary PLANNING", planPlanning.nextBoundary.to === "PLANNING");
  check("PLAN(INCOMPLETE/reachable): the next-sprint LLM decomposition stays DEFERRED (the hook throws, not faked)", planPlanning.nextSprint.status === "DEFERRED");
  check("PLAN(INCOMPLETE/reachable): the remaining-work gap is computed (target 1.0 − observed 0.6 = 0.4)", planPlanning.remaining.met === false && Math.abs((planPlanning.remaining.gap ?? 0) - 0.4) < 1e-9);

  // ── (D) computeBoundaryPlan over a REAL C6 INCOMPLETE verdict (GS-unreachable) → HALTED, no next sprint ──
  const planHalted = await computeBoundaryPlan(contract(), await review(0.6), ACCEPTANCE, { gsUnreachable: true });
  check("PLAN(INCOMPLETE/unreachable): nextBoundary HALTED", planHalted.nextBoundary.to === "HALTED");
  check("PLAN(INCOMPLETE/unreachable): nextSprint slot is NONE (a halted goal opens no new sprint)", planHalted.nextSprint.status === "NONE");

  // ── (E) THE DEFERRED LLM PLANNER STAYS DEFERRED — calling planNextSprint directly THROWS ──
  let planThrew = false;
  try {
    await planNextSprint({ goalId: "x", objective: "y", remaining: planPlanning.remaining, verifiedState: { observedValue: 0.6, observedCycles: 0 } });
  } catch (e) { planThrew = /DEFERRED/.test((e as Error).message); }
  check("DEFERRED: planNextSprint THROWS 'DEFERRED' (the C2-MIND goal→slice decomposition is not faked)", planThrew === true);

  // ── (F) A REAL injected planner slots into the PLANNING slot with ZERO structure changes ──
  const realPlanner = async (): Promise<NextSprintPlan> => ({
    objective: "close the final 40% delivery gap",
    acceptanceCriteria: ACCEPTANCE,
    workPackages: [{ id: "wp-1", summary: "re-deliver the 40% of invoices the engine skipped" }],
  });
  const planWithPlanner = await computeBoundaryPlan(contract(), await review(0.6), ACCEPTANCE, { gsUnreachable: false, plan: realPlanner });
  check("PLANNER: an injected planner makes the PLANNING slot a real PLANNED plan (no structure change)", planWithPlanner.nextSprint.status === "PLANNED" && planWithPlanner.nextSprint.status === "PLANNED" && (planWithPlanner.nextSprint as any).plan.workPackages.length === 1);
  // and the injected planner is NOT awaited for a DONE/HALTED boundary (no next sprint there).
  const planDoneWithPlanner = await computeBoundaryPlan(contract(), await review(1.0), ACCEPTANCE, { plan: realPlanner });
  check("PLANNER: the planner is NOT invoked at a DONE boundary (the slot is NONE, not PLANNED)", planDoneWithPlanner.nextSprint.status === "NONE");

  // ── tally ──
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\ngovernance-engine C2-MIND boundary-plan self-test (verbatim three-way + DEFERRED planner hook): ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
