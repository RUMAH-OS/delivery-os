// =============================================================================
// The Goal Supervisor (C7) — the EXTERNAL progress watchdog (RS-DOS-v1 §7.2 / §7.5 tier 2b / F6).
// Sprint 3.2, first slice.
// =============================================================================
// THE liveness≠progress organ the Operating-Model-v2 research named as the framework's missing piece.
// C9 (Sprint 3.1) is the hour-0 PRE-flight gate (is the goal reachable BEFORE any effort?). C7 is the
// IN-flight watch: a goal can be ALIVE (the loop ticks, the dead-man's-switch is green) yet make NO
// PROGRESS toward its acceptance metric. The Discovery incident agent was alive throughout — nobody
// was watching the GOAL DELTA. The GS is that watcher: it re-probes the metric EXTERNALLY (its own
// identity, never the loop's self-report), reads the goal-delta ledger + the effort ledgers, computes
// dGoal vs dEffort, and on effort-without-progress it TRIPS → HALT + a founder FAP.
//
// ── What is EXTERNAL by construction (the load-bearing safety property, §7.2) ──
//   The GS does NOT trust the value the PO/worker wrote. It RE-READS the acceptance metric from its
//   canonical source under its OWN least-privilege identity (the MetricProbe substrate, src/metric-probe.ts).
//   A stuck loop therefore cannot SUPPRESS the supervisor by reporting a fake "we're progressing" value:
//   the GS's dGoal is computed from ITS OWN reading, not the loop's. It runs as the RESERVED C7 scheduler
//   tier (infra/scheduler-tiers.json, gha-cron) — a SEPARATE job from the PO reconciler (2a), so the
//   driver never grades its own progress.
//
// ── Composition (every trip-rule input reuses a now-built piece; nothing re-implemented) ──
//   dGoal   ← goal_delta_ledger ProgressSeries (runtime-stores.readProgressSeries, migration 0052)
//             RECONCILED AGAINST an external MetricProbe re-read (src/metric-probe.ts invokeProbe).
//   dEffort ← attempt_ledger count (runtime-stores.countAttempts) + portfolio_cost_ledger cumulative
//             (runtime-stores.readCumulativeCost), relative to the GoalContract budget_cap
//             (src/goal-contract.ts BudgetCap — the H1 envelope).
//   HALT    ← the GoalContract §4.3 LEGAL edge to HALTED (src/goal-contract.ts) — DRAFTED in SHADOW.
//   FAP     ← the §3.1 feasibility/strategy summon envelope (the flat goal-delta made visible).
//
// ── SHADOW posture (this slice) ──
//   evaluateGoalSupervision is a PURE function: it MUTATES NOTHING and HALTS NOTHING. It returns a
//   verdict (CONTINUE | HALT_AND_SUMMON). The HALT + FAP are DRAFTED (executed:false) and emitted to a
//   founder-audit sink — no live goal is transitioned, no real channel is paged (draft-don't-send, like
//   the C8 dead-man's-switch). The enforce-flip that actually HALTs a LIVE goal is a FOUNDER ★ decision
//   + the live goal-submission flow (Sprint 5.3); there is no live goal flow yet, so nothing live exists
//   to halt. OUT OF SCOPE: the C2-LOOP reconciler that DRIVES progress (Sprint 3.3 — this DETECTS its
//   absence); the LLM reachability re-derivation; the real FAP paging channel (seam only).
// =============================================================================

import type { BudgetCap, GoalState } from "./goal-contract.js";
import { appendProgressSample, readProgressSeries, countAttempts, readCumulativeCost } from "./runtime-stores.js";

// ── Verdict + types ──────────────────────────────────────────────────────────────────────────────────
export type GoalVerdict = "CONTINUE" | "HALT_AND_SUMMON";

/** One sample from the goal_delta_ledger (the GS's dGoal input — runtime-stores.readProgressSeries). */
export interface ProgressPoint {
  cycle: number;
  value: number | null;
  predicted?: number | null;
  fixRef?: string | null;
}

/** The GS's OWN fresh re-read of the acceptance metric (independent of the loop's self-report, §7.2 step 1). */
export interface ExternalReprobe {
  /** true = the independent re-read succeeded; false = the canonical source was unreadable. */
  ok: boolean;
  /** the GS's typed reading of the acceptance metric (null when the probe yielded no value). */
  value: number | null;
  cycle?: number;
  probeId?: string;
  version?: number;
  note?: string;
}

/** dEffort inputs: attempts + cost consumed vs the H1 budget_cap (attempt_ledger + portfolio_cost_ledger). */
export interface EffortFacts {
  attempts: number;
  cumulativeCostCents: number;
  budgetCap: BudgetCap;
  wallclockSeconds?: number;
}

