// =============================================================================
// The C9 Pre-flight Feasibility Gate (RS-DOS-v1 §7.3 / §36.3 / §57.5).
// =============================================================================
// PLATFORM EXTRACTION SLICE 3 — the port-injected mirror of `rumah-admin/src/preflight-gate-c9.ts`. BEFORE a
// goal is admitted to execution (hour 0) this gate evaluates whether the goal is STATICALLY REACHABLE and
// REFUSES the unreachable — judgment-free, before any effort. It is a PURE EVALUATOR: `evaluatePreflight(goal,
// ctx)` runs five static-feasibility checks and returns { admit, blockers } — it MUTATES NOTHING.
//
// WHAT CHANGED vs admin (and ONLY this): the CONFIG-READINESS plane default. The admin gate's
// `checkCapabilityReadiness` defaulted to `makeIConfigReadiness()` — an `execFileSync` shell-out to a relative
// `infra/i-config.mjs`. THIS module carries NO such default (the residency invariant forbids the package from
// `execFileSync`-ing a relative tool): the injected `ConfigReadinessPort` (`ctx.configReadiness`) is the ONLY
// path the package knows, and when keys are present but no port is injected the check FAILS CLOSED (a
// `capability-not-ready` blocker) — never a silent DB/plane default. The `makeIConfigReadiness()` shell-out
// ships as the consumer adapter. Every five-check VERDICT — MEASURABLE / WELL-FORMED ACCEPTANCE / BUDGET /
// CAPABILITY READINESS / REACHABILITY — is byte-for-byte the verified admin logic; the MetricProbe registry and
// the §36.3 deterministic reachability rule cross injected/package seams (`./metric-probe.js`,
// `./reachability-evaluator.js`), and the goal's BudgetCap is the slice-1 `./ports.js` type.
//
//   → ADMIT iff ALL five pass; else REFUSE with the specific blocker(s).
// =============================================================================

import { defaultProbeRegistry } from "./metric-probe.js";
import type { ProbeRegistry, MetricProbe } from "./metric-probe.js";
import { decideReachability, evaluateReachability } from "./reachability-evaluator.js";
import type { ReachabilityInput, ReachabilityVerdict } from "./reachability-evaluator.js";
import type {
  BudgetCap,
  ConfigReadinessFn,
  KeyReadiness,
} from "./ports.js";

// ── The blocker vocabulary (one code per static-feasibility failure) ─────────────────────────────────
export type BlockerCode =
  | "unmeasurable-metric"
  | "ill-formed-acceptance"
  | "no-budget"
  | "capability-not-ready"
  | "statically-unreachable";

export interface Blocker {
  code: BlockerCode;
  detail: string;
}

export interface CheckResult {
  /** The check name (MEASURABLE | WELL-FORMED ACCEPTANCE | BUDGET | CAPABILITY READINESS | REACHABILITY). */
  check: string;
  /** The now-built piece this check composes (provenance — "which now-built piece each composes"). */
  composes: string;
  pass: boolean;
  detail: string;
  blocker?: Blocker;
}

export interface PreflightVerdict {
  /** ADMIT iff all five checks pass. */
  admit: boolean;
  /** Every failing check's blocker (NOT short-circuited — all blockers are reported for one decision). */
  blockers: Blocker[];
  /** Per-check transparency (pass/fail + provenance), for the SHADOW report. */
  checks: CheckResult[];
  goalId?: string;
  env: string;
}

// ── The acceptance criterion (§4.1 acceptance.{op,target}) ───────────────────────────────────────────
export type AcceptanceOp = ">=" | "<=" | ">" | "<" | "==";
export interface AcceptanceCriterion {
  metric: string;
  op?: AcceptanceOp;
  target?: number;
  direction?: "increase" | "decrease";
}

// ── The goal as the gate sees it ─────────────────────────────────────────────────────────────────────
// A GoalContractRow is structurally assignable to PreflightGoal for the core fields; `acceptance` and
// `requiredConfigKeys` are the C2-MIND-derived augmentation the gate consumes.
export interface PreflightGoal {
  goalId?: string;
  objective: string;
  /** §4.1 acceptance.metric (text) — carried on the built GoalContract. */
  acceptanceMetric: string;
  /** §4.1 acceptance.metric_source — a registered MetricProbe probe_id. */
  metricSourceProbeId: string;
  /** The PINNED probe version (no latest-fallback). */
  metricSourceVersion: number;
  /** §4.1 budget (the H1 cap envelope). */
  budgetCap: BudgetCap;
  /** §4.1 structured acceptance (op + target). Absent/vacuous → ill-formed. */
  acceptance?: AcceptanceCriterion;
  /** §57.3 config_req — the config/secret keys the capabilities this goal needs require. */
  requiredConfigKeys?: string[];
}

