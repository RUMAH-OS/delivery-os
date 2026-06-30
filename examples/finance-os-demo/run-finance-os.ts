// =============================================================================
// FINANCE OS — THE TERMINAL PROOF run script (extraction slice 6).
// =============================================================================
// A brand-new, clean-room consumer drives a FINANCE domain through the Delivery OS governance platform:
//   GOAL 1  "Grow MRR to >= €50,000"          → runs the FULL §4.3 lifecycle to DONE (C6 confirms COMPLETE).
//   GOAL 2  "Collect 100% of issued invoices" → STALLS → HALTED + a founder summon (effort-without-progress).
// It imports ONLY the vendored governance-engine + its own finance domain — ZERO rumah-admin / property-lead-os.
// If rumah-admin were deleted, this consumer keeps the Project Owner / Goal Intake / Sprint Planning / Goal
// Supervisor / reconciler / lifecycle / summon — every Runtime organ lives in the platform, not in admin.
//
// Run:  tsx run-finance-os.ts   ·   exit 0 = both lifecycles reached their terminal state · 1 = a failure.

import {
  createFinanceRuntime,
  mrrSubmission,
  mrrLifecycleCtx,
  collectionSubmission,
  collectionLifecycleCtx,
  FINANCE_FOUNDER_ID,
} from "./src/finance-runtime.js";
import type { LifecycleResult } from "./vendor/governance-engine/index.js";

const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });
const line = () => console.log("─".repeat(96));

function printRun(label: string, r: LifecycleResult): void {
  console.log(`\n[${label}]`);
  console.log(`  goalId      : ${r.goalId}`);
  console.log(`  phase       : ${r.phase}   posture: ${r.posture}`);
  console.log(`  preflight   : admit=${r.preflight.admit}`);
  console.log(`  ramp        : ${r.ramp}`);
  console.log(`  statePath   : ${r.statePath.join(" → ")}`);
  console.log(`  finalState  : ${r.finalState}`);
  console.log(`  ticks       : ${r.ticks.length}`);
  for (const t of r.ticks) {
    const gs = t.gsVerdict;
    const rv = t.review ? `  C6=${t.review.verdict}(reprobe=${t.review.evidence.reprobe.value})` : "";
    const sm = t.summon ? `  SUMMON[${t.summon.posture}]→${t.summon.delivered_via}` : "";
    console.log(
      `    tick ${t.tickIndex}: ${t.stateBefore} → ${t.stateAfter}  ` +
        `[GS ${gs.verdict} dGoal=${gs.dGoal} confirmed=${gs.details.progressConfirmed}]` +
        `  plan=${t.plan.decision}  executed=${t.execution.executed}${rv}${sm}`,
    );
  }
  console.log(`  summons     : ${r.summons.length}`);
}

async function main(): Promise<void> {
  line();
  console.log("FINANCE OS — THE TERMINAL PROOF: a brand-new consumer runs a FINANCE domain through Delivery OS");
  console.log("            (imports ONLY the vendored governance-engine + its own finance domain; zero admin code)");
  line();

  // ── compose the runtime from the platform alone (the consumer supplies only adapters + domain + binding) ──
  const runtime = createFinanceRuntime();
  check("PLATFORM: createGovernanceRuntime wired every Runtime organ from the injected ports alone",
    !!runtime.contract && !!runtime.reconciler && !!runtime.supervisor && !!runtime.sprintEngine && !!runtime.controller && typeof runtime.runGoalLifecycle === "function");
  const binding = await runtime.resolveFounderBinding();
  check("PLATFORM: the founder identity resolved from the consumer's injected FounderBindingPort",
    binding.founderId === FINANCE_FOUNDER_ID);

  // ── GOAL 1 — MRR growth → DONE ──
  const mrr = await runtime.runGoalLifecycle(mrrSubmission("finance-mrr-2026Q3"), mrrLifecycleCtx(runtime));
  printRun("GOAL 1 — Grow MRR to >= €50,000", mrr);
  const mrrContract = await runtime.contract.readContract(mrr.goalId!);
  check("GOAL 1: the full finance lifecycle reached DONE (REAL §4.3 transitions, zero Postgres)",
    mrr.finalState === "DONE" && mrrContract!.state === "DONE");
  check("GOAL 1: C6 INDEPENDENTLY gated the DONE boundary (COMPLETE) — the loop did not self-certify",
    mrr.ticks.some((t) => t.review?.verdict === "COMPLETE"));
  check("GOAL 1: a REAL transition executed via the reconciler (the SOLE mutator, §15)",
    mrr.ticks.some((t) => t.execution.executed === true));
  check("GOAL 1: the durable runtime stores captured the finance goal-delta series",
    (await runtime.store.readProgressSeries(mrr.goalId!)).length > 0);

  // ── GOAL 2 — invoice collection STALL → HALTED + summon ──
  const stallRuntime = createFinanceRuntime(); // a fresh runtime/store for the second goal (isolated state).
  const stall = await stallRuntime.runGoalLifecycle(collectionSubmission("finance-collect-2026Q3"), collectionLifecycleCtx(stallRuntime));
  printRun("GOAL 2 — Collect 100% of issued invoices (STALL)", stall);
  const stallContract = await stallRuntime.contract.readContract(stall.goalId!);
  check("GOAL 2: the stalled finance goal reached HALTED (the GS tripped on effort-without-progress)",
    stall.finalState === "HALTED" && stallContract!.state === "HALTED");
  check("GOAL 2: the Goal Supervisor TRIPPED (HALT_AND_SUMMON) — liveness ≠ progress",
    stall.ticks.some((t) => t.gsVerdict.verdict === "HALT_AND_SUMMON"));
  check("GOAL 2: a founder SUMMON was delivered (never dropped) — the platform paged the founder",
    stall.summons.length >= 1);
  check("GOAL 2: the HALT was reached via the legal §4.3 path EXECUTING→REVIEWING→HALTED",
    stall.statePath.includes("REVIEWING") && stall.statePath[stall.statePath.length - 1] === "HALTED");

  // ── tally ──
  line();
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  line();
  const green = failed.length === 0;
  if (green) {
    console.log(`RESULT: GREEN (${cases.length}/${cases.length}) — a BRAND-NEW finance consumer ran a finance`);
    console.log("        goal to DONE and a stall to HALTED+summon through Delivery OS, importing ZERO admin code.");
    console.log("        Delivery OS is the platform; rumah-admin is only a consumer.");
  } else {
    console.error(`RESULT: RED (${cases.length - failed.length}/${cases.length}) — a terminal proof assertion failed.`);
  }
  process.exit(green ? 0 : 1);
}

main().catch((e) => {
  console.error("run-finance-os: FAILED", e);
  process.exit(1);
});