/** The effort floors. Effort is "significant" (judgeable) when ANY axis is past its floor (OR, never AND),
 *  so one under-used axis cannot veto another's runaway and an absent budget_cap cannot exempt a goal:
 *    minEffortFraction — RELATIVE budget-fraction floor (used only when budget_cap has an axis).
 *    minAttempts       — ABSOLUTE attempt floor (a backstop independent of any budget).
 *    minCostCents      — ABSOLUTE cost backstop (the fail-closed floor when there is no relative budget).
 *  minCycles is NOT an effort floor — it only labels a confident "flat over N cycles" trend vs an
 *  "under-instrumented, too few samples" summon. */
export interface GraceFloor {
  minCycles: number;
  minAttempts: number;
  minEffortFraction: number;
  minCostCents: number;
}

export interface AcceptanceShape {
  op?: ">=" | "<=" | ">" | "<" | "==";
  target?: number;
  direction?: "increase" | "decrease";
}

/** The complete fact-base the pure evaluator reasons over (assembled by runGoalSupervision from the ledgers
 *  + the external re-probe). Passing facts explicitly keeps the trip rule deterministic + unit-testable. */
export interface GoalSupervisionFacts {
  goalId: string;
  /** how many recent cycles define the dGoal window. */
  window: number;
  /** the dGoal≈0 tolerance (movement within ±ε counts as "no movement"). */
  epsilon: number;
  graceFloor: GraceFloor;
  /** cycle-ordered ledger series (may be empty / unreadable). */
  progressSeries: ProgressPoint[];
  /** the GS's fresh independent re-read (null/ok:false when the canonical source could not be read). */
  externalReprobe: ExternalReprobe | null;
  effort: EffortFacts;
  acceptance?: AcceptanceShape;
  contractState?: GoalState;
  /** readability flags driving the fail-closed lean (cannot confirm progress ⇒ summon, never silent CONTINUE). */
  readable: { progress: boolean; effort: boolean };
}

export interface EffortBreakdown {
  /** the MAX consumed-fraction across the present budget axes (the binding H1 pressure). */
  fraction: number;
  byAxis: Record<string, { consumed: number; cap: number; fraction: number }>;
  attempts: number;
  cumulativeCostCents: number;
}

export interface LoopFingerprint {
  repeated: boolean;
  fixRef: string | null;
  count: number;
}

export interface GoalSupervisionVerdict {
  goalId: string;
  /** trip === (verdict === "HALT_AND_SUMMON"). */
  trip: boolean;
  verdict: GoalVerdict;
  reason: string;
  /** the acceptance-metric movement over the window (null when uncomputable — itself a fail-closed signal). */
  dGoal: number | null;
  dEffort: EffortBreakdown;
  details: {
    startValue: number | null;
    currentValue: number | null;
    currentSource: string;
    observedCycles: number;
    /** effortPastGrace — enough budget/attempts spent to judge at all (NOT just-started). */
    pastGrace: boolean;
    /** the goal is CONFIRMED advancing (readable + re-probed + dGoal>ε toward target) — the only CONTINUE-while-spent path. */
    progressConfirmed: boolean;
    /** every effort input is readable + finite + non-negative (else fail-closed). */
    effortSound: boolean;
    /** progress is readable + re-probed + finite (else fail-closed). */
    progressSound: boolean;
    dataUnreadable: boolean;
    fingerprint: LoopFingerprint;
    /** the EFFECTIVE ε used (clamped to SAFE_EPSILON when the config ε was ≤0 or non-finite). */
    epsilon: number;
    /** true = the config ε was invalid (≤0 / non-finite) and was clamped. */
    epsilonClamped: boolean;
    graceFloor: GraceFloor;
  };
}

// ── small format helpers (used in the human-legible reasons) ───────────────────────────────────────────
const pct = (f: number) => `${(f * 100).toFixed(1)}%`;
const fmt = (n: number | null) => (n == null ? "n/a" : Number.isInteger(n) ? String(n) : n.toFixed(4));

// The minimum valid tolerance: ε MUST be a finite POSITIVE number. An ε ≤ 0 or non-finite is invalid config
// (it disarms the stall detector — ε=0 is the exact stuck value for integer/boolean metrics) and is clamped
// to this safe default before any comparison, so the strict comparators always have a positive threshold.
const SAFE_EPSILON = 1e-6;

