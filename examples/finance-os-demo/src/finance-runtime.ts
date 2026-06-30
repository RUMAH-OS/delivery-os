// =============================================================================
// FINANCE OS — the consumer's governance RUNTIME (composed from the platform alone).
// =============================================================================
// This is the load-bearing seam of the proof: a brand-new consumer obtains the ENTIRE Runtime — Project Owner /
// Goal Intake / pre-flight / Goal Supervisor / reconciler / Sprint Engine / lifecycle controller / founder
// summon — by calling ONE platform function, `createGovernanceRuntime(ports)`, and supplying THIN adapters:
//   * the durable stores  → the platform's shipped IN-MEMORY adapters (zero Postgres),
//   * the founder identity → an injected FounderBindingPort (the consumer's config-registry seam; here a fixture),
//   * the metric registry  → the consumer's OWN finance probes (finance-domain.ts).
// The consumer writes NO Runtime logic. If rumah-admin were deleted, every organ below still exists — it lives
// in the vendored platform, not in admin.
//
// IMPORTS: ONLY the vendored governance-engine (barrel + the shipped in-memory adapter) + this consumer's own
// finance domain. ZERO rumah-admin / property-lead-os imports.

import {
  createGovernanceRuntime,
  type GovernanceRuntime,
  type GoalSubmission,
  type LifecycleContext,
  type SprintExecutor,
  type ObservedTickInput,
  type PreflightGoal,
  type PreflightContext,
  type ReachabilityVerdict,
  type GoalState,
  type FounderBindingPort,
  type CreateGoalContractInput,
} from "../vendor/governance-engine/index.js";
// The shipped in-memory port adapters (the platform's own DB-agnostic existence-proof store).
import {
  createInMemoryGoalContractStore,
  createInMemoryRuntimeStores,
} from "../vendor/governance-engine/scripts/in-memory-store.js";
// The consumer's OWN finance domain.
import {
  financeProbeRegistry,
  FINANCE_BUDGET,
  MRR_ACCEPTANCE,
  MRR_TARGET,
  COLLECTION_ACCEPTANCE,
} from "./finance-domain.js";

/** The finance org's bound founder identity (the consumer's config-registry value; a fixture here). */
export const FINANCE_FOUNDER_ID = "U-FINANCE-FOUNDER";

/** The consumer's FounderBindingPort adapter — fail-closed when unset; here it resolves the finance founder. */
const financeFounderBinding: FounderBindingPort = {
  resolveFounderBinding: () => ({ founderId: FINANCE_FOUNDER_ID, source: "finance-os config-registry (fixture)" }),
};

const REACHABLE: ReachabilityVerdict = { reachable: true, confidence: 0.9, evidence: "finance metric is computable from the live ledger" };
const ALL_CONFIG_PRESENT = async () => []; // the finance org's I-Config oracle reports every required key PRESENT.

/**
 * Compose the finance governance runtime from the platform alone. The consumer supplies the in-memory store
 * adapters + its own probe registry + its founder binding; it receives the full Runtime (`createGovernanceRuntime`
 * wires every organ + the controller).
 */
export function createFinanceRuntime(): GovernanceRuntime {
  return createGovernanceRuntime({
    goalContractStore: createInMemoryGoalContractStore(),
    runtimeStores: createInMemoryRuntimeStores(),
    founderBinding: financeFounderBinding,
    probeRegistry: financeProbeRegistry(),
  });
}

// ── The admission ramp (CREATED→…→EXECUTING) — drives the legal §4.3 edges through the runtime's contract organ
//    (the C2-MIND planner is deferred in the platform; a consumer pre-drives the ramp via the legal edges). ──
export function rampExecutor(runtime: GovernanceRuntime): SprintExecutor {
  return {
    admitToExecuting: async (c) => {
      for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as GoalState[]) {
        await runtime.contract.transition(c.goalId, to);
      }
      return { state: "EXECUTING", transitions: ["CREATED→FEASIBILITY→ACTIVE→PLANNING→EXECUTING"], note: "finance admission ramp" };
    },
    runSprint: async () => { throw new Error("runSprint DEFERRED (the C10 sprint engine) — governance ticks over the injected observed-state"); },
  };
}

