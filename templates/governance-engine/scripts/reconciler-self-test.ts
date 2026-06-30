// Governance Engine — PO reconciler (C2-LOOP) REGRESSION self-test, ported VERBATIM from the VERIFIED admin
// harness (`rumah-admin/scripts/po-reconciler-c2.ts --self-test`) and run against the INVERTED organ + the
// IN-MEMORY `GoalContractStorePort`.
//
// THE PROOF THIS FILE EXISTS TO MAKE: the level-triggered reconcile rule + the §15 SOLE-MUTATOR invariant are
// BYTE-FOR-BYTE unchanged after `transition`/`readContract` were re-pointed onto an injected
// `GoalContractStorePort`. Cases (A)-(E) are copied verbatim from the admin harness (the reconcile decisions are
// identical). The admin (E) single-mutator SOURCE SCAN is adapted to the PACKAGE (it now proves `reconciler.ts`
// is the only organ that calls `.transition(`, exactly once). The admin `--db-self-test` (real Postgres §4.3
// transitions) is reproduced as (F) the PORT-COMPOSITION path: the SOLE mutator drives a real
// EXECUTING→REVIEWING→HALTED through the IN-MEMORY `GoalContractStorePort` (zero Postgres) and an illegal edge is
// rejected by the package's §4.3 TS validator. Same inputs ⇒ same verdicts.
//
// Run:  tsx reconciler-self-test.ts   ·   exit 0 = the inverted logic matches the verified logic · 1 = drift.

import {
  reconcile,
  createReconciler,
  type ObservedState,
} from "../reconciler.js";
import type { GoalContractRow } from "../ports.js";
import { evaluateGoalSupervision, DEFAULT_GRACE_FLOOR, DEFAULT_WINDOW, DEFAULT_EPSILON, type GoalSupervisionFacts } from "../goal-supervisor.js";
import { createInMemoryGoalContractStore } from "./in-memory-store.js";
import { createGoalContractOrgan } from "../goal-contract.js";

const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });

// ── helpers to build fixtures (VERBATIM from the admin harness) ──────────────────
function fakeContract(over: Partial<GoalContractRow> = {}): GoalContractRow {
  const now = new Date();
  return {
    goalId: "fixture-goal",
    objective: "reach 100% invoice delivery coverage",
    acceptanceMetric: "delivered_invoice_ratio",
    metricSourceProbeId: "invoice-delivery-coverage",
    metricSourceVersion: 1,
    dataClass: "CONFIDENTIAL",
    budgetCap: { max_turns: 100, max_cost_cents: 10000 },
    goalDeltaLedgerRef: "fixture-goal",
    state: "EXECUTING",
    prevState: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

// Build a GS verdict by running the REAL evaluator over facts (the reconciler CONSUMES it, never recomputes).
function gsVerdictFor(facts: Partial<GoalSupervisionFacts> & Pick<GoalSupervisionFacts, "progressSeries" | "externalReprobe" | "effort">) {
  const full: GoalSupervisionFacts = {
    goalId: "fixture-goal",
    window: DEFAULT_WINDOW,
    epsilon: DEFAULT_EPSILON,
    graceFloor: DEFAULT_GRACE_FLOOR,
    acceptance: { op: ">=", target: 1.0, direction: "increase" },
    contractState: "EXECUTING",
    readable: { progress: true, effort: true },
    ...facts,
  };
  return evaluateGoalSupervision(full);
}

async function main() {
  const budget = { max_turns: 100, max_cost_cents: 10000 };
  // SHADOW reconciler — applyReconcilePlan(enforce:false) never touches the port, so any contract store works.
  const shadow = createReconciler(createGoalContractOrgan(createInMemoryGoalContractStore()));

  // ── (A) PROGRESSING goal → CONTINUE (no transition) ──
  const progFacts = {
    progressSeries: [{ cycle: 0, value: 0.20 }, { cycle: 1, value: 0.35 }, { cycle: 2, value: 0.50 }, { cycle: 3, value: 0.62 }],
    externalReprobe: { ok: true as const, value: 0.78, cycle: 4 },
    effort: { attempts: 40, cumulativeCostCents: 4000, budgetCap: budget },
  };
  const progObserved: ObservedState = {
    progressSeries: progFacts.progressSeries, attempts: 40, cumulativeCostCents: 4000,
    gsVerdict: gsVerdictFor(progFacts), currentMetricValue: 0.78, acceptance: { op: ">=", target: 1.0, direction: "increase" },
  };
  const planA = reconcile(fakeContract({ state: "EXECUTING" }), progObserved);
  check("CONTINUE: a progressing goal continues with NO transition", planA.decision === "CONTINUE" && planA.next_transition === null);
  const execA = await shadow.applyReconcilePlan(planA, { enforce: false });
  check("CONTINUE: applying the plan mutates nothing (executed:false, no edge)", execA.executed === false && execA.applied_edge === null);

  // ── (B) GS HALT verdict → EXECUTE_HALT (drive the legal edge toward HALTED) ──
  const stalledFacts = {
    progressSeries: [
      { cycle: 0, value: 0.42, fixRef: "retry-discovery" }, { cycle: 1, value: 0.42, fixRef: "retry-discovery" },
      { cycle: 2, value: 0.42, fixRef: "retry-discovery" }, { cycle: 3, value: 0.42, fixRef: "retry-discovery" },
    ],
    externalReprobe: { ok: true as const, value: 0.42, cycle: 4 },
    effort: { attempts: 80, cumulativeCostCents: 9000, budgetCap: budget },
  };
  const stalledGs = gsVerdictFor(stalledFacts);
  check("CONSUME: the GS verdict is HALT_AND_SUMMON (the reconciler consumes it, does not recompute)", stalledGs.trip === true);
  const haltObserved: ObservedState = {
    progressSeries: stalledFacts.progressSeries, attempts: 80, cumulativeCostCents: 9000,
    gsVerdict: stalledGs, currentMetricValue: 0.42, acceptance: { op: ">=", target: 1.0, direction: "increase" },
  };
  const planB = reconcile(fakeContract({ state: "EXECUTING" }), haltObserved);
  check("EXECUTE_HALT: a GS HALT verdict → decision EXECUTE_HALT", planB.decision === "EXECUTE_HALT" && planB.desired_state === "HALTED");
  check("EXECUTE_HALT: the chain is the LEGAL §4.3 path EXECUTING→REVIEWING→HALTED", planB.chain.length === 2 && planB.chain[0]!.to === "REVIEWING" && planB.chain[1]!.to === "HALTED");
  check("EXECUTE_HALT: the immediate edge names the GS-early-trip guard", planB.next_transition?.from === "EXECUTING" && planB.next_transition?.to === "REVIEWING" && planB.next_transition?.guard === "GS-early-trip");
  const planB2 = reconcile(fakeContract({ state: "REVIEWING" }), haltObserved);
  check("EXECUTE_HALT: from REVIEWING the path is a single legal edge REVIEWING→HALTED (review:unreachable)", planB2.chain.length === 1 && planB2.next_transition?.to === "HALTED" && planB2.next_transition?.guard === "review:unreachable");
  const execB = await shadow.applyReconcilePlan(planB, { enforce: false });
  check("SHADOW: EXECUTE_HALT drafts the would-transition but executes NOTHING (executed:false)", execB.executed === false && execB.applied_edge?.to === "REVIEWING");

  // ── (C) ACCEPTANCE MET → TRANSITION_DONE (toward DONE) ──
  const metFacts = {
    progressSeries: [{ cycle: 0, value: 0.80 }, { cycle: 1, value: 0.90 }, { cycle: 2, value: 0.97 }, { cycle: 3, value: 1.0 }],
    externalReprobe: { ok: true as const, value: 1.0, cycle: 4 },
    effort: { attempts: 60, cumulativeCostCents: 6000, budgetCap: budget },
  };
  const metObserved: ObservedState = {
    progressSeries: metFacts.progressSeries, attempts: 60, cumulativeCostCents: 6000,
    gsVerdict: gsVerdictFor(metFacts), currentMetricValue: 1.0, acceptance: { op: ">=", target: 1.0, direction: "increase" },
  };
  const planC = reconcile(fakeContract({ state: "REVIEWING" }), metObserved);
  check("TRANSITION_DONE: an acceptance-met goal decides toward DONE", planC.decision === "TRANSITION_DONE" && planC.desired_state === "DONE");
  check("TRANSITION_DONE: from REVIEWING the legal edge is REVIEWING→DONE (review:complete)", planC.next_transition?.to === "DONE" && planC.next_transition?.guard === "review:complete");
  const planC2 = reconcile(fakeContract({ state: "EXECUTING" }), metObserved);
  check("TRANSITION_DONE: from EXECUTING the chain routes EXECUTING→REVIEWING→DONE", planC2.chain.length === 2 && planC2.chain[1]!.to === "DONE");

  // ── (D) IDEMPOTENCY / level-triggered — reconciling a SETTLED contract is a pure no-op ──
  const planHalted = reconcile(fakeContract({ state: "HALTED" }), haltObserved);
  check("IDEMPOTENCY: a HALTED contract reconciles to SETTLED (no transition)", planHalted.decision === "SETTLED" && planHalted.next_transition === null);
  const planDone = reconcile(fakeContract({ state: "DONE" }), metObserved);
  check("IDEMPOTENCY: a DONE contract reconciles to SETTLED (terminal, no transition)", planDone.decision === "SETTLED" && planDone.next_transition === null);
  const planB_again = reconcile(fakeContract({ state: "EXECUTING" }), haltObserved);
  check("LEVEL-TRIGGERED: reconciling the same (desired, observed) twice yields the identical decision + edge", planB_again.decision === planB.decision && planB_again.next_transition?.to === planB.next_transition?.to);

  // ── (E) SINGLE-MUTATOR INVARIANT (structural) — `.transition(` has exactly ONE organ call site (reconciler) ──
  // Adapted to the package: scan the package-root organ files. A file is a lifecycle MUTATOR iff (after stripping
  // comments + imports) it calls `.transition(` on a contract port. `goal-contract.ts` (the §4.3 validator-organ
  // wrapper — the store-delegation DEFINITION, the package analogue of admin's excluded goal-contract.ts),
  // `ports.ts` (the interface), and `state-machine.ts` (no port) are excluded — exactly as admin excludes its
  // goal-contract.ts definition.
  {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = resolve(here, ".."); // scripts/ -> package root
    const EXCLUDE = new Set(["goal-contract.ts", "ports.ts", "state-machine.ts"]);
    const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const stripImports = (c: string) => c.replace(/import\s*(?:type\s*)?\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, "");
    // strip STRING + TEMPLATE literals so a call site is never confused with a literal mentioning ".transition()"
    // (e.g. the reconciler's CONSUMES provenance array) — a source scan counts CALLS, not documentation text.
    const stripStrings = (c: string) => c.replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``").replace(/'(?:\\.|[^'\\])*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""');
    const prep = (code: string) => stripStrings(stripImports(code));
    // a CALL to `.transition(` on a port instance (dot-prefixed) OR a bare `transition(` value call.
    const callsTransition = (code: string) => (prep(code).match(/(?:^|[^.\w])transition\s*\(|\.\s*transition\s*\(/g) ?? []).length;

    const callers: Array<{ file: string; count: number }> = [];
    for (const ent of readdirSync(pkgRoot, { withFileTypes: true })) {
      if (!ent.isFile() || !ent.name.endsWith(".ts") || EXCLUDE.has(ent.name)) continue;
      const code = stripComments(readFileSync(resolve(pkgRoot, ent.name), "utf8"));
      const n = callsTransition(code);
      if (n > 0) callers.push({ file: ent.name, count: n });
    }
    console.log(`── (E) single-mutator scan: package organs that CALL .transition() ──`);
    console.log(`  callers: ${callers.length ? callers.map((c) => `${c.file}×${c.count}`).join(", ") : "(none)"}\n`);
    check("SINGLE-MUTATOR: reconciler.ts is the ONLY organ that calls .transition()", callers.length === 1 && callers[0]!.file === "reconciler.ts");
    check("SINGLE-MUTATOR: .transition() is called exactly ONCE in the reconciler (the applyReconcilePlan door)", callers[0]?.count === 1);
    // the Goal Supervisor + Sprint Engine + Completion Review never mutate state (§15).
    for (const organ of ["goal-supervisor.ts", "sprint-engine.ts", "completion-review.ts"]) {
      const code = stripComments(readFileSync(resolve(pkgRoot, organ), "utf8"));
      check(`SINGLE-MUTATOR: ${organ} never calls .transition() (it drafts/writes evidence only)`, callsTransition(code) === 0);
    }
  }

  // ── (F) PORT-COMPOSITION — the SOLE mutator drives a real EXECUTING→REVIEWING→HALTED through the IN-MEMORY
  //        GoalContractStorePort (zero Postgres); an illegal edge is rejected by the §4.3 TS validator. ──
  {
    const contract = createGoalContractOrgan(createInMemoryGoalContractStore());
    const goal = await contract.createContract({
      objective: "reach 100% coverage", acceptanceMetric: "delivered_invoice_ratio",
      metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1,
      dataClass: "CONFIDENTIAL", budgetCap: { max_turns: 100, max_cost_cents: 10000 },
    });
    for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as const) await contract.transition(goal.goalId, to);
    const rec = createReconciler(contract);

    // ILLEGAL edge proof: EXECUTING→HALTED (skipping REVIEWING) is rejected by the package §4.3 TS validator.
    let illegalRejected = false;
    try { await contract.transition(goal.goalId, "HALTED"); } catch { illegalRejected = true; }
    check("PORT ILLEGAL-EDGE: EXECUTING→HALTED (skipping REVIEWING) is REJECTED by the §4.3 validator", illegalRejected);
    check("PORT ILLEGAL-EDGE: the rejected edge left the contract untouched (still EXECUTING)", (await contract.readContract(goal.goalId))!.state === "EXECUTING");

    const observed: ObservedState = {
      progressSeries: stalledFacts.progressSeries, attempts: 80, cumulativeCostCents: 9000,
      gsVerdict: stalledGs, currentMetricValue: 0.42, acceptance: { op: ">=", target: 1.0, direction: "increase" },
    };
    const settled = await rec.reconcileToSettled(goal.goalId, observed, { enforce: true });
    check("PORT EXECUTE_HALT: the SOLE mutator drove the contract to HALTED via the legal path (zero Postgres)", settled.finalState === "HALTED");
    check("PORT EXECUTE_HALT: it took exactly 2 legal transitions (EXECUTING→REVIEWING→HALTED)", settled.transitions === 2);
    check("PORT EXECUTE_HALT: the first decision was EXECUTE_HALT", settled.ticks[0]!.plan.decision === "EXECUTE_HALT");
    const again = await rec.reconcileTick(goal.goalId, observed, { enforce: true });
    check("PORT IDEMPOTENCY: reconciling the now-HALTED goal again is SETTLED (no second transition)", again.plan.decision === "SETTLED" && again.execution.executed === false);
  }

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  console.log(`\ngovernance-engine C2-LOOP reconciler self-test (verbatim reconcile table + single-mutator scan + port composition): ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