// ── dEffort: consumed vs the H1 budget_cap (composes the GoalContract BudgetCap) ───────────────────────
export function computeEffort(e: EffortFacts): EffortBreakdown {
  const byAxis: Record<string, { consumed: number; cap: number; fraction: number }> = {};
  const b = e.budgetCap ?? {};
  if (typeof b.max_turns === "number" && b.max_turns > 0) {
    byAxis.turns = { consumed: e.attempts, cap: b.max_turns, fraction: e.attempts / b.max_turns };
  }
  if (typeof b.max_cost_cents === "number" && b.max_cost_cents > 0) {
    byAxis.cost = { consumed: e.cumulativeCostCents, cap: b.max_cost_cents, fraction: e.cumulativeCostCents / b.max_cost_cents };
  }
  if (typeof b.max_wallclock_seconds === "number" && b.max_wallclock_seconds > 0 && typeof e.wallclockSeconds === "number") {
    byAxis.wallclock = { consumed: e.wallclockSeconds, cap: b.max_wallclock_seconds, fraction: e.wallclockSeconds / b.max_wallclock_seconds };
  }
  const fractions = Object.values(byAxis).map((a) => a.fraction);
  const fraction = fractions.length ? Math.max(...fractions) : 0;
  return { fraction, byAxis, attempts: e.attempts, cumulativeCostCents: e.cumulativeCostCents };
}

// ── dGoal: acceptance-metric movement over the window (ledger series, reconciled with the external re-read) ──
function computeDGoal(facts: GoalSupervisionFacts): {
  dGoal: number | null;
  startValue: number | null;
  currentValue: number | null;
  currentSource: string;
  observedCycles: number;
} {
  const series = [...facts.progressSeries].sort((a, b) => a.cycle - b.cycle);

  // The CURRENT value PREFERS the GS's fresh external re-read — the whole point of §7.2 is that the GS does
  // NOT trust the loop's self-reported latest value. Only if the independent re-read is unavailable do we
  // fall back to the latest ledger sample (and the dataUnreadable lean catches that case).
  let currentValue: number | null = null;
  let currentSource: string;
  if (facts.externalReprobe && facts.externalReprobe.ok && facts.externalReprobe.value != null) {
    currentValue = facts.externalReprobe.value;
    currentSource = "GS external re-probe (independent of the loop)";
  } else if (series.length && series[series.length - 1]!.value != null) {
    currentValue = series[series.length - 1]!.value;
    currentSource = "latest ledger sample (external re-probe unavailable — fail-closed lean applies)";
  } else {
    currentSource = "no readable current value";
  }

  // Window start = the sample `window` cycles back (or the earliest we have).
  const windowStart = series.length ? series[Math.max(0, series.length - facts.window)]! : null;
  const startValue = windowStart ? windowStart.value : null;

  const dGoal = currentValue != null && startValue != null ? currentValue - startValue : null;
  return { dGoal, startValue, currentValue, currentSource, observedCycles: series.length };
}

// Is the metric CONFIRMED moving toward the target by MORE than ε? STRICT (`> ε`, never `>= ε`) so a dGoal of
// exactly 0 is NEVER "movement" — consistent with the flat-detector (|dGoal| > ε), so the two comparators can
// never disagree at the boundary (the ε=0 / integer-metric stuck-at-0 hole). `epsilon` is pre-clamped to a
// finite POSITIVE tolerance by the caller. Direction is reconciled from op + target + current; a contradictory
// or ambiguous acceptance shape is NOT confirmed (fail-closed — regression is never read as progress).
function movementTowardTarget(
  dGoal: number | null,
  startValue: number | null,
  currentValue: number | null,
  epsilon: number,
  acceptance?: AcceptanceShape,
): boolean {
  if (dGoal == null || !Number.isFinite(dGoal)) return false;

  const op = acceptance?.op;
  const declaredDir = acceptance?.direction;
  // The direction the COMPARATOR implies: ">=/>" → increase, "<=/<" → decrease, "==" → gap-closing, else none.
  const opDir: "increase" | "decrease" | "gap" | null =
    op === ">=" || op === ">" ? "increase"
    : op === "<=" || op === "<" ? "decrease"
    : op === "==" ? "gap"
    : null;

  // CONTRADICTION GUARD: a monotone op that disagrees with a declared direction is an ambiguous/contradictory
  // acceptance shape → NOT confirmed (so `op:"<=" + direction:"increase"` can never read a RISE as progress).
  if (declaredDir && (opDir === "increase" || opDir === "decrease") && declaredDir !== opDir) {
    return false;
  }

  // "==" target: "toward" = the absolute gap to the target strictly SHRINKS by more than ε (needs target +
  // both endpoints; anything missing/non-finite → not confirmed).
  if (opDir === "gap") {
    const target = acceptance?.target;
    if (target == null || !Number.isFinite(target) || startValue == null || currentValue == null) return false;
    return Math.abs(startValue - target) - Math.abs(currentValue - target) > epsilon;
  }

  // Monotone: prefer the op's implied direction; else the declared direction; else default increase. STRICT.
  const dir = opDir ?? declaredDir ?? "increase";
  return dir === "decrease" ? dGoal < -epsilon : dGoal > epsilon;
}

