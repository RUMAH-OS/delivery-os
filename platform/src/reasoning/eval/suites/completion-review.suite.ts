// =============================================================================
// THE COMPLETION-REVIEW GOLDEN SUITE — the C6 organ's frozen gate (P2 slice 7, roadmap G-23).
// =============================================================================
// I17 — "intelligence measured, never assumed." This is the FROZEN golden set the eval harness replays to
// measure whichever model serves the VERIFY class for completion review. It is the organ's gate: a model is not
// adoptable for this review until it is GREEN on these goldens (passesGate). Real-model scoring runs when a model
// is provisioned; the machinery + the goldens ship now so the organ is gated from day one.
//
// Each case is a completed-goal scenario (goal + acceptance + evidence, folded into the case `input`) → the
// EXPECTED headline verdict, scored by `json-field-match` on the model's raw `{verdict,...}` envelope. Coverage
// mirrors the fail-closed contract — a model is only green if it earns "pass" for genuinely-done work AND
// withholds "pass" everywhere it is not earned:
//   · GENUINELY COMPLETE  → verdict "pass"        (every acceptance lens truly met, evidence cited)
//   · MISSING A CRITERION → verdict "needs_work"  (one acceptance lens demonstrably unmet — remediation remains)
//   · AMBIGUOUS EVIDENCE  → verdict "needs_work"  (the "done" claim is not backed — MUST fail-closed to not-pass)
//   · BROKEN / REGRESSED  → verdict "fail"        (the work does not stand)
//
// The suite gates the HEADLINE verdict (what json-field-match scores cleanly); the per-lens findings + the
// organ's own fail-closed defaulting are asserted directly in test/completion-review-organ.test.ts. A suite is
// model-agnostic: it names NO model. The runner forces each candidate model over every case.

import type { EvalSuite } from "../eval-case.js";