// ── observed-state trajectory helper (the GS's external re-read each tick; the deferred executor would produce
//    it from real probe reads — here it is the consumer's scripted finance trajectory). ──
function trajectory(points: Array<{ value: number | null; attempts: number; cost: number }>, startCycle: number) {
  return async (_g: string, i: number): Promise<ObservedTickInput> => {
    const p = points[Math.min(i, points.length - 1)]!;
    return { cycle: startCycle + i, metricValue: p.value, attempts: p.attempts, cumulativeCostCents: p.cost };
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// GOAL 1 — "Grow MRR to >= €50,000" → runs to DONE (C6 independently confirms COMPLETE).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function mrrSubmission(goalId: string): GoalSubmission {
  const goal: PreflightGoal = {
    goalId,
    objective: "Grow active monthly recurring revenue to at least €50,000",
    acceptanceMetric: "monthly_recurring_revenue_eur",
    metricSourceProbeId: "monthly-recurring-revenue",
    metricSourceVersion: 1,
    budgetCap: FINANCE_BUDGET,
    acceptance: { metric: "monthly_recurring_revenue_eur", op: ">=", target: MRR_TARGET, direction: "increase" },
    requiredConfigKeys: [],
  };
  const preflightCtx: PreflightContext = {
    targetEnv: "finance-prod",
    probeRegistry: financeProbeRegistry(),
    configReadiness: ALL_CONFIG_PRESENT,
    reachability: { kind: "verdict", verdict: REACHABLE },
  };
  const createInput: CreateGoalContractInput = {
    goalId,
    objective: goal.objective,
    acceptanceMetric: goal.acceptanceMetric,
    metricSourceProbeId: goal.metricSourceProbeId,
    metricSourceVersion: goal.metricSourceVersion,
    dataClass: "CONFIDENTIAL",
    budgetCap: FINANCE_BUDGET,
  };
  return { goal, preflightCtx, createInput };
}

export function mrrLifecycleCtx(runtime: GovernanceRuntime): LifecycleContext {
  return {
    acceptance: MRR_ACCEPTANCE,
    budgetCap: FINANCE_BUDGET,
    // prior history: MRR rising 20k → 45k (the GS sees genuine movement → CONTINUE).
    seedProgress: [
      { cycle: 0, value: 20_000 },
      { cycle: 1, value: 30_000 },
      { cycle: 2, value: 40_000 },
      { cycle: 3, value: 45_000 },
    ],
    // the goal reaches the €50,000 target; effort well within budget.
    observe: trajectory([{ value: 50_000, attempts: 70, cost: 7_000 }, { value: 50_000, attempts: 72, cost: 7_200 }], 4),
    // C6's INDEPENDENT re-probe confirms €50,000 → COMPLETE → DONE (the loop cannot self-certify).
    review: { acceptance: MRR_ACCEPTANCE, reprobe: async () => ({ value: MRR_TARGET, note: "independent finance re-probe (MRR = €50,000)" }) },
    executor: rampExecutor(runtime),
    enforce: true,
    persistProgress: true,
    maxTicks: 6,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// GOAL 2 — "Collect 100% of issued invoices" → STALLS → HALTED + founder summon (effort-without-progress).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function collectionSubmission(goalId: string): GoalSubmission {
  const goal: PreflightGoal = {
    goalId,
    objective: "Collect 100% of issued invoices (paid ratio reaches 1.0)",
    acceptanceMetric: "invoices_collected_ratio",
    metricSourceProbeId: "invoices-collected-ratio",
    metricSourceVersion: 1,
    budgetCap: FINANCE_BUDGET,
    acceptance: { metric: "invoices_collected_ratio", op: ">=", target: 1.0, direction: "increase" },
    requiredConfigKeys: [],
  };
  const preflightCtx: PreflightContext = {
    targetEnv: "finance-prod",
    probeRegistry: financeProbeRegistry(),
    configReadiness: ALL_CONFIG_PRESENT,
    reachability: { kind: "verdict", verdict: REACHABLE },
  };
  const createInput: CreateGoalContractInput = {
    goalId,
    objective: goal.objective,
    acceptanceMetric: goal.acceptanceMetric,
    metricSourceProbeId: goal.metricSourceProbeId,
    metricSourceVersion: goal.metricSourceVersion,
    dataClass: "CONFIDENTIAL",
    budgetCap: FINANCE_BUDGET,
  };
  return { goal, preflightCtx, createInput };
}

export function collectionLifecycleCtx(runtime: GovernanceRuntime): LifecycleContext {
  return {
    acceptance: COLLECTION_ACCEPTANCE,
    budgetCap: FINANCE_BUDGET,
    // prior history: the paid ratio is STUCK at 0.40 (no movement) across the window.
    seedProgress: [
      { cycle: 0, value: 0.40 },
      { cycle: 1, value: 0.40 },
      { cycle: 2, value: 0.40 },
      { cycle: 3, value: 0.40 },
    ],
    // the metric stays flat at 0.40 while effort is spent well past the grace floor (90 attempts, €90 cost).
    observe: trajectory([{ value: 0.40, attempts: 90, cost: 9_000 }], 4),
    review: { acceptance: COLLECTION_ACCEPTANCE, reprobe: async () => ({ value: 0.40, note: "independent finance re-probe (still 40% collected)" }) },
    executor: rampExecutor(runtime),
    enforce: true,
    persistProgress: true,
    maxTicks: 6,
  };
}
