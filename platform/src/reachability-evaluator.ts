// =============================================================================
// Pre-flight reachability evaluator (RS-DOS-v1 §36.3) — CONTRACT ONLY; STUB. NOT BUILT in Sprint 1.5.
// =============================================================================
// §36.3 has two parts. The DETERMINISTIC serverless-ceiling lint is buildable as-is; the LLM
// reachability/precedent check is the part the spec explicitly permits to be "scoped/stubbed, not
// built" in this slice. This file pins the contract + the deterministic decision rule so the C9
// pre-flight gate (a later sprint) builds against a frozen interface — and FAILS CLOSED until then.
//
// DEFERRED TO: the C9 pre-flight gate sprint (RS-DOS §7.3). This slice (1.5) builds only the
// MetricProbe substrate + goal-progress; it does NOT build the evaluator.
// =============================================================================

/** Inputs to the LLM reachability/precedent check (§36.3). */
export interface ReachabilityInput {
  /** The acceptance metric definition + its probe (probe_id@version). */
  metric: { description: string; probeId: string; probeVersion: number };
  /** The current measured value (from a MetricProbe re-read). */
  currentValue: number | null;
  /** The historical maximum ever achieved for this metric (precedent). */
  historicalMax: number | null;
  /** The available inputs / levers the runtime can act on. */
  availableLevers: string[];
}

/** The structured verdict the LLM emits (§36.3). */
export interface ReachabilityVerdict {
  reachable: boolean;
  confidence: number; // 0..1
  evidence: string;
}

/** Terminal decision after applying the deterministic rule over the (possibly malformed) LLM verdict. */
export type ReachabilityDecision = "ADMIT" | "HALT_FEASIBILITY_FAP";

/**
 * The DETERMINISTIC decision rule over the LLM verdict (§36.3) — fully specified, safe to freeze now:
 *   reachable=false                      → HALT (feasibility FAP → Founder)
 *   reachable=true ∧ confidence ≥ θ      → ADMIT
 *   malformed | confidence < θ           → FAIL-CLOSED → HALT (never silently admit)
 *
 * This rule IS buildable today and is provided so the gate is fail-closed by construction. The LLM
 * call that PRODUCES the verdict is the stubbed part (`evaluateReachability` below).
 */
export function decideReachability(verdict: ReachabilityVerdict | null | undefined, theta = 0.7): ReachabilityDecision {
  if (!verdict || typeof verdict.reachable !== "boolean" || typeof verdict.confidence !== "number" || Number.isNaN(verdict.confidence)) {
    return "HALT_FEASIBILITY_FAP"; // malformed → fail-closed
  }
  if (verdict.reachable === false) return "HALT_FEASIBILITY_FAP";
  if (verdict.confidence >= theta) return "ADMIT";
  return "HALT_FEASIBILITY_FAP"; // low-confidence → fail-closed
}

/**
 * STUB — NOT BUILT in Sprint 1.5 (RS-DOS §36.3, "the LLM evaluator may be scoped/stubbed, not built").
 * The LLM call that produces a {reachable, confidence, evidence} verdict is deferred to the C9
 * pre-flight gate sprint. Calling it now throws, by design, so no path silently depends on an
 * un-built evaluator (and any premature wiring fails loudly rather than fakes a verdict).
 */
export async function evaluateReachability(_input: ReachabilityInput): Promise<ReachabilityVerdict> {
  throw new Error(
    "reachability-evaluator: the §36.3 LLM reachability check is DEFERRED (Sprint 1.5 stub) — built in the C9 pre-flight gate sprint",
  );
}