// ── Reachability seam (composes ./reachability-evaluator.ts; the LLM stays DEFERRED) ─────────────────
export type ReachabilitySource =
  | { kind: "verdict"; verdict: ReachabilityVerdict | null }
  | { kind: "evaluator"; input: ReachabilityInput; evaluate?: (input: ReachabilityInput) => Promise<ReachabilityVerdict> };

// ── The gate context (the `env` argument) ────────────────────────────────────────────────────────────
export interface PreflightContext {
  /** The target environment the goal would run in (local | dev | QA | staging | prod). */
  targetEnv: string;
  /** Probe registry to resolve metric_source. Default = the process-wide defaultProbeRegistry. */
  probeRegistry?: ProbeRegistry;
  /** Config/secret readiness oracle (the INJECTED `ConfigReadinessPort`). NO package default — when keys are
   *  present but this is absent, CAPABILITY READINESS fails CLOSED (the consumer supplies the I-Config adapter). */
  configReadiness?: ConfigReadinessFn;
  /** Reachability verdict source (the deferred-LLM hook). Default = the DEFERRED evaluator (fail-closed). */
  reachability?: ReachabilitySource;
  /** The confidence floor θ for decideReachability. Default 0.7 (matches the §36.3 stub default). */
  theta?: number;
}

// =============================================================================
// The five static-feasibility checks. Each returns a CheckResult; a failing check carries its blocker.
// =============================================================================

// 1. MEASURABLE — metric_source resolves to a REGISTERED, version-pinned MetricProbe.
function checkMeasurable(goal: PreflightGoal, registry: ProbeRegistry): { result: CheckResult; probe: MetricProbe | null } {
  const composes = "metric-probe.ts (ProbeRegistry, version-pinned resolve)";
  try {
    const probe = registry.resolve(goal.metricSourceProbeId, goal.metricSourceVersion);
    return {
      probe,
      result: {
        check: "MEASURABLE", composes, pass: true,
        detail: `metric_source '${goal.metricSourceProbeId}@${goal.metricSourceVersion}' resolves to a registered ${probe.metric_kind} probe (the acceptance metric is independently observable).`,
      },
    };
  } catch (e) {
    return {
      probe: null,
      result: {
        check: "MEASURABLE", composes, pass: false,
        detail: `metric_source '${goal.metricSourceProbeId}@${goal.metricSourceVersion}' does NOT resolve to a registered, version-pinned MetricProbe — the acceptance metric is unmeasurable, so the goal is unreachable.`,
        blocker: { code: "unmeasurable-metric", detail: (e as Error).message },
      },
    };
  }
}

// 2. WELL-FORMED ACCEPTANCE — the acceptance is a threshold + direction the probe can compare against.
function checkWellFormedAcceptance(goal: PreflightGoal, probe: MetricProbe | null): CheckResult {
  const composes = "goal-contract acceptance + the resolved probe.metric_kind";
  const a = goal.acceptance;
  const fail = (why: string): CheckResult => ({
    check: "WELL-FORMED ACCEPTANCE", composes, pass: false,
    detail: `the acceptance criterion is vacuous: ${why}. A goal with no target the probe can compare against can never be declared reached.`,
    blocker: { code: "ill-formed-acceptance", detail: why },
  });
  if (!goal.acceptanceMetric || goal.acceptanceMetric.trim() === "") return fail("acceptance.metric is blank");
  if (!a) return fail("no structured acceptance {op,target} supplied (only a metric label)");
  const validOps: AcceptanceOp[] = [">=", "<=", ">", "<", "=="];
  if (!a.op || !validOps.includes(a.op)) return fail(`acceptance.op is missing or not one of ${validOps.join(" ")}`);
  if (typeof a.target !== "number" || !Number.isFinite(a.target)) return fail("acceptance.target is missing or not a finite number");
  // A boolean metric must compare with == against 0/1.
  if (probe && probe.metric_kind === "boolean") {
    if (a.op !== "==" || (a.target !== 0 && a.target !== 1)) {
      return fail(`a boolean metric must be compared with '== 0' or '== 1' (got '${a.op} ${a.target}')`);
    }
  }
  // A ratio target outside [0,1] is not a reachable target for a ratio metric.
  if (probe && probe.metric_kind === "ratio" && (a.target < 0 || a.target > 1)) {
    return fail(`a ratio metric target must be within [0,1] (got ${a.target})`);
  }
  return {
    check: "WELL-FORMED ACCEPTANCE", composes, pass: true,
    detail: `acceptance is well-formed: '${a.metric} ${a.op} ${a.target}'${a.direction ? ` (${a.direction})` : ""} — a target the probe can compare against.`,
  };
}

