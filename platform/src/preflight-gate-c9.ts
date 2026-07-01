// =============================================================================
// The C9 Pre-flight Feasibility Gate (RS-DOS-v1 §7.3 / §36.3 / §57.5). Sprint 3.1, first slice.
// =============================================================================
// THE PRIMARY incident fix. BEFORE a goal is admitted to execution (hour 0), this gate evaluates
// whether the goal is STATICALLY REACHABLE and REFUSES the unreachable — judgment-free, before any
// effort. It is the operational answer to the Operating-Model-v2 finding: liveness ≠ progress; an
// unreachable goal must be refused at hour 0, not run forever (the Discovery incident class).
//
// THIS IS A PURE EVALUATOR. `evaluatePreflight(goal, ctx)` runs five STATIC-FEASIBILITY checks and
// returns { admit, blockers } — it MUTATES NOTHING, contacts no live goal, and refuses nothing on its
// own (the SHADOW vs enforce posture lives in the CLI). Each check COMPOSES a now-built piece; nothing
// here is re-implemented:
//
//   1. MEASURABLE            — metric_source resolves to a REGISTERED, version-pinned MetricProbe
//                              (composes src/metric-probe.ts ProbeRegistry). Blocker `unmeasurable-metric`.
//   2. WELL-FORMED ACCEPTANCE— the acceptance criterion is a target the probe can compare against (a
//                              threshold + direction), not vacuous.        Blocker `ill-formed-acceptance`.
//   3. BUDGET                — budget_cap (H1) is present + non-zero on at least one axis (composes the
//                              GoalContract BudgetCap, src/goal-contract.ts). Blocker `no-budget`.
//   4. CAPABILITY READINESS  — the config/secrets the goal needs report ready for the target env via the
//                              I-Config oracle (composes infra/i-config.mjs, §57.5). Blocker `capability-not-ready`.
//   5. REACHABILITY RULE     — decideReachability (the §36.3 DETERMINISTIC fail-closed rule, composes
//                              src/reachability-evaluator.ts) over a verdict. The LLM-backed
//                              evaluateReachability stays DEFERRED — the hook is wired so a later slice
//                              slots it in; this slice's default is fail-closed (a deferred/absent verdict
//                              → REFUSE, never silent admit, per §36.3). Blocker `statically-unreachable`.
//
//   → ADMIT iff ALL five pass; else REFUSE with the specific blocker(s).
//
// What this slice is NOT: the Goal Supervisor C7 (Sprint 3.2 — the IN-flight no-progress watch; this is
// the hour-0 PRE-flight); the goal-submission surface (Sprint 5.3); the LLM §36.3 evaluator (DEFERRED).
// =============================================================================

import { defaultProbeRegistry } from "./metric-probe.js";
import type { ProbeRegistry, MetricProbe } from "./metric-probe.js";
import { decideReachability, evaluateReachability } from "./reachability-evaluator.js";
import type { ReachabilityInput, ReachabilityVerdict } from "./reachability-evaluator.js";
import type { BudgetCap } from "./goal-contract.js";

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
// The GoalContract's thin built layer (src/goal-contract.ts) stores only `acceptanceMetric` (text) +
// the probe ref. The structured op/target the §4.1 schema carries (and that C2-MIND derives at draft
// time) is supplied to the gate here — the gate REUSES the contract and layers its feasibility view
// without re-implementing the contract.
export type AcceptanceOp = ">=" | "<=" | ">" | "<" | "==";
export interface AcceptanceCriterion {
  metric: string;
  op?: AcceptanceOp;
  target?: number;
  direction?: "increase" | "decrease";
}

// ── The goal as the gate sees it ─────────────────────────────────────────────────────────────────────
// A GoalContractRow (src/goal-contract.ts) is structurally assignable to PreflightGoal for the core
// fields; `acceptance` and `requiredConfigKeys` are the C2-MIND-derived augmentation the gate consumes.
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

// ── I-Config readiness seam (composes infra/i-config.mjs) ────────────────────────────────────────────
export type ReadinessState =
  | "PRESENT" | "MISSING" | "INVALID" | "DRIFTED" | "OPTIONAL-ABSENT" | "UNDECLARED";
export interface KeyReadiness {
  key: string;
  state: ReadinessState;
  detail?: string;
}
/** Resolve the readiness verdict for a set of keys in an env. Default = the real I-Config oracle
 *  (makeIConfigReadiness); tests/self-test may inject a deterministic fake. */
export type ConfigReadinessFn = (env: string, keys: string[]) => Promise<KeyReadiness[]>;