// The no-progress/loop-fingerprint signal (§7.2 step 3): the SAME fix repeated across the window strengthens
// the "alive but not advancing" verdict (effort spent re-trying the same thing with a flat delta).
function computeFingerprint(series: ProgressPoint[], window: number): LoopFingerprint {
  const w = series.slice(-window).filter((s) => s.fixRef);
  if (!w.length) return { repeated: false, fixRef: null, count: 0 };
  const counts = new Map<string, number>();
  for (const s of w) counts.set(s.fixRef!, (counts.get(s.fixRef!) ?? 0) + 1);
  let top: string | null = null;
  let c = 0;
  for (const [k, v] of counts) if (v > c) { top = k; c = v; }
  return { repeated: c >= 2, fixRef: top, count: c };
}

// =============================================================================
// THE TRIP RULE (pure) — FAIL-CLOSED BY CONSTRUCTION. HALT_AND_SUMMON is the DEFAULT; a goal silently
// CONTINUEs ONLY in two POSITIVELY-PROVEN states. Everything else summons. This inverts the burden so a
// new failure mode (an unreadable axis, a non-finite value, a missing input) can never re-open a silent-
// continue hole — the recurring liveness≠progress trap is closed at the structure, not per-axis.
// =============================================================================
// A goal CONTINUEs IFF one of:
//   (A) GENUINELY EARLY  — every effort input is READABLE + FINITE, and effort is below EVERY grace floor
//                          (little has been spent on any axis — fair to wait, regardless of progress state).
//   (B) CONFIRMED MOVING — every effort input is READABLE + FINITE and past a grace floor, AND progress is
//                          READABLE + FINITE and actually moving toward the target (dGoal beyond ε).
// ANY other state → HALT_AND_SUMMON: any UNREADABLE input (progress, re-probe, OR effort), any NON-FINITE
// numeric (effort axis, budget axis, dGoal, the external re-read), or effort-past-grace-without-confirmed-
// progress (flat / regressing / too-few-samples). "Cannot supervise" is itself a summon, never a continue.
export function evaluateGoalSupervision(facts: GoalSupervisionFacts): GoalSupervisionVerdict {
  const effort = computeEffort(facts.effort);
  const g = computeDGoal(facts);
  const fingerprint = computeFingerprint(facts.progressSeries, facts.window);

  // ── ε VALIDATION (a soundness input) — ε must be a finite POSITIVE tolerance ───────────────────────────
  // ε ≤ 0 (a "zero-tolerance" config that disarms the stall detector — the exact stuck value of integer/
  // boolean metrics) or a non-finite ε is INVALID config; it is clamped to the safe positive default so the
  // strict comparators always have a positive threshold and a dGoal of exactly 0 can never read as movement.
  const epsilonValid = Number.isFinite(facts.epsilon) && facts.epsilon > 0;
  const epsilon = epsilonValid ? facts.epsilon : SAFE_EPSILON;

  // ── SOUNDNESS GATES (readable + finite) — the structural fail-closed core ──────────────────────────────
  // EFFORT must be readable AND every numeric finite + non-negative. A DB blip (readable.effort=false), a
  // NaN/Infinity/negative attempts or cost, or a non-finite budget axis ⇒ effort is UNSOUND ⇒ fail-closed.
  const KNOWN_BUDGET_AXES = ["max_turns", "max_cost_cents", "max_wallclock_seconds"] as const;
  const effortProblems: string[] = [];
  if (facts.readable.effort !== true) effortProblems.push("effort ledger unreadable");
  if (!Number.isFinite(facts.effort.attempts) || facts.effort.attempts < 0) effortProblems.push(`attempts non-finite/negative (${facts.effort.attempts})`);
  if (!Number.isFinite(facts.effort.cumulativeCostCents) || facts.effort.cumulativeCostCents < 0) effortProblems.push(`cost non-finite/negative (${facts.effort.cumulativeCostCents}¢)`);
  for (const k of KNOWN_BUDGET_AXES) {
    const v = (facts.effort.budgetCap ?? {})[k];
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v))) effortProblems.push(`budget ${k} non-finite (${String(v)})`);
  }
  const effortSound = effortProblems.length === 0;

  // PROGRESS must be readable, the GS's own re-probe must have succeeded, and the re-read + dGoal must be
  // finite. An unreadable series, a failed re-probe, or a non-finite re-read/dGoal ⇒ progress is UNSOUND.
  const reprobeOk = facts.externalReprobe?.ok === true;
  const reprobeFinite = !facts.externalReprobe || facts.externalReprobe.value === null || Number.isFinite(facts.externalReprobe.value);
  const dGoalFinite = g.dGoal === null || Number.isFinite(g.dGoal);
  const progressProblems: string[] = [];
  if (facts.readable.progress !== true) progressProblems.push("goal-delta series unreadable");
  if (!reprobeOk) progressProblems.push("external metric re-probe failed");
  if (!reprobeFinite) progressProblems.push(`external re-read non-finite (${String(facts.externalReprobe?.value)})`);
  if (!dGoalFinite) progressProblems.push(`dGoal non-finite (${String(g.dGoal)})`);
  const progressSound = progressProblems.length === 0;

  // ── EFFORT SIGNIFICANCE — OR across axes (only trusted when effortSound; the values are finite then) ──
  // Significant if ANY axis is past its floor: relative budget fraction, OR an ABSOLUTE attempt floor, OR an
  // ABSOLUTE cost backstop. One under-used axis cannot veto another's runaway; a missing budget cannot exempt.
  const fractionComputable = Object.keys(effort.byAxis).length > 0;
  const fractionPast = fractionComputable && effort.fraction >= facts.graceFloor.minEffortFraction;
  const attemptsPast = facts.effort.attempts >= facts.graceFloor.minAttempts;
  const costPast = facts.effort.cumulativeCostCents >= facts.graceFloor.minCostCents;
  const effortSignificant = fractionPast || attemptsPast || costPast;

  const enoughObservations = g.observedCycles >= facts.graceFloor.minCycles;
  const movedToward = movementTowardTarget(g.dGoal, g.startValue, g.currentValue, epsilon, facts.acceptance);
  // CONFIRMED progress = progress SOUND (readable+finite+re-probed) + a computable, strictly-toward-target dGoal.
  const progressConfirmed = progressSound && g.dGoal != null && movedToward;

  // An honest effort description — never claims "0% of budget" when there is simply NO budget ceiling.
  const effortDesc = !effortSound
    ? `effort UNSOUND [${effortProblems.join("; ")}]`
    : fractionComputable
      ? `${pct(effort.fraction)} of budget (${facts.effort.attempts} attempts, ${facts.effort.cumulativeCostCents}¢)`
      : `${facts.effort.attempts} attempts / ${facts.effort.cumulativeCostCents}¢ with NO budget ceiling ` +
        `(under-instrumented — C9 should refuse no-budget goals; the GS absolute backstop fired)`;

  let verdict: GoalVerdict;
  let reason: string;

  // (A) GENUINELY EARLY — the only continue that ignores progress: effort sound, finite, and below every floor.
  if (effortSound && !effortSignificant) {
    verdict = "CONTINUE";
    reason =
      `early-grace: spent ${fractionComputable ? `${pct(effort.fraction)} of budget` : "no relative budget (no cap axis)"} / ` +
      `${facts.effort.attempts} attempts / ${facts.effort.cumulativeCostCents}¢ — below EVERY effort floor ` +
      `(≥${pct(facts.graceFloor.minEffortFraction)} budget OR ≥${facts.graceFloor.minAttempts} attempts OR ` +
      `≥${facts.graceFloor.minCostCents}¢), all inputs readable+finite — genuinely early; little spent, fair to wait.`;
  // (B) CONFIRMED MOVING — effort sound + past a floor, AND progress sound + actually advancing.
  } else if (effortSound && effortSignificant && progressConfirmed) {
    verdict = "CONTINUE";
    reason =
      `progressing: ${effortDesc} spent AND dGoal ${fmt(g.dGoal)} ` +
      `(from ${fmt(g.startValue)} → ${fmt(g.currentValue)} via ${g.currentSource}) CONFIRMS movement toward the ` +
      `target by MORE than ε=${epsilon}${epsilonValid ? "" : " (ε clamped — invalid config)"} — the goal is advancing.`;
  // DEFAULT — every other state summons. Distinguish the cause (most-certain failure first).
  } else {
    verdict = "HALT_AND_SUMMON";
    let why: string;
    if (!effortSound) {
      // Cannot even MEASURE effort — the goal may have burned unbounded budget. The loudest fail-closed case.
      why = `cannot-supervise: effort is under-instrumented — ${effortProblems.join("; ")} (a goal whose spend cannot be measured is treated as a runaway, not waved through)`;
    } else if (!progressSound) {
      why = `fail-closed: effort is ${effortDesc} but progress is UNCONFIRMABLE — ${progressProblems.join("; ")}`;
    } else if (g.dGoal == null) {
      why = `under-instrumented: ${effortDesc} spent but no comparable samples to compute movement — the GS cannot demonstrate the goal is advancing`;
    } else if (!enoughObservations) {
      why =
        `under-instrumented: ${effortDesc} spent, dGoal ${fmt(g.dGoal)} but only ${g.observedCycles} sample(s) ` +
        `(<${facts.graceFloor.minCycles}) — too few to demonstrate sustained movement; progress is NOT confirmed`;
    } else if (Math.abs(g.dGoal as number) > epsilon) {
      why = `regressing/not-toward-target: ${effortDesc} spent, dGoal ${fmt(g.dGoal)} is not strictly moving toward the target over ${g.observedCycles} cycles${epsilonValid ? "" : " (ε clamped — invalid config)"}`;
    } else {
      why =
        `flat: ${effortDesc} spent, dGoal ${fmt(g.dGoal)} ≈ 0 (|dGoal| ≤ ε=${epsilon}${epsilonValid ? "" : ", clamped — invalid config"}) over ${g.observedCycles} cycles` +
        (fingerprint.repeated ? `, the same fix '${fingerprint.fixRef}' retried ${fingerprint.count}×` : "");
    }
    reason = `${why}. The loop is ALIVE but progress is not confirmed (liveness ≠ progress) — HALT + summon.`;
  }

  return {
    goalId: facts.goalId,
    trip: verdict === "HALT_AND_SUMMON",
    verdict,
    reason,
    dGoal: g.dGoal,
    dEffort: effort,
    details: {
      startValue: g.startValue,
      currentValue: g.currentValue,
      currentSource: g.currentSource,
      observedCycles: g.observedCycles,
      pastGrace: effortSignificant,
      progressConfirmed,
      effortSound,
      progressSound,
      dataUnreadable: !effortSound || !progressSound,
      fingerprint,
      epsilon, // the EFFECTIVE tolerance actually used (clamped to SAFE_EPSILON if the config ε was invalid)
      epsilonClamped: !epsilonValid,
      graceFloor: facts.graceFloor,
    },
  };
}