// 3. BUDGET — budget_cap (H1) present + non-zero on at least one axis.
function checkBudget(goal: PreflightGoal): CheckResult {
  const composes = "goal-contract BudgetCap — the H1 cap envelope";
  const b = goal.budgetCap ?? {};
  const axes: Array<[string, unknown]> = [
    ["max_turns", b.max_turns],
    ["max_wallclock_seconds", b.max_wallclock_seconds],
    ["max_cost_cents", b.max_cost_cents],
  ];
  const positive = axes.filter(([, v]) => typeof v === "number" && Number.isFinite(v) && (v as number) > 0);
  if (positive.length === 0) {
    return {
      check: "BUDGET", composes, pass: false,
      detail: "budget_cap has no positive axis — a zero/absent budget can make no progress, so the goal is unreachable.",
      blocker: { code: "no-budget", detail: "budget_cap (H1) is absent or zero on every axis (max_turns / max_wallclock_seconds / max_cost_cents)" },
    };
  }
  return {
    check: "BUDGET", composes, pass: true,
    detail: `budget_cap is non-zero (${positive.map(([k, v]) => `${k}=${v}`).join(", ")}).`,
  };
}

// 4. CAPABILITY READINESS — the config/secrets the goal needs are ready for the target env (I-Config port).
async function checkCapabilityReadiness(goal: PreflightGoal, ctx: PreflightContext): Promise<CheckResult> {
  const composes = "ConfigReadinessPort (I-Config readiness oracle, §57.5 — injected)";
  const keys = goal.requiredConfigKeys ?? [];
  if (keys.length === 0) {
    return { check: "CAPABILITY READINESS", composes, pass: true, detail: "the goal declares no required config/secret keys — no capability-config dependency to satisfy." };
  }
  // EXTRACTION CHANGE (residency): no `makeIConfigReadiness()` execFileSync default. The injected port is the
  // only path; absent it (with keys to check) the gate fails CLOSED — readiness cannot be asserted.
  const readiness = ctx.configReadiness;
  if (!readiness) {
    return {
      check: "CAPABILITY READINESS", composes, pass: false,
      detail: `the goal requires config/secret keys [${keys.join(", ")}] but no ConfigReadinessPort was injected — readiness cannot be asserted for '${ctx.targetEnv}' (fail-closed; the consumer must supply the I-Config adapter).`,
      blocker: { code: "capability-not-ready", detail: `no ConfigReadinessPort injected for '${ctx.targetEnv}' — required keys cannot be confirmed ready` },
    };
  }
  let states: KeyReadiness[];
  try {
    states = await readiness(ctx.targetEnv, keys);
  } catch (e) {
    // The oracle itself could not render a verdict → fail-closed (we cannot assert readiness).
    return {
      check: "CAPABILITY READINESS", composes, pass: false,
      detail: `the I-Config readiness oracle could not render a verdict for [${keys.join(", ")}] in '${ctx.targetEnv}'.`,
      blocker: { code: "capability-not-ready", detail: `readiness oracle error: ${(e as Error).message}` },
    };
  }
  const notReady = states.filter((s) => s.state !== "PRESENT");
  if (notReady.length > 0) {
    const summary = notReady.map((s) => `${s.key}=${s.state}`).join(", ");
    return {
      check: "CAPABILITY READINESS", composes, pass: false,
      detail: `required config/secret for '${ctx.targetEnv}' is not ready (${summary}) — a goal needing an unconfigured capability cannot run.`,
      blocker: { code: "capability-not-ready", detail: `not-ready in '${ctx.targetEnv}': ${summary}` },
    };
  }
  return {
    check: "CAPABILITY READINESS", composes, pass: true,
    detail: `all required config/secret keys are PRESENT for '${ctx.targetEnv}' (${keys.join(", ")}).`,
  };
}

