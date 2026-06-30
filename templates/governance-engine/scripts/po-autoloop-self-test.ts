// Governance Engine — PO auto-loop / goal-lifecycle controller (C2) REGRESSION self-test, ported VERBATIM from
// the VERIFIED admin harness (`rumah-admin/scripts/po-autoloop-c2.ts --self-test`) and run against the INVERTED
// controller + the IN-MEMORY ports (zero Postgres).
//
// THE PROOF THIS FILE EXISTS TO MAKE: the level-triggered lifecycle + §15 (the reconciler is the SOLE mutator) +
// C6-GATES-DONE (the B1 fix) are BYTE-FOR-BYTE preserved after `createContract`/`readContract`/
// `appendProgressSample`/`readProgressSeries` were re-pointed onto the injected ports and `applyReconcilePlan`
// became the reconciler-instance door. Cases (A)-(G) are copied verbatim from the admin harness; the ONLY edits
// are the import paths, obtaining `tick`/`runGoalLifecycle` from `createGoalLifecycleController(in-memory ports)`,
// and the §15 scan retargeted to the package file. The admin `--db-self-test` (real Postgres §4.3 transitions) is
// reproduced as (H) the PORT-COMPOSITION path: an ENFORCE lifecycle drives REAL §4.3 transitions through the
// IN-MEMORY ports to DONE (zero Postgres), and (H') wires the C10 sprint engine as the controller's runSprint hook
// via `asControllerHook`. Same inputs ⇒ same verdicts / the same state path.
//
// Run:  tsx po-autoloop-self-test.ts   ·   exit 0 = the inverted logic matches the verified logic · 1 = drift.

import {
  createGoalLifecycleController,
  fixtureContractFromGoal,
  type LifecycleContext,
  type LifecycleResult,
  type GoalSubmission,
  type SprintExecutor,
  type ObservedTickInput,
} from "../po-autoloop.js";
import { ProbeRegistry, type MetricProbe } from "../metric-probe.js";
import type { PreflightGoal, PreflightContext } from "../preflight.js";
import type { ReachabilityVerdict } from "../reachability-evaluator.js";
import type { ProgressPoint, AcceptanceShape } from "../goal-supervisor.js";
import {
  createSprintEngine,
  makeStubSpawner,
  asControllerHook,
} from "../sprint-engine.js";
import { createGoalContractOrgan } from "../goal-contract.js";
import { createInMemoryGoalContractStore, createInMemoryRuntimeStores } from "./in-memory-store.js";
import type { GoalState } from "../ports.js";

const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });
const L = (s = "") => process.stdout.write(s + "\n");

const ACCEPTANCE: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };
const BUDGET = { max_turns: 100, max_cost_cents: 10000 };

function probeRegistry(): ProbeRegistry {
  const registry = new ProbeRegistry();
  const probe: MetricProbe = {
    probe_id: "invoice-delivery-coverage", version: 1, metric_kind: "ratio", type: "sql",
    target: "SELECT 1.0::numeric AS value", expected_shape: "1 row, col value::numeric",
    credential_ref: "PROBE_RO_URL", extract: (rows) => Number((rows[0] as any)?.value ?? null),
  };
  registry.register(probe);
  return registry;
}

const REACHABLE: ReachabilityVerdict = { reachable: true, confidence: 0.95, evidence: "100% delivery coverage is reachable; the lever exists." };
const ALL_CONFIG_PRESENT = async () => [];

function feasibleGoal(goalId: string): PreflightGoal {
  return {
    goalId, objective: "reach 100% invoice delivery coverage",
    acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage",
    metricSourceVersion: 1, budgetCap: BUDGET, acceptance: { metric: "delivered_invoice_ratio", op: ">=", target: 1.0, direction: "increase" }, requiredConfigKeys: [],
  };
}
function feasiblePreflightCtx(): PreflightContext {
  return { targetEnv: "test", probeRegistry: probeRegistry(), configReadiness: ALL_CONFIG_PRESENT, reachability: { kind: "verdict", verdict: REACHABLE } };
}
function unreachableGoal(goalId: string): PreflightGoal {
  return {
    goalId, objective: "discover every off-market property in the city (unbounded, unmeasurable)",
    acceptanceMetric: "off_market_properties_found", metricSourceProbeId: "no-such-probe",
    metricSourceVersion: 1, budgetCap: { max_turns: 50 }, acceptance: { metric: "off_market_properties_found", op: ">=", target: 1, direction: "increase" },
  };
}
function unreachablePreflightCtx(): PreflightContext {
  return { targetEnv: "test" }; // default reachability = the DEFERRED evaluator → fail-closed
}

