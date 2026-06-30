// Governance Engine — `createGovernanceRuntime` END-TO-END smoke (the package's PUBLIC vendoring surface), run on
// the IN-MEMORY ports (zero Postgres). The governance analogue of the workflow engine's createCapabilityRuntime
// smoke: it proves that a consumer who supplies ONLY the port adapters gets a ready, runnable governance runtime.
//
// THE PROOF THIS FILE EXISTS TO MAKE:
//   (1) createGovernanceRuntime({goalContractStore, runtimeStores, founderBinding}) wires EVERY organ + the
//       controller from the injected ports alone (no DB, no hand-wiring).
//   (2) a FULL goal lifecycle through the FACTORY's runGoalLifecycle reaches DONE in ENFORCE on the in-memory
//       ports — REAL §4.3 transitions, C6 gating DONE, zero Postgres.
//   (3) the C1 SUBMIT front door (runtime.submitGoal) admits a founder goal → DONE and is identity-bound (a
//       non-founder is rejected; the binding is resolved from the injected FounderBindingPort, fail-closed).
//   (4) the C1 APPROVE front door (runtime.approveFap) resumes a HALTED contract through the reconciler's
//       sole-mutator door (§15) — port-bound, no DB default.
//
// Run:  tsx governance-runtime-self-test.ts   ·   exit 0 = the factory composes + runs end-to-end · 1 = a failure.

import { createGovernanceRuntime } from "../runtime.js";
import type { GoalSubmission, LifecycleContext, SprintExecutor, ObservedTickInput } from "../po-autoloop.js";
import { ProbeRegistry, type MetricProbe } from "../metric-probe.js";
import type { PreflightGoal, PreflightContext } from "../preflight.js";
import type { ReachabilityVerdict } from "../reachability-evaluator.js";
import type { AcceptanceShape } from "../goal-supervisor.js";
import type { FounderBindingPort, GoalState, GoalContractRow } from "../ports.js";
import type { RawGoalSubmission, VerifiedIdentity, IntakeLifecycleSeams, OpenFap } from "../goal-intake.js";
import { inMemoryFapStore } from "../goal-intake.js";
import { createInMemoryGoalContractStore, createInMemoryRuntimeStores } from "./in-memory-store.js";

const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });
const L = (s = "") => process.stdout.write(s + "\n");

const FOUNDER_ID = "U-FOUNDER-RUMAH";
const ACCEPTANCE: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };
const BUDGET = { max_turns: 100, max_cost_cents: 10000 };
const REACHABLE: ReachabilityVerdict = { reachable: true, confidence: 0.95, evidence: "reachable" };
const ALL_CONFIG_PRESENT = async () => [];

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
function feasibleGoal(goalId: string): PreflightGoal {
  return {
    goalId, objective: "reach 100% invoice delivery coverage", acceptanceMetric: "delivered_invoice_ratio",
    metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, budgetCap: BUDGET, acceptance: { metric: "delivered_invoice_ratio", op: ">=", target: 1.0, direction: "increase" }, requiredConfigKeys: [],
  };
}
function preflightCtx(): PreflightContext {
  return { targetEnv: "test", probeRegistry: probeRegistry(), configReadiness: ALL_CONFIG_PRESENT, reachability: { kind: "verdict", verdict: REACHABLE } };
}
function trajectory(points: Array<{ value: number | null; attempts: number; cost: number }>, startCycle: number) {
  return async (_g: string, i: number): Promise<ObservedTickInput> => {
    const p = points[Math.min(i, points.length - 1)]!;
    return { cycle: startCycle + i, metricValue: p.value, attempts: p.attempts, cumulativeCostCents: p.cost };
  };
}
function happySeams(reprobe = 1.0): IntakeLifecycleSeams {
  return {
    seedProgress: [{ cycle: 0, value: 0.3 }, { cycle: 1, value: 0.5 }, { cycle: 2, value: 0.7 }, { cycle: 3, value: 0.9 }],
    observe: trajectory([{ value: 1.0, attempts: 60, cost: 6000 }, { value: 1.0, attempts: 62, cost: 6200 }], 4),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: reprobe, note: "independent re-probe (fixture)" }) },
    maxTicks: 6,
  };
}
function founderIdentity(): VerifiedIdentity {
  return { subjectId: FOUNDER_ID, verified: true, method: "request-signature (fixture)" };
}
function nonFounderIdentity(): VerifiedIdentity {
  return { subjectId: "U-STAFFER", verified: true, method: "request-signature (fixture)" };
}
function wellFormedSubmission(goalId: string): RawGoalSubmission {
  return {
    goalId, objective: "reach 100% invoice delivery coverage",
    acceptance: { probeId: "invoice-delivery-coverage", probeVersion: 1, op: ">=", target: 1.0, direction: "increase", metric: "delivered_invoice_ratio" },
    budget: { ...BUDGET }, requiredConfigKeys: [],
  };
}
function haltedFixtureContract(goalId: string): GoalContractRow {
  const now = new Date();
  return {
    goalId, objective: "x", acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage",
    metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: { ...BUDGET }, goalDeltaLedgerRef: goalId,
    state: "HALTED", prevState: "REVIEWING", createdAt: now, updatedAt: now,
  };
}

// the injected FounderBindingPort — the consumer's config-registry seam (here a fixture). Fail-closed when null.
const founderBindingPort: FounderBindingPort = {
  resolveFounderBinding: () => ({ founderId: FOUNDER_ID, source: "fixture FounderBindingPort" }),
};