// =============================================================================
// HALT + FAP (SHADOW) — the trip's consequence, DRAFTED, never delivered.
// =============================================================================
// On a trip the GS would emit a GoalDeltaVerdict(trip) → the PO reconciler (the ONLY mutator, §15) would
// transition the contract via the §4.3 LEGAL edges EXECUTING --GS-early-trip--> REVIEWING --review:unreachable-->
// HALTED, and summon the founder with a feasibility/strategy FAP. In THIS slice both are DRAFTED only:
// `executed:false`, no DB transition, no real channel. This is the draft-don't-send seam.

export interface GoalDeltaVerdictSignal {
  message: "GoalDeltaVerdict";
  goal_id: string;
  trip: boolean;
  cycle: number | null;
  dGoal: number | null;
  dEffort_fraction: number;
  /** the LEGAL §4.3 transition chain the reconciler would apply (described, NOT executed in SHADOW). */
  intended_transition: string;
  from: GoalState | null;
  to: "HALTED";
  executed: boolean;
}

export interface FounderActionPackage {
  fap_version: 1;
  boundary_class: "feasibility/strategy";
  goal_id: string;
  status: string;
  why_i_stopped: string;
  what_i_completed: string;
  what_remains: string;
  /** the zero-tech decision the founder owns (§15: reachability mid-run is the FOUNDER's). */
  exactly_what_to_do: string[];
  evidence: {
    dGoal: number | null;
    dEffort: EffortBreakdown;
    epsilon: number;
    /** the flat line, MADE VISIBLE (§3.1: the feasibility FAP embeds the goal-delta ledger). */
    goal_delta_series: ProgressPoint[];
    external_reprobe: ExternalReprobe | null;
    loop_fingerprint: LoopFingerprint;
  };
  rollback: string;
  resume_command: string;
}

