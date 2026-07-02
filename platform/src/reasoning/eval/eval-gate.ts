// =============================================================================
// EVAL GATE + PROMOTION — the mechanical "measured, not assumed" precondition (ADR §"Eval harness hook", I17).
// =============================================================================
// The ADR requires that no config swap adopts a model until it is GREEN on the frozen suite. This module is
// that gate, plus the audited promotion PROPOSAL:
//   - passesGate(report, model, threshold) — is `model` at/above the pass-rate bar on the frozen suite? This is
//     the mechanical precondition a config edit must clear before it may name `model` as a class' primary.
//   - rankModels(report) — order candidates by measured quality (passRate → meanScore → latency), so a promotion
//     compares apples to apples.
//   - proposePromotion(report, currentConfigForClass) — if a challenger BEATS the current primary by a margin AND
//     clears the gate, propose promoting it, returning the proposed config DELTA. It does NOT write config —
//     promotion is an audited config edit, out of scope here. This is how selection EVOLVES on evidence, never
//     on assertion.
// Names no model id; scans clean under the model-agnostic lint (all ids flow in as data from the report/config).

import type { ClassBinding } from "../routing-config.js";
import { modelResult, type EvalReport, type PerModelResult } from "./eval-runner.js";

/** The default gate bar: a model must pass ≥ 90% of the frozen suite to be adoptable (ADR "green on the suite"). */
export const DEFAULT_GATE_THRESHOLD = 0.9;

/** The default promotion margin: a challenger must beat the primary's passRate by ≥ 5pts to be worth a swap. */
export const DEFAULT_PROMOTION_MARGIN = 0.05;

/**
 * The GATE. Is `model` green on the frozen suite in this report? True iff it was a scored candidate AND its
 * passRate is at/above `threshold`. FAIL-CLOSED: a model that was never scored (absent from the report) does
 * NOT pass — you cannot adopt what you never measured.
 */
export function passesGate(report: EvalReport, model: string, threshold: number = DEFAULT_GATE_THRESHOLD): boolean {
  const row = modelResult(report, model);
  return row !== undefined && row.passRate >= threshold;
}

/**
 * Rank candidates best-first by MEASURED quality: passRate desc → meanScore desc → meanLatencyMs asc (a
 * cost/latency proxy) → model id asc (final, stable tiebreak so the order is fully deterministic).
 */
export function rankModels(report: EvalReport): readonly PerModelResult[] {
  return [...report.models].sort((a, b) => {
    if (b.passRate !== a.passRate) return b.passRate - a.passRate;
    if (b.meanScore !== a.meanScore) return b.meanScore - a.meanScore;
    if (a.meanLatencyMs !== b.meanLatencyMs) return a.meanLatencyMs - b.meanLatencyMs;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });
}

/** The proposed config edit — a DELTA the audit trail carries; this module never writes it. */
export interface PromotionProposal {
  /** True only when the challenger BEATS the primary by the margin AND clears the gate. */
  readonly shouldPromote: boolean;
  /** The challenger model proposed as the new primary. */
  readonly challenger: string;
  /** The current primary being challenged. */
  readonly currentPrimary: string;
  /** Human-readable justification (the measured numbers behind the verdict). */
  readonly reason: string;
  /** The proposed config delta for this class (audited config edit applies it elsewhere — not here). */
  readonly configDelta: { readonly primary: string };
}

export interface ProposePromotionOptions {
  /** Gate bar the challenger must clear (default 0.9). */
  readonly threshold?: number;
  /** Minimum passRate margin over the primary (default 0.05). */
  readonly margin?: number;
}

/**
 * Propose promoting the best-ranked challenger to primary IF the evidence warrants it.
 * Returns:
 *   - `null` when there is nothing to consider (primary not measured, or no challenger even beats the primary);
 *   - a PromotionProposal with `shouldPromote: true` when the top challenger beats the primary by ≥ margin AND
 *     clears the gate (the audited config edit may then adopt `configDelta`);
 *   - a PromotionProposal with `shouldPromote: false` when a challenger beats the primary but falls short of the
 *     margin or the gate (surfaced for transparency — measured, and explicitly NOT promoted).
 * It NEVER writes config: promotion is an audited config edit, out of scope here.
 */
export function proposePromotion(
  report: EvalReport,
  currentConfigForClass: ClassBinding,
  opts: ProposePromotionOptions = {},
): PromotionProposal | null {
  const threshold = opts.threshold ?? DEFAULT_GATE_THRESHOLD;
  const margin = opts.margin ?? DEFAULT_PROMOTION_MARGIN;
  const currentPrimary = currentConfigForClass.primary;

  const primaryRow = modelResult(report, currentPrimary);
  // Cannot propose against a primary that was never scored — measured, not assumed.
  if (!primaryRow) return null;

  // Best-ranked candidate that is NOT the current primary.
  const challengerRow = rankModels(report).find((r) => r.model !== currentPrimary);
  if (!challengerRow) return null;

  // A challenger that does not out-perform the primary is not a candidate for promotion at all.
  if (challengerRow.passRate <= primaryRow.passRate) return null;

  const delta = challengerRow.passRate - primaryRow.passRate;
  const clearsGate = challengerRow.passRate >= threshold;
  const meetsMargin = delta >= margin;
  const shouldPromote = clearsGate && meetsMargin;

  const numbers =
    `challenger ${challengerRow.model} passRate=${fmt(challengerRow.passRate)} (meanScore=${fmt(challengerRow.meanScore)}) ` +
    `vs primary ${currentPrimary} passRate=${fmt(primaryRow.passRate)}; Δ=${fmt(delta)}, gate=${fmt(threshold)}, margin=${fmt(margin)}`;
  const reason = shouldPromote
    ? `promote: ${numbers}`
    : `hold: ${numbers} — ${!clearsGate ? "below gate" : "margin not met"}`;

  return {
    shouldPromote,
    challenger: challengerRow.model,
    currentPrimary,
    reason,
    configDelta: { primary: challengerRow.model },
  };
}

function fmt(x: number): string {
  return x.toFixed(3);
}