async function main() {
  L("governance-engine createGovernanceRuntime END-TO-END smoke — the FACTORY on the in-memory ports (zero Postgres)\n");

  // ── (1) the FACTORY wires every organ + the controller from the injected ports alone ──
  const runtime = createGovernanceRuntime({
    goalContractStore: createInMemoryGoalContractStore(),
    runtimeStores: createInMemoryRuntimeStores(),
    founderBinding: founderBindingPort,
    probeRegistry: probeRegistry(),
  });
  check("FACTORY: createGovernanceRuntime composed the contract organ + reconciler + supervisor + sprint engine + controller",
    !!runtime.contract && !!runtime.reconciler && !!runtime.supervisor && !!runtime.sprintEngine && !!runtime.controller && typeof runtime.runGoalLifecycle === "function");
  check("FACTORY: the founder binding resolves from the injected FounderBindingPort", (await runtime.resolveFounderBinding()).founderId === FOUNDER_ID);

  // a ramp executor (fixture setup) — drives CREATED→…→EXECUTING via the runtime's contract organ (the C2-MIND
  // planner is deferred). The runtime composes the reconciler; the ramp uses the contract organ's legal edges.
  const rampExecutor: SprintExecutor = {
    admitToExecuting: async (c) => { for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as GoalState[]) await runtime.contract.transition(c.goalId, to); return { state: "EXECUTING", transitions: ["CREATED→…→EXECUTING"], note: "fixture ramp" }; },
    runSprint: async () => { throw new Error("runSprint DEFERRED"); },
  };

  // ── (2) a FULL goal lifecycle through the FACTORY's runGoalLifecycle → DONE in ENFORCE (REAL §4.3, zero PG) ──
  {
    const submission: GoalSubmission = {
      goal: feasibleGoal("factory-happy"), preflightCtx: preflightCtx(),
      createInput: { objective: "reach 100% coverage", acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: BUDGET },
    };
    const ctx: LifecycleContext = { ...happySeams(1.0), acceptance: ACCEPTANCE, budgetCap: BUDGET, executor: rampExecutor, enforce: true, persistProgress: true };
    const r = await runtime.runGoalLifecycle(submission, ctx);
    const after = await runtime.contract.readContract(r.goalId!);
    check("FACTORY E2E: a full goal lifecycle through the factory reaches DONE (REAL §4.3 transitions, zero Postgres)", r.finalState === "DONE" && after!.state === "DONE");
    check("FACTORY E2E: C6 gated the DONE boundary (COMPLETE) — the loop did not self-certify", r.ticks.some((t) => t.review?.verdict === "COMPLETE"));
    check("FACTORY E2E: a REAL transition executed via the reconciler (the SOLE mutator)", r.ticks.some((t) => t.execution.executed === true));
    check("FACTORY E2E: the durable runtime stores captured the observed series", (await runtime.store.readProgressSeries(r.goalId!)).length > 0);
  }

  // ── (3) the C1 SUBMIT front door — a founder goal is admitted → DONE; a non-founder is identity-rejected ──
  {
    const ctx = { targetEnv: "test", probeRegistry: probeRegistry(), configReadiness: ALL_CONFIG_PRESENT, reachability: { kind: "verdict" as const, verdict: REACHABLE }, lifecycle: { ...happySeams(1.0), executor: rampExecutor }, enforce: true };
    const founderRun = await runtime.submitGoal(wellFormedSubmission("front-door-happy"), founderIdentity(), ctx);
    check("FRONT DOOR SUBMIT: a founder submission is ADMITTED and reaches DONE through the factory (binding from the port)", founderRun.accepted === true && founderRun.lifecycle?.finalState === "DONE");
    const staffer = await runtime.submitGoal(wellFormedSubmission("front-door-nf"), nonFounderIdentity(), ctx);
    check("FRONT DOOR SUBMIT: a NON-founder is rejected (identity-bound via the FounderBindingPort), NO lifecycle ran", staffer.accepted === false && staffer.parse.rejections.some((x) => x.code === "identity-not-founder") && staffer.lifecycle === null);
  }

  // ── (4) the C1 APPROVE front door — a HALTED contract is resumed through the reconciler's sole-mutator door ──
  {
    const open: OpenFap = { fapId: "FAP-factory", goalId: "g-halted-factory", boundaryClass: "feasibility/strategy", source: "goal-supervisor-c7", status: "open" };
    const approve = await runtime.approveFap(
      { fapId: "FAP-factory", goalId: "g-halted-factory", decision: "MODIFY" },
      founderIdentity(),
      { fapStore: inMemoryFapStore([open]), readContract: async () => haltedFixtureContract("g-halted-factory") },
    );
    check("FRONT DOOR APPROVE: a founder MODIFY resumes HALTED→PLANNING through the factory's reconciler door (§15)", approve.ok === true && approve.resume?.edge.to === "PLANNING");
    const nf = await runtime.approveFap(
      { fapId: "FAP-factory2", goalId: "g-halted-factory", decision: "MODIFY" },
      nonFounderIdentity(),
      { fapStore: inMemoryFapStore([{ ...open, fapId: "FAP-factory2" }]), readContract: async () => haltedFixtureContract("g-halted-factory") },
    );
    check("FRONT DOOR APPROVE: a NON-founder approval is rejected (identity-not-founder), NO resume", nf.ok === false && nf.rejection?.code === "identity-not-founder");
  }

  // ── tally ──
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\ngovernance-engine createGovernanceRuntime end-to-end smoke (factory composition + full lifecycle + the C1 front door): ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