export interface HaltAndFap {
  posture: "SHADOW";
  halt: GoalDeltaVerdictSignal;
  fap: FounderActionPackage;
  /** the real-paging seam — INERT in this slice (draft-don't-send). */
  paging: { mode: "SHADOW"; credential_ref: "GS_FAP_WEBHOOK"; configured: boolean; note: string };
}

export interface ComposeHaltOptions {
  cycle?: number | null;
  /** founder-gated: even when true this slice does NOT mutate a live goal (no live goal flow yet, Sprint 5.3). */
  enforce?: boolean;
  pagingConfigured?: boolean;
}

/** Draft the HALT signal + the feasibility/strategy FAP for a tripped verdict. Pure: builds the envelopes,
 *  performs NO side-effect, transitions NO contract, pages NO channel (SHADOW). */
export function composeHaltAndFap(
  facts: GoalSupervisionFacts,
  verdict: GoalSupervisionVerdict,
  opts: ComposeHaltOptions = {},
): HaltAndFap {
  const from = facts.contractState ?? null;
  const halt: GoalDeltaVerdictSignal = {
    message: "GoalDeltaVerdict",
    goal_id: facts.goalId,
    trip: verdict.trip,
    cycle: opts.cycle ?? facts.externalReprobe?.cycle ?? null,
    dGoal: verdict.dGoal,
    dEffort_fraction: verdict.dEffort.fraction,
    intended_transition:
      `${from ?? "EXECUTING"} --GS-early-trip--> REVIEWING --review:unreachable--> HALTED (feasibility FAP → Founder)`,
    from,
    to: "HALTED",
    // EXECUTED IS ALWAYS FALSE IN THIS SLICE — the GS drafts; the PO reconciler is the only mutator (§15),
    // and there is no live goal flow to mutate. --enforce proves the fail-closed CAPABILITY (a non-zero
    // signal at the CLI), it does NOT flip this to a live transition.
    executed: false,
  };

  const fap: FounderActionPackage = {
    fap_version: 1,
    boundary_class: "feasibility/strategy",
    goal_id: facts.goalId,
    status: "HALT_AND_SUMMON (SHADOW — drafted, not delivered: no live goal transitioned, no channel paged)",
    why_i_stopped: verdict.reason,
    what_i_completed:
      `spent ${pct(verdict.dEffort.fraction)} of the goal budget (${verdict.dEffort.attempts} attempts, ` +
      `${verdict.dEffort.cumulativeCostCents}¢) over ${verdict.details.observedCycles} supervised cycles.`,
    what_remains:
      `the acceptance metric has not reached its target: dGoal ${fmt(verdict.dGoal)} over the window ` +
      `(ε=${verdict.details.epsilon}). The goal is alive but not advancing.`,
    exactly_what_to_do: [
      "REDIRECT — amend the objective / give a new lever, then resume (the contract returns to PLANNING).",
      "ACCEPT-LOWER-BAR — accept the current metric value as good-enough (the contract returns to REVIEWING).",
      "KILL — stop spending on this goal (the contract closes).",
    ],
    evidence: {
      dGoal: verdict.dGoal,
      dEffort: verdict.dEffort,
      epsilon: verdict.details.epsilon,
      goal_delta_series: facts.progressSeries,
      external_reprobe: facts.externalReprobe,
      loop_fingerprint: verdict.details.fingerprint,
    },
    rollback: "none required — nothing was halted or paged in SHADOW; this is a drafted summon only.",
    resume_command: `/goal resume ${facts.goalId}`,
  };

  return {
    posture: "SHADOW",
    halt,
    fap,
    paging: {
      mode: "SHADOW",
      credential_ref: "GS_FAP_WEBHOOK",
      configured: Boolean(opts.pagingConfigured),
      note: opts.pagingConfigured
        ? "real paging configured but SHADOWED in this slice (draft-don't-send; real paging is a separate panel-gated step)"
        : "real paging not wired (out of scope this slice) — the C1 feasibility-FAP channel (Slack / non-SaaS, RS-DOS §3.1) is the seam",
    },
  };
}