function trajectory(points: Array<{ value: number | null; attempts: number; cost: number; fixRef?: string }>, startCycle: number) {
  return async (_goalId: string, tickIndex: number): Promise<ObservedTickInput> => {
    const p = points[Math.min(tickIndex, points.length - 1)]!;
    return { cycle: startCycle + tickIndex, metricValue: p.value, attempts: p.attempts, cumulativeCostCents: p.cost, fixRef: p.fixRef ?? null };
  };
}

function happyContext(reprobeValue = 1.0): LifecycleContext {
  return {
    acceptance: ACCEPTANCE, budgetCap: BUDGET,
    seedProgress: [{ cycle: 0, value: 0.3 }, { cycle: 1, value: 0.5 }, { cycle: 2, value: 0.7 }, { cycle: 3, value: 0.9 }],
    observe: trajectory([{ value: 1.0, attempts: 60, cost: 6000 }, { value: 1.0, attempts: 62, cost: 6200 }], 4),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: reprobeValue, note: "independent re-probe (injected fixture)" }) },
    maxTicks: 6,
  };
}
function stallContext(): LifecycleContext {
  return {
    acceptance: ACCEPTANCE, budgetCap: BUDGET,
    seedProgress: [
      { cycle: 0, value: 0.42, fixRef: "retry-discovery" }, { cycle: 1, value: 0.42, fixRef: "retry-discovery" }, { cycle: 2, value: 0.42, fixRef: "retry-discovery" },
    ],
    observe: trajectory([
      { value: 0.42, attempts: 80, cost: 9000, fixRef: "retry-discovery" }, { value: 0.42, attempts: 82, cost: 9100, fixRef: "retry-discovery" },
    ], 3),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: 0.42, note: "independent re-probe (injected fixture)" }) },
    maxTicks: 6,
  };
}

// A SHADOW controller over the in-memory ports — SHADOW never mutates the port, so a single instance serves all
// SHADOW cases. ENFORCE cases (H/H') build their own controller over a fresh store.
function shadowController() {
  return createGoalLifecycleController({
    contract: createGoalContractOrgan(createInMemoryGoalContractStore()),
    store: createInMemoryRuntimeStores(),
  });
}