// 5. REACHABILITY RULE — decideReachability over a verdict (the deferred-LLM hook).
async function checkReachability(goal: PreflightGoal, ctx: PreflightContext): Promise<CheckResult> {
  const composes = "reachability-evaluator.ts (decideReachability — the §36.3 deterministic rule)";
  const theta = ctx.theta ?? 0.7;
  const { verdict, note } = await resolveReachabilityVerdict(goal, ctx);
  const decision = decideReachability(verdict, theta);
  if (decision === "ADMIT") {
    return {
      check: "REACHABILITY", composes, pass: true,
      detail: `decideReachability=ADMIT (${note}); reachable=true, confidence ${verdict?.confidence} ≥ θ=${theta}.`,
    };
  }
  // HALT — craft the specific reason for the blocker detail.
  let why: string;
  if (!verdict || typeof verdict.reachable !== "boolean" || typeof verdict.confidence !== "number" || Number.isNaN(verdict.confidence)) {
    why = `no well-formed reachability verdict (${note}) — fail-closed at the primary safety gate (§36.3: never silently admit)`;
  } else if (verdict.reachable === false) {
    why = `the reachability evaluator deemed the goal unreachable (${verdict.evidence || "no evidence"})`;
  } else {
    why = `confidence ${verdict.confidence} < θ=${theta} — fail-closed (low-confidence is not admit)`;
  }
  return {
    check: "REACHABILITY", composes, pass: false,
    detail: `decideReachability=HALT/REFUSE: ${why}.`,
    blocker: { code: "statically-unreachable", detail: why },
  };
}

async function resolveReachabilityVerdict(
  goal: PreflightGoal,
  ctx: PreflightContext,
): Promise<{ verdict: ReachabilityVerdict | null; note: string }> {
  const src: ReachabilitySource =
    ctx.reachability ?? { kind: "evaluator", input: defaultReachabilityInput(goal), evaluate: evaluateReachability };
  if (src.kind === "verdict") {
    return { verdict: src.verdict, note: src.verdict ? "supplied verdict" : "supplied null verdict" };
  }
  const evaluate = src.evaluate ?? evaluateReachability;
  try {
    const verdict = await evaluate(src.input);
    return { verdict, note: "evaluator verdict" };
  } catch (e) {
    // The DEFERRED case (evaluateReachability throws by design) lands here → fail-closed.
    const head = (e as Error).message.split(" — ")[0];
    return { verdict: null, note: `LLM reachability evaluator DEFERRED: ${head}` };
  }
}

/** Build the §36.3 ReachabilityInput from the goal (current/historical values are absent at hour 0). */
export function defaultReachabilityInput(goal: PreflightGoal): ReachabilityInput {
  return {
    metric: { description: goal.acceptanceMetric, probeId: goal.metricSourceProbeId, probeVersion: goal.metricSourceVersion },
    currentValue: null,
    historicalMax: null,
    availableLevers: [],
  };
}

// =============================================================================
// The evaluator — runs all five checks, collects blockers, returns ADMIT iff all pass.
// =============================================================================
export async function evaluatePreflight(goal: PreflightGoal, ctx: PreflightContext): Promise<PreflightVerdict> {
  const registry = ctx.probeRegistry ?? defaultProbeRegistry;

  const measurable = checkMeasurable(goal, registry);
  const wellFormed = checkWellFormedAcceptance(goal, measurable.probe);
  const budget = checkBudget(goal);
  const capability = await checkCapabilityReadiness(goal, ctx);
  const reachability = await checkReachability(goal, ctx);

  const checks = [measurable.result, wellFormed, budget, capability, reachability];
  const blockers = checks.filter((c) => c.blocker).map((c) => c.blocker!);
  return {
    admit: blockers.length === 0,
    blockers,
    checks,
    goalId: goal.goalId,
    env: ctx.targetEnv,
  };
}