// =============================================================================
// runGoalSupervision — the PRODUCTION entry the RESERVED C7 scheduler tier would call (the real wire).
// =============================================================================
// EXTERNAL by construction: it RE-PROBES the acceptance metric itself (invokeProbe under the GS's own
// least-privilege credentials), then reads the durable ledgers, evaluates, and (on a trip) drafts the
// HALT + FAP. It MUTATES the goal_delta_ledger ONLY (appending its own independent ProgressSample — the
// GS's job, idempotent on (goal_id, cycle)); it transitions NO contract and pages NO channel (SHADOW).
//
// Dependency-injected so it is testable offline (a fake CredentialResolver / a fake store) AND runs for
// real against the test DB. The default store is `runtimeStoresAdapter` (the durable C12 door).
export interface SupervisionConfig {
  window?: number;
  epsilon?: number;
  graceFloor?: GraceFloor;
  acceptance?: AcceptanceShape;
}

export interface SupervisionStore {
  /** The GS's ONE write: append its OWN external re-read as a ProgressSample (idempotent on goal_id+cycle).
   *  This is the §7.2 step-2 / §8.2 (`ProgressSample | C7 → goal-delta ledger`) append — the GS's own
   *  independent measurement, NOT the loop's self-report. Returns false if the cycle was already recorded. */
  appendProgressSample(s: { goalId: string; cycle: number; value: number | null; predicted?: number | null; fixRef?: string | null }): Promise<boolean>;
  readProgressSeries(goalId: string): Promise<ProgressPoint[]>;
  countAttempts(goalId: string): Promise<number>;
  readCumulativeCost(goalId: string): Promise<number>;
}

/** The DEFAULT production store — the sanctioned C12 durable-stores door (src/runtime-stores.ts, migration
 *  0052). The GS appends through `appendProgressSample` (its own append-only ledger; the GS is a legitimate
 *  WRITER of goal_delta_ledger per §8.2 — distinct from the reconciler, which mutates the GoalContract
 *  state machine). All three reads are the same door the reconciler reads. Tests may inject a fake instead. */
export const runtimeStoresAdapter: SupervisionStore = {
  appendProgressSample: (s) => appendProgressSample(s),
  readProgressSeries: (goalId) => readProgressSeries(goalId) as Promise<ProgressPoint[]>,
  countAttempts: (goalId) => countAttempts(goalId),
  readCumulativeCost: (goalId) => readCumulativeCost(goalId),
};

export interface RunGoalSupervisionInput {
  goalId: string;
  cycle: number;
  probeId: string;
  probeVersion: number;
  budgetCap: BudgetCap;
  contractState?: GoalState;
  config?: SupervisionConfig;
}