// ── Reachability seam (composes src/reachability-evaluator.ts; the LLM stays DEFERRED) ───────────────
// THE DEFERRED-LLM HOOK. The gate decides reachability via the DETERMINISTIC decideReachability rule
// over a verdict. Where the verdict comes from is pluggable:
//   - { kind: "verdict", verdict }      → a pre-computed verdict (a later slice's LLM output, or a test).
//   - { kind: "evaluator", input, evaluate } → an async evaluator producing the verdict. DEFAULT
//        evaluate = evaluateReachability, which is DEFERRED (throws by design) → caught → verdict=null
//        → decideReachability(null) = HALT (fail-closed). So with no LLM wired, the gate fails CLOSED on
//        reachability (§36.3: "malformed | low-confidence → fail-closed → never silently admit"). When
//        the LLM evaluator is built, pass it as `evaluate` and it slots in with ZERO gate changes.
export type ReachabilitySource =
  | { kind: "verdict"; verdict: ReachabilityVerdict | null }
  | { kind: "evaluator"; input: ReachabilityInput; evaluate?: (input: ReachabilityInput) => Promise<ReachabilityVerdict> };

// ── The gate context (the `env` argument) ────────────────────────────────────────────────────────────
export interface PreflightContext {
  /** The target environment the goal would run in (local | dev | QA | staging | prod). */
  targetEnv: string;
  /** Probe registry to resolve metric_source. Default = the process-wide defaultProbeRegistry. */
  probeRegistry?: ProbeRegistry;
  /** Config/secret readiness oracle. Default = the real I-Config oracle (infra/i-config.mjs). */
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
  const composes = "src/metric-probe.ts (ProbeRegistry, version-pinned resolve)";
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
  const composes = "src/goal-contract.ts (acceptance) + the resolved probe.metric_kind";
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
  const composes = "src/goal-contract.ts (BudgetCap — the H1 cap envelope)";
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

// 4. CAPABILITY READINESS — the config/secrets the goal needs are ready for the target env (I-Config).
async function checkCapabilityReadiness(goal: PreflightGoal, ctx: PreflightContext): Promise<CheckResult> {
  const composes = "infra/i-config.mjs (I-Config readiness oracle, §57.5)";
  const keys = goal.requiredConfigKeys ?? [];
  if (keys.length === 0) {
    return { check: "CAPABILITY READINESS", composes, pass: true, detail: "the goal declares no required config/secret keys — no capability-config dependency to satisfy." };
  }
  const readiness = ctx.configReadiness ?? makeIConfigReadiness();
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
  const composes = "src/reachability-evaluator.ts (decideReachability — the §36.3 deterministic rule)";
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

// =============================================================================
// The default I-Config readiness seam — really shells out to infra/i-config.mjs (the now-built oracle).
// Provider-agnostic: the gate depends only on the PRESENT/MISSING/INVALID/DRIFTED verdict, never on how
// I-Config computes it (§57.7). Inert without a registry/env — a missing oracle surfaces honestly.
// =============================================================================
export interface IConfigReadinessOptions {
  /** Repo root that holds infra/i-config.mjs + the registry. Default = resolved from this module. */
  rootDir?: string;
  /** Registry path (default infra/config-secret-registry.json under rootDir). */
  registryPath?: string;
  /** Consult the local plane (needed to read dev/local values). Default true. */
  includeLocal?: boolean;
}

export function makeIConfigReadiness(opts: IConfigReadinessOptions = {}): ConfigReadinessFn {
  return async (env: string, keys: string[]): Promise<KeyReadiness[]> => {
    // Lazy imports so the pure evaluator carries no Node-runtime dependency unless the default is used.
    const { execFileSync } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const root = opts.rootDir ?? resolve(here, ".."); // src/ -> repo root
    const oracle = resolve(root, "infra/i-config.mjs");
    const registry = opts.registryPath ?? resolve(root, "infra/config-secret-registry.json");
    const args = ["--json", "--env", env, "--registry", registry];
    if (opts.includeLocal !== false) args.push("--include-local");
    const out = execFileSync(process.execPath, [oracle, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const report = JSON.parse(out) as { keys: Array<{ key: string; state: ReadinessState; detail?: string }> };
    const byKey = new Map(report.keys.map((k) => [k.key, k]));
    return keys.map((key): KeyReadiness => {
      const hit = byKey.get(key);
      if (!hit) return { key, state: "UNDECLARED", detail: "not declared in the config/secret registry — readiness cannot be confirmed." };
      return { key, state: hit.state, detail: hit.detail };
    });
  };
}
