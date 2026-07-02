// =============================================================================
// THE CLASSIFY GOLDEN SUITE — the intake-classifier organ's frozen gate (P2 slice 3, roadmap G-20).
// =============================================================================
// I17 — "intelligence measured, never assumed." This is the FROZEN golden set the eval harness replays to
// measure whichever model serves the CLASSIFY class. It is the organ's gate: a model is not adoptable for
// CLASSIFY until it is GREEN on these goldens (passesGate). Real-model scoring runs when a model is
// provisioned; the machinery + the goldens ship now so the organ is gated from day one.
//
// Each case is a real founder-style utterance → the EXPECTED classification, scored by `json-field-match`
// (structural subset match: only the fields named in `expected` are checked, so a case can gate on just the
// axis it isolates). Coverage:
//   · lanes         — build / investigate / operate (the three work kinds)
//   · consequentiality — low / medium / high (blast radius)
//   · reversibility — reversible / irreversible
//   · control-surface intents — the clear routable phrases (review_open_prs, show_blockers, …)
//   · AMBIGUOUS    — under-specified utterances that MUST classify as needs_clarification (refuse, don't guess)
//
// A suite is model-agnostic: it names NO model. The runner forces each candidate model over every case.

import type { EvalSuite } from "../eval-case.js";

/** The frozen CLASSIFY goldens. Ids are stable (a report keys failures by id). */
export const CLASSIFY_SUITE: EvalSuite = {
  class: "CLASSIFY",
  cases: [
    // ── build lane ────────────────────────────────────────────────────────────────────────────────────
    { id: "build-new-module", class: "CLASSIFY", input: "build a new billing module", expected: { lane: "build", consequentiality: "medium" }, scorerId: "json-field-match" },
    { id: "build-goal-ship", class: "CLASSIFY", input: "create a goal to ship the invoicing feature", expected: { intent: "create_goal", lane: "build" }, scorerId: "json-field-match" },
    { id: "build-add-toggle", class: "CLASSIFY", input: "add a dark-mode toggle to the settings page", expected: { lane: "build", reversibility: "reversible" }, scorerId: "json-field-match" },

    // ── investigate lane ──────────────────────────────────────────────────────────────────────────────
    { id: "investigate-ci-slow", class: "CLASSIFY", input: "why is CI slow", expected: { lane: "investigate", consequentiality: "low" }, scorerId: "json-field-match" },
    { id: "investigate-blockers", class: "CLASSIFY", input: "show me the blockers", expected: { intent: "show_blockers", lane: "investigate" }, scorerId: "json-field-match" },
    { id: "investigate-flaky-test", class: "CLASSIFY", input: "investigate the flaky payment test", expected: { lane: "investigate" }, scorerId: "json-field-match" },

    // ── operate lane ──────────────────────────────────────────────────────────────────────────────────
    { id: "operate-invoice-mercury", class: "CLASSIFY", input: "create an invoice for Mercury", expected: { lane: "operate" }, scorerId: "json-field-match" },
    { id: "operate-review-prs", class: "CLASSIFY", input: "review all open PRs", expected: { intent: "review_open_prs", lane: "operate" }, scorerId: "json-field-match" },
    { id: "operate-company-health", class: "CLASSIFY", input: "summarize company health", expected: { intent: "company_health", lane: "operate" }, scorerId: "json-field-match" },
    { id: "operate-morning", class: "CLASSIFY", input: "good morning", expected: { intent: "morning_digest", lane: "operate", consequentiality: "low" }, scorerId: "json-field-match" },

    // ── consequentiality / reversibility isolated ───────────────────────────────────────────────────────
    { id: "high-irreversible-drop-db", class: "CLASSIFY", input: "delete the production database", expected: { consequentiality: "high", reversibility: "irreversible" }, scorerId: "json-field-match" },
    { id: "high-approve-prod-deploy", class: "CLASSIFY", input: "approve the production deploy", expected: { intent: "approve", consequentiality: "high" }, scorerId: "json-field-match" },
    { id: "low-reversible-readme", class: "CLASSIFY", input: "fix a typo in the README", expected: { consequentiality: "low", reversibility: "reversible" }, scorerId: "json-field-match" },
    { id: "high-irreversible-investor-email", class: "CLASSIFY", input: "send the Q3 investor update email now", expected: { consequentiality: "high", reversibility: "irreversible" }, scorerId: "json-field-match" },

    // ── AMBIGUOUS → needs_clarification (the organ must refuse, not guess) ───────────────────────────────
    { id: "ambiguous-do-the-thing", class: "CLASSIFY", input: "do the thing", expected: { intent: "unknown", needs_clarification: true }, scorerId: "json-field-match" },
    { id: "ambiguous-handle-it", class: "CLASSIFY", input: "handle it", expected: { needs_clarification: true }, scorerId: "json-field-match" },
    { id: "ambiguous-you-know", class: "CLASSIFY", input: "you know what to do", expected: { needs_clarification: true }, scorerId: "json-field-match" },
  ],
};