// minCostCents 5000¢ = €50 — the absolute cost backstop for a goal with no relative budget ceiling.
export const DEFAULT_GRACE_FLOOR: GraceFloor = { minCycles: 3, minAttempts: 3, minEffortFraction: 0.15, minCostCents: 5000 };
export const DEFAULT_WINDOW = 4;
export const DEFAULT_EPSILON = SAFE_EPSILON;

export interface RunGoalSupervisionResult {
  verdict: GoalSupervisionVerdict;
  reprobe: ExternalReprobe;
  halt: HaltAndFap | null;
}

/**
 * Run one GS cycle for a goal.
 *
 * `probeInvoke` is the external re-read mechanism. NOTE (deferred — live-cutover prerequisite): there is
 * intentionally NO default binding to `metric-probe.invokeProbe` here, and the SHADOW CLI does not call
 * runGoalSupervision (it exercises the pure rule + the re-probe mechanism directly, offline). Binding the
 * real probe — `probeInvoke = () => invokeProbe(input.probeId, input.probeVersion, resolver, registry)
 * .then(r => ({ value: r.value }))` — together with provisioning the GS's least-privilege read-only probe
 * credential is a FOUNDER-gated live-cutover step (see infra/scheduler-tiers.json activation_prerequisites).
 *
 * `store` defaults to the sanctioned `runtimeStoresAdapter` (the C12 durable door). On a trip it returns a
 * DRAFTED HaltAndFap (SHADOW) — it never transitions a contract and pages no channel.
 */
export async function runGoalSupervision(
  input: RunGoalSupervisionInput,
  probeInvoke: () => Promise<{ value: number | null; note?: string }>,
  store: SupervisionStore = runtimeStoresAdapter,
  opts: { enforce?: boolean; pagingConfigured?: boolean } = {},
): Promise<RunGoalSupervisionResult> {
  const cfg = input.config ?? {};
  const window = cfg.window ?? DEFAULT_WINDOW;
  const epsilon = cfg.epsilon ?? DEFAULT_EPSILON;
  const graceFloor = cfg.graceFloor ?? DEFAULT_GRACE_FLOOR;

  // 1) EXTERNAL re-read of the acceptance metric (the GS's own identity — never the loop's self-report).
  let reprobe: ExternalReprobe;
  try {
    const r = await probeInvoke();
    reprobe = { ok: true, value: r.value, cycle: input.cycle, probeId: input.probeId, version: input.probeVersion, note: r.note ?? "external re-read ok" };
  } catch (e) {
    reprobe = { ok: false, value: null, cycle: input.cycle, probeId: input.probeId, version: input.probeVersion, note: `external re-read FAILED: ${(e as Error).message}` };
  }

  // 1b) APPEND the GS's OWN external measurement to the goal-delta ledger (§7.2 step 2 / §8.2). This is the
  //     GS's single, append-only write — it records the independent re-read EVERY cycle, so the audit trail
  //     captures the GS's view AND observedCycles grows over time (a sparse goal becomes well-instrumented
  //     the longer the GS watches it). Idempotent on (goal_id, cycle): a late double-run is a no-op. Append
  //     failure does NOT mask a stall — the read below + the fail-closed burden still summon on unconfirmed
  //     progress; we only annotate the reprobe note.
  if (reprobe.ok) {
    try {
      await store.appendProgressSample({ goalId: input.goalId, cycle: input.cycle, value: reprobe.value, predicted: null, fixRef: null });
    } catch (e) {
      reprobe.note = `${reprobe.note}; WARN ledger append failed: ${(e as Error).message}`;
    }
  }

  // 2) Read the durable ledgers (dGoal series + dEffort). Each read is independently fail-closeable.
  let progressSeries: ProgressPoint[] = [];
  let progressReadable = true;
  try {
    progressSeries = await store.readProgressSeries(input.goalId);
  } catch {
    progressReadable = false;
  }
  let attempts = 0;
  let cumulativeCostCents = 0;
  let effortReadable = true;
  try {
    attempts = await store.countAttempts(input.goalId);
    cumulativeCostCents = await store.readCumulativeCost(input.goalId);
  } catch {
    effortReadable = false;
  }

  // 3) Assemble facts + evaluate (pure).
  const facts: GoalSupervisionFacts = {
    goalId: input.goalId,
    window,
    epsilon,
    graceFloor,
    progressSeries,
    externalReprobe: reprobe,
    effort: { attempts, cumulativeCostCents, budgetCap: input.budgetCap },
    acceptance: cfg.acceptance,
    contractState: input.contractState,
    readable: { progress: progressReadable, effort: effortReadable },
  };
  const verdict = evaluateGoalSupervision(facts);

  // 4) On a trip, DRAFT the HALT + FAP (SHADOW — nothing transitioned, nothing paged).
  const halt = verdict.trip ? composeHaltAndFap(facts, verdict, { cycle: input.cycle, enforce: opts.enforce, pagingConfigured: opts.pagingConfigured }) : null;
  return { verdict, reprobe, halt };
}
