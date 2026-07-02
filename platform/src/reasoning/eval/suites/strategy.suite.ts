// =============================================================================
// THE STRATEGY GOLDEN SUITE — the strategy organ's frozen gate (reasoning slice 11, Frozen §10.3 O2).
// =============================================================================
// I17 — "intelligence measured, never assumed." This is the FROZEN golden set the eval harness replays to
// measure whichever model serves the ARCH_REVIEW class for STRATEGY. A model is not adoptable for strategy
// reasoning until it is GREEN on these goldens (passesGate). Real-model scoring runs when a model is
// provisioned; the machinery + the goldens ship now so the organ is gated from day one.
//
// Each case is a GOAL → the EXPECTED strategy judgment, scored by `json-field-match` (structural subset match:
// only the fields named in `expected` are checked). The suite scores the model's RAW envelope, so the expected
// fields name what a GOOD model should EMIT ({needs_clarification}). Coverage of the two regimes the
// fail-closed rule must separate:
//   · COMMIT      — well-specified goals with support in context → {needs_clarification:false} (an approach is
//                    justifiable, so the organ commits);
//   · CLARIFY     — under-specified / unsupported goals → {needs_clarification:true} — the model MUST ask to
//                    clarify rather than invent a strategy, and the organ falls closed (never a fabricated
//                    approach). This is the fail-closed heart: unsure ⇒ CLARIFY, do not commit.
//
// A suite is model-agnostic: it names NO model. The runner forces each candidate model over every case.

import type { EvalSuite } from "../eval-case.js";

/** The frozen STRATEGY goldens. Ids are stable (a report keys failures by id). Class is ARCH_REVIEW (deep
 *  approach reasoning — strategy has no reasoning class of its own; it reuses the stable ARCH_REVIEW class). */
export const STRATEGY_SUITE: EvalSuite = {
  class: "ARCH_REVIEW",
  cases: [
    // ── COMMIT — well-specified, supported by context ⇒ the organ can commit to an approach ──────────────────
    { id: "strat-commit-invoicing", class: "ARCH_REVIEW", input: "ship the invoicing feature — the delivery engine exists and has precedent", expected: { needs_clarification: false }, scorerId: "json-field-match" },
    { id: "strat-commit-health-endpoint", class: "ARCH_REVIEW", input: "add a GET /health endpoint to the existing API service", expected: { needs_clarification: false }, scorerId: "json-field-match" },
    { id: "strat-commit-dark-mode", class: "ARCH_REVIEW", input: "add a dark-mode toggle to the settings page using the existing theme system", expected: { needs_clarification: false }, scorerId: "json-field-match" },
    { id: "strat-commit-raise-coverage", class: "ARCH_REVIEW", input: "raise delivery test coverage to 90% — the delivery engine is the lever and it exists", expected: { needs_clarification: false }, scorerId: "json-field-match" },
    { id: "strat-commit-cache-reads", class: "ARCH_REVIEW", input: "cache the hot read path in the API with the Redis instance we already run", expected: { needs_clarification: false }, scorerId: "json-field-match" },
    { id: "strat-commit-rate-limit", class: "ARCH_REVIEW", input: "add per-tenant rate limiting to the public API using the existing gateway middleware", expected: { needs_clarification: false }, scorerId: "json-field-match" },

    // ── CLARIFY — under-specified / unsupported ⇒ the model MUST ask to clarify (fail-closed, no fabrication) ─
    { id: "strat-clarify-improve", class: "ARCH_REVIEW", input: "improve the product", expected: { needs_clarification: true }, scorerId: "json-field-match" },
    { id: "strat-clarify-migrate-unknown", class: "ARCH_REVIEW", input: "migrate the database to a system we have not chosen yet", expected: { needs_clarification: true }, scorerId: "json-field-match" },
    { id: "strat-clarify-vendor-tbd", class: "ARCH_REVIEW", input: "integrate a third-party payments vendor that has not been selected", expected: { needs_clarification: true }, scorerId: "json-field-match" },
    { id: "strat-clarify-scale-unmeasured", class: "ARCH_REVIEW", input: "scale to a load we have never measured or specified", expected: { needs_clarification: true }, scorerId: "json-field-match" },
    { id: "strat-clarify-rewrite-vague", class: "ARCH_REVIEW", input: "rewrite the app to be more modern", expected: { needs_clarification: true }, scorerId: "json-field-match" },
    { id: "strat-clarify-grow-usage", class: "ARCH_REVIEW", input: "grow usage — figure out how", expected: { needs_clarification: true }, scorerId: "json-field-match" },
  ],
};