/** The frozen VERIFY completion-review goldens. Ids are stable (a report keys failures by id). */
export const COMPLETION_REVIEW_SUITE: EvalSuite = {
  class: "VERIFY",
  cases: [
    // ── GENUINELY COMPLETE → "pass" ──────────────────────────────────────────────────────────────────────
    {
      id: "complete-login-endpoint",
      class: "VERIFY",
      input:
        "GOAL: add a POST /login endpoint. ACCEPTANCE: (1) returns 200 + token on valid creds; (2) returns 401 on bad creds; " +
        "(3) covered by tests. EVIDENCE: endpoint merged in PR#12; tests login.test.ts pass 8/8 covering 200 and 401 paths; CI green.",
      expected: { verdict: "pass" },
      scorerId: "json-field-match",
    },
    {
      id: "complete-invoice-export",
      class: "VERIFY",
      input:
        "GOAL: export invoices to CSV. ACCEPTANCE: (1) CSV has all invoice fields; (2) handles empty set; (3) documented. " +
        "EVIDENCE: exporter.ts merged; snapshot test asserts all 9 fields + an empty-set case; README section added; sample CSV attached.",
      expected: { verdict: "pass" },
      scorerId: "json-field-match",
    },
    {
      id: "complete-rate-limit",
      class: "VERIFY",
      input:
        "GOAL: rate-limit the public API to 100 req/min. ACCEPTANCE: (1) 101st request in a window gets 429; (2) resets each minute; " +
        "(3) load-tested. EVIDENCE: middleware merged; integration test asserts 429 at 101 and reset; k6 load run attached showing the cap.",
      expected: { verdict: "pass" },
      scorerId: "json-field-match",
    },
    {
      id: "complete-dark-mode",
      class: "VERIFY",
      input:
        "GOAL: add a dark-mode toggle. ACCEPTANCE: (1) toggle persists across reloads; (2) all pages honor it; (3) screenshot proof. " +
        "EVIDENCE: toggle merged; persistence e2e test passes; visual-regression suite green across all 6 pages; before/after screenshots attached.",
      expected: { verdict: "pass" },
      scorerId: "json-field-match",
    },
    {
      id: "complete-migration-backfill",
      class: "VERIFY",
      input:
        "GOAL: backfill the `country` column for all users. ACCEPTANCE: (1) zero null countries after run; (2) idempotent; (3) verified count. " +
        "EVIDENCE: migration ran; post-run query SELECT count(*) WHERE country IS NULL = 0; re-run left counts unchanged; reconciliation log attached.",
      expected: { verdict: "pass" },
      scorerId: "json-field-match",
    },

    // ── MISSING A CRITERION → "needs_work" (one acceptance lens demonstrably unmet) ───────────────────────
    {
      id: "missing-tests-login",
      class: "VERIFY",
      input:
        "GOAL: add a POST /login endpoint. ACCEPTANCE: (1) returns 200 + token on valid creds; (2) returns 401 on bad creds; " +
        "(3) covered by tests. EVIDENCE: endpoint merged in PR#12 and works in manual testing. No automated tests were added.",
      expected: { verdict: "needs_work" },
      scorerId: "json-field-match",
    },
    {
      id: "missing-empty-set-export",
      class: "VERIFY",
      input:
        "GOAL: export invoices to CSV. ACCEPTANCE: (1) CSV has all invoice fields; (2) handles empty set; (3) documented. " +
        "EVIDENCE: exporter.ts merged; test covers the populated case and all fields; README added. The empty-invoice-set case is not handled and throws.",
      expected: { verdict: "needs_work" },
      scorerId: "json-field-match",
    },
    {
      id: "missing-reset-rate-limit",
      class: "VERIFY",
      input:
        "GOAL: rate-limit the public API to 100 req/min. ACCEPTANCE: (1) 101st request gets 429; (2) resets each minute; (3) load-tested. " +
        "EVIDENCE: middleware merged; test asserts 429 at the 101st request. There is no test or evidence that the window resets, and load testing was skipped.",
      expected: { verdict: "needs_work" },
      scorerId: "json-field-match",
    },
    {
      id: "missing-docs-toggle",
      class: "VERIFY",
      input:
        "GOAL: add a dark-mode toggle, documented for users. ACCEPTANCE: (1) toggle persists; (2) all pages honor it; (3) user-facing docs updated. " +
        "EVIDENCE: toggle merged; persistence + visual tests pass across all pages. The user-facing documentation was not updated.",
      expected: { verdict: "needs_work" },
      scorerId: "json-field-match",
    },

    // ── AMBIGUOUS / UNBACKED EVIDENCE → "needs_work" (MUST fail-closed to not-pass) ───────────────────────
    {
      id: "ambiguous-it-works",
      class: "VERIFY",
      input:
        "GOAL: add a POST /login endpoint. ACCEPTANCE: (1) 200 + token on valid creds; (2) 401 on bad creds; (3) covered by tests. " +
        "EVIDENCE: \"it works, I tested it.\" No PR link, no test output, no observed status codes provided.",
      expected: { verdict: "needs_work" },
      scorerId: "json-field-match",
    },
    {
      id: "ambiguous-should-be-fine",
      class: "VERIFY",
      input:
        "GOAL: backfill the `country` column for all users. ACCEPTANCE: (1) zero null countries; (2) idempotent; (3) verified count. " +
        "EVIDENCE: \"the migration should be fine, it ran without errors.\" No post-run null count, no idempotency check, no reconciliation.",
      expected: { verdict: "needs_work" },
      scorerId: "json-field-match",
    },
    {
      id: "ambiguous-mostly-done",
      class: "VERIFY",
      input:
        "GOAL: rate-limit the public API to 100 req/min. ACCEPTANCE: (1) 429 past the cap; (2) resets each minute; (3) load-tested. " +
        "EVIDENCE: \"mostly done, just needs a final look.\" No test output, no load run, no observed behaviour at the cap.",
      expected: { verdict: "needs_work" },
      scorerId: "json-field-match",
    },

    // ── BROKEN / REGRESSED → "fail" (the work does not stand) ─────────────────────────────────────────────
    {
      id: "broken-login-500",
      class: "VERIFY",
      input:
        "GOAL: add a POST /login endpoint. ACCEPTANCE: (1) 200 + token on valid creds; (2) 401 on bad creds; (3) covered by tests. " +
        "EVIDENCE: endpoint merged; login.test.ts FAILS 3/8 — valid creds return HTTP 500, not 200; CI is red on this branch.",
      expected: { verdict: "fail" },
      scorerId: "json-field-match",
    },
    {
      id: "broken-export-regression",
      class: "VERIFY",
      input:
        "GOAL: export invoices to CSV. ACCEPTANCE: (1) CSV has all fields; (2) empty set handled; (3) existing invoice list still renders. " +
        "EVIDENCE: exporter merged, but the shared query change broke the invoice LIST page (now 500s); 4 previously-green list tests now fail.",
      expected: { verdict: "fail" },
      scorerId: "json-field-match",
    },
  ],
};