async function main() {
  L("governance-engine C2 PO auto-loop self-test — the 3 lifecycle paths + §15 + C6-gates-DONE (B1), in-memory ports\n");
  const ctrl = shadowController();

  // ── (A) HAPPY PATH — feasible → ADMIT → EXECUTING → progressing ticks → met → C6 COMPLETE → reconciler DONE ──
  const happy = await ctrl.runGoalLifecycle({ goal: feasibleGoal("happy"), preflightCtx: feasiblePreflightCtx() }, happyContext());
  check("HAPPY: the goal is ADMITTED at the pre-flight gate", happy.phase === "ADMITTED" && happy.preflight.admit === true);
  check("HAPPY: the lifecycle reaches DONE", happy.finalState === "DONE");
  check("HAPPY: the state path is CREATED→EXECUTING→REVIEWING→DONE", happy.statePath.join(",") === "CREATED,EXECUTING,REVIEWING,DONE");
  check("HAPPY: C6 owned the DONE boundary with a COMPLETE verdict", happy.ticks.some((t) => t.review?.verdict === "COMPLETE"));
  check("HAPPY: the GS never tripped (the goal was confirmed advancing)", happy.ticks.every((t) => t.gsVerdict.trip === false));
  check("HAPPY: no summon fired (no boundary needed a founder decision)", happy.summons.length === 0);
  check("HAPPY: SHADOW mutated nothing (every apply executed:false)", happy.ticks.every((t) => t.execution.executed === false));

  // ── (B) STALL PATH — no progress → GS trips → reconciler executes the HALT → summon fired ──
  const stall = await ctrl.runGoalLifecycle({ goal: feasibleGoal("stall"), preflightCtx: feasiblePreflightCtx() }, stallContext());
  check("STALL: the goal is ADMITTED then governed", stall.phase === "ADMITTED");
  check("STALL: the GS tripped (effort-without-progress)", stall.ticks.some((t) => t.gsVerdict.trip === true));
  check("STALL: the reconciler decided EXECUTE_HALT (consuming the GS draft)", stall.ticks.some((t) => t.plan.decision === "EXECUTE_HALT"));
  check("STALL: the lifecycle reaches HALTED via EXECUTING→REVIEWING→HALTED", stall.finalState === "HALTED" && stall.statePath.join(",") === "CREATED,EXECUTING,REVIEWING,HALTED");
  check("STALL: exactly ONE feasibility/strategy summon fired (deduped across the halt path)", stall.summons.length === 1 && stall.summons[0]!.source === "goal-supervisor-c7" && stall.summons[0]!.boundary_class === "feasibility/strategy");
  check("STALL: the summon was NOT dropped", stall.summons[0]!.dropped === false);

  // ── (C) REFUSE PATH — unreachable → pre-flight REFUSE → no contract, refusal FAP summoned ──
  const refuse = await ctrl.runGoalLifecycle({ goal: unreachableGoal("refuse"), preflightCtx: unreachablePreflightCtx() }, happyContext());
  check("REFUSE: the goal is REFUSED at the pre-flight gate", refuse.phase === "REFUSED_AT_PREFLIGHT" && refuse.preflight.admit === false);
  check("REFUSE: NO contract was created (refused at hour 0)", refuse.contract === null && refuse.ticks.length === 0);
  check("REFUSE: a refusal FAP was summoned (source preflight-gate-c9)", refuse.summons.length === 1 && refuse.summons[0]!.source === "preflight-gate-c9");
  check("REFUSE: the refusal summon was NOT dropped", refuse.summons[0]!.dropped === false);
  check("REFUSE: the blockers include unmeasurable-metric + statically-unreachable", refuse.preflight.blockers.some((b) => b.code === "unmeasurable-metric") && refuse.preflight.blockers.some((b) => b.code === "statically-unreachable"));

  // ── (D) IDEMPOTENT TICK — re-tick a SETTLED goal → a pure no-op (no transition, nothing observed) ──
  const doneContract = fixtureContractFromGoal(feasibleGoal("settled"), { state: "DONE" });
  let observedCalled = false;
  const settledTick = await ctrl.tick(doneContract, {
    acceptance: ACCEPTANCE, budgetCap: BUDGET,
    observe: async () => { observedCalled = true; return { cycle: 0, metricValue: 1.0, attempts: 0, cumulativeCostCents: 0 }; },
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: 1.0 }) },
  }, 0);
  check("IDEMPOTENCY: re-ticking a DONE goal decides SETTLED (no transition)", settledTick.plan.decision === "SETTLED" && settledTick.execution.executed === false && settledTick.execution.applied_edge === null);
  check("IDEMPOTENCY: a settled tick observes nothing (no probe, no work — pure no-op)", observedCalled === false && settledTick.executor.startsWith("not invoked"));
  const haltedContract = fixtureContractFromGoal(feasibleGoal("settled2"), { state: "HALTED" });
  const haltedTick = await ctrl.tick(haltedContract, { acceptance: ACCEPTANCE, budgetCap: BUDGET, observe: async () => ({ cycle: 0, metricValue: 0.42, attempts: 0, cumulativeCostCents: 0 }), review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: 0.42 }) } }, 0);
  check("IDEMPOTENCY: re-ticking a HALTED goal is SETTLED (settled states are terminal-for-the-loop)", haltedTick.plan.decision === "SETTLED" && haltedTick.execution.executed === false);

  // ── (E) THE EXECUTOR STAYS DEFERRED — no silent dependency on un-built work ──
  check("DEFERRED: every governed happy tick recorded the executor as DEFERRED (no real work spawned)", happy.ticks.every((t) => t.executor.startsWith("DEFERRED")));
  check("DEFERRED: every governed stall tick recorded the executor as DEFERRED", stall.ticks.every((t) => t.executor.startsWith("DEFERRED")));
  const flags = { sprintCalled: false }; // holder object: property mutation in the closure is not CF-narrowed
  const throwingExecutor: SprintExecutor = { admitToExecuting: async () => { throw new Error("ramp DEFERRED"); }, runSprint: async () => { flags.sprintCalled = true; throw new Error("runSprint DEFERRED for this test"); } };
  const ctxWithExec: LifecycleContext = { ...happyContext(), executor: throwingExecutor };
  const happyExec = await ctrl.runGoalLifecycle({ goal: feasibleGoal("happy-exec"), preflightCtx: feasiblePreflightCtx() }, ctxWithExec);
  check("DEFERRED: an injected runSprint that throws is caught — the governance still reaches DONE", flags.sprintCalled === true && happyExec.finalState === "DONE");

  // ── (G) THE B1 GUARD — the loop CANNOT self-certify done (loop-claims-1.0 / C6-reprobes-0.5 → PLANNING, never DONE) ──
  const b1 = await ctrl.runGoalLifecycle({ goal: feasibleGoal("b1-divergent"), preflightCtx: feasiblePreflightCtx() }, happyContext(0.5));
  check("B1: the goal NEVER reaches DONE (the loop cannot self-certify done over C6's independent re-probe)", b1.finalState !== "DONE" && !b1.statePath.includes("DONE"));
  check("B1: C6 INCOMPLETE gated the boundary to PLANNING (incomplete-but-reachable)", b1.finalState === "PLANNING" && b1.ticks.some((t) => t.review?.verdict === "INCOMPLETE" && t.reviewBoundary?.to === "PLANNING"));
  check("B1: NO contradictory terminal — no tick both transitions to DONE and carries an INCOMPLETE summon", !b1.ticks.some((t) => t.execution.applied_edge?.to === "DONE" && t.summon?.source === "completion-review-c6"));
  check("B1: the C6-gated boundary used C6's INDEPENDENT re-probe (0.5), not the loop's observed metric (1.0)", b1.ticks.some((t) => t.review !== null && t.review.evidence.reprobe.value === 0.5 && t.observed.metricValue === 1.0));
  check("B1 (twin): a genuinely-met goal (C6 COMPLETE re-probe 1.0) STILL reaches DONE", happy.finalState === "DONE" && happy.ticks.some((t) => t.review?.verdict === "COMPLETE" && t.reviewBoundary?.to === "DONE"));

  // ── (F) NO SECOND MUTATOR (§15, structural) — po-autoloop.ts NEVER imports/calls a transition() ──
  {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = resolve(here, "..");
    const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const importsTransition = (code: string): boolean => /import\s*(?:type\s*)?\{[^}]*\btransition\b[^}]*\}\s*from\s*["'][^"']*(?:goal-contract|ports)(?:\.js)?["']/.test(code);
    const stripImports = (code: string): string => code.replace(/import\s*(?:type\s*)?\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, "");
    const stripStrings = (c: string) => c.replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``").replace(/'(?:\\.|[^'\\])*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""');
    const callsTransition = (code: string): number => (stripStrings(code).match(/(?:^|[^.\w])transition\s*\(|\.\s*transition\s*\(/g) ?? []).length;
    const autoloopCode = stripComments(readFileSync(resolve(pkgRoot, "po-autoloop.ts"), "utf8"));
    L(`── (F) no-second-mutator scan: does po-autoloop.ts import/call a transition()? ──`);
    L(`  imports transition: ${importsTransition(autoloopCode)} · calls transition(): ${callsTransition(stripImports(autoloopCode))}`);
    L("");
    check("NO-SECOND-MUTATOR: the controller does NOT import a transition value (§15)", importsTransition(autoloopCode) === false);
    check("NO-SECOND-MUTATOR: the controller calls transition() ZERO times (mutation is ONLY via the reconciler)", callsTransition(stripImports(autoloopCode)) === 0);
    check("NO-SECOND-MUTATOR: the controller routes mutation through applyReconcilePlan (the reconciler's sole-mutator door)", /applyReconcilePlan\s*\(/.test(stripImports(autoloopCode)));
  }

  // ── (H) PORT-COMPOSITION (ENFORCE on in-memory ports — replaces admin's --db-self-test) — the full happy path
  //        drives REAL §4.3 transitions through the IN-MEMORY ports to DONE (zero Postgres); C6 owns the boundary. ──
  {
    const contract = createGoalContractOrgan(createInMemoryGoalContractStore());
    const store = createInMemoryRuntimeStores();
    const ctrlEnforce = createGoalLifecycleController({ contract, store });
    const rampExecutor: SprintExecutor = {
      admitToExecuting: async (c) => {
        for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as GoalState[]) await contract.transition(c.goalId, to);
        return { state: "EXECUTING", transitions: ["CREATED→…→EXECUTING"], note: "fixture legal-edge ramp (C2-MIND deferred — test setup)" };
      },
      runSprint: async () => { throw new Error("runSprint DEFERRED"); },
    };
    const submission: GoalSubmission = {
      goal: feasibleGoal("enf-happy"), preflightCtx: feasiblePreflightCtx(),
      createInput: { objective: "reach 100% coverage", acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: BUDGET },
    };
    const ctx: LifecycleContext = { ...happyContext(1.0), executor: rampExecutor, enforce: true, persistProgress: true };
    const r = await ctrlEnforce.runGoalLifecycle(submission, ctx);
    const after = await contract.readContract(r.goalId!);
    check("PORT ENFORCE: ADMITTED + ramped to EXECUTING via legal edges", r.phase === "ADMITTED" && r.statePath.includes("EXECUTING"));
    check("PORT ENFORCE: the durable in-memory contract reached DONE (REAL §4.3 transitions, zero Postgres)", after!.state === "DONE" && r.finalState === "DONE");
    check("PORT ENFORCE: a REAL transition executed (executed:true) by the reconciler (the SOLE mutator)", r.ticks.some((t) => t.execution.executed === true));
    check("PORT ENFORCE: C6 owned the DONE boundary (COMPLETE)", r.ticks.some((t) => t.review?.verdict === "COMPLETE"));
    check("PORT ENFORCE: the durable goal_delta_ledger captured the observed series", (await store.readProgressSeries(r.goalId!)).length > 0);

    // (B1 real) — loop-claims-1.0 / C6-reprobes-0.5 → REAL REVIEWING→PLANNING, NEVER DONE.
    const contract2 = createGoalContractOrgan(createInMemoryGoalContractStore());
    const store2 = createInMemoryRuntimeStores();
    const ctrlB1 = createGoalLifecycleController({ contract: contract2, store: store2 });
    const ramp2: SprintExecutor = {
      admitToExecuting: async (c) => { for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as GoalState[]) await contract2.transition(c.goalId, to); return { state: "EXECUTING", transitions: [], note: "ramp" }; },
      runSprint: async () => { throw new Error("DEFERRED"); },
    };
    const b1Sub: GoalSubmission = { goal: feasibleGoal("enf-b1"), preflightCtx: feasiblePreflightCtx(), createInput: { objective: "x", acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: BUDGET } };
    const rb1 = await ctrlB1.runGoalLifecycle(b1Sub, { ...happyContext(0.5), executor: ramp2, enforce: true, persistProgress: true });
    const afterB1 = await contract2.readContract(rb1.goalId!);
    check("PORT ENFORCE B1: the durable contract NEVER reached DONE (loop cannot self-certify over C6)", afterB1!.state !== "DONE" && !rb1.statePath.includes("DONE"));
    check("PORT ENFORCE B1: C6 INCOMPLETE drove a REAL REVIEWING→PLANNING transition (the C6-gated edge)", afterB1!.state === "PLANNING" && rb1.ticks.some((t) => t.review?.verdict === "INCOMPLETE" && t.execution.applied_edge?.to === "PLANNING" && t.execution.executed === true));
  }

  // ── (H') asControllerHook — the C10 sprint engine plugs into the controller's runSprint hook (slice-4 seam) ──
  {
    const contract = createGoalContractOrgan(createInMemoryGoalContractStore());
    const store = createInMemoryRuntimeStores();
    const engine = createSprintEngine({ store, contract });
    const ctrlHook = createGoalLifecycleController({ contract, store });
    const rampExecutor: SprintExecutor = {
      admitToExecuting: async (c) => { for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as GoalState[]) await contract.transition(c.goalId, to); return { state: "EXECUTING", transitions: [], note: "ramp" }; },
      // THE SEAM: the C10 sprint engine adapted to the controller's runSprint hook. The cap-bounded executor runs
      // between governance ticks; the controller records its note. §15 holds — the engine never mutates state.
      runSprint: asControllerHook(engine, { plannedSteps: 1, spawn: makeStubSpawner({ costCentsPerStep: 50, metricDeltaPerStep: 0.1 }), reprobe: async () => 0.9 }),
    };
    const submission: GoalSubmission = {
      goal: feasibleGoal("hook-goal"), preflightCtx: feasiblePreflightCtx(),
      createInput: { objective: "x", acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: BUDGET },
    };
    const r = await ctrlHook.runGoalLifecycle(submission, { ...happyContext(1.0), executor: rampExecutor, enforce: true, persistProgress: true });
    check("HOOK: asControllerHook plugs the C10 sprint engine into the controller's runSprint hook (the executor RAN)", r.ticks.some((t) => t.executor.startsWith("executor ran: sprint")));
    check("HOOK: the sprint engine recorded durable attempts via the runtime stores port (evidence cycle ran)", (await store.countAttempts(r.goalId!)) > 0);
    check("HOOK: §15 — the lifecycle still reached DONE via the reconciler (the engine never transitioned state)", r.finalState === "DONE");
  }

  // ── tally ──
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\ngovernance-engine C2 PO auto-loop self-test (verbatim lifecycle paths + §15 + C6-gates-DONE + port composition): ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
