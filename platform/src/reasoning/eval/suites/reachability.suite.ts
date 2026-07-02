// =============================================================================
// THE REACHABILITY GOLDEN SUITE — the reachability organ's frozen gate (P2 slice 6, roadmap G-22).
// =============================================================================
// I17 — "intelligence measured, never assumed." This is the FROZEN golden set the eval harness replays to
// measure whichever model serves the REACHABILITY class. It is the organ's gate: a model is not adoptable for
// REACHABILITY until it is GREEN on these goldens (passesGate). Real-model scoring runs when a model is
// provisioned; the machinery + the goldens ship now so the organ is gated from day one.
//
// Each case is a GOAL → the EXPECTED feasibility judgment, scored by `json-field-match` (structural subset
// match: only the fields named in `expected` are checked). The suite scores the model's RAW envelope, so the
// expected fields name what a GOOD model should EMIT ({reachable, uncertain}). Coverage of the three regimes
// the θ=0.7 fail-closed rule must separate:
//   · REACHABLE   — clearly-feasible goals → {reachable:true,  uncertain:false} (positively shown reachable);
//   · INFEASIBLE  — clearly-impossible goals → {reachable:false, uncertain:false} (confidently NOT reachable,
//                    with cited blockers the organ surfaces);
//   · BORDERLINE  — ambiguous / under-evidenced goals → {reachable:false, uncertain:true} — the model MUST hedge
//                    rather than over-claim, and the organ falls closed to reachable:false (never a coin-flip
//                    admit). This is the fail-closed heart: unsure ⇒ NOT reachable.
//
// A suite is model-agnostic: it names NO model. The runner forces each candidate model over every case.

import type { EvalSuite } from "../eval-case.js";

/** The frozen REACHABILITY goldens. Ids are stable (a report keys failures by id). */
export const REACHABILITY_SUITE: EvalSuite = {
  class: "REACHABILITY",
  cases: [
    // ── REACHABLE — the lever exists, precedent exists ⇒ confidently reachable ──────────────────────────────
    { id: "reach-fix-typo", class: "REACHABILITY", input: "fix a typo in the README", expected: { reachable: true, uncertain: false }, scorerId: "json-field-match" },
    { id: "reach-add-toggle", class: "REACHABILITY", input: "add a dark-mode toggle to the settings page", expected: { reachable: true, uncertain: false }, scorerId: "json-field-match" },
    { id: "reach-ship-invoicing", class: "REACHABILITY", input: "ship the invoicing feature — the delivery engine exists and has precedent", expected: { reachable: true, uncertain: false }, scorerId: "json-field-match" },
    { id: "reach-add-endpoint", class: "REACHABILITY", input: "add a GET /health endpoint to the API", expected: { reachable: true, uncertain: false }, scorerId: "json-field-match" },
    { id: "reach-raise-coverage", class: "REACHABILITY", input: "raise delivery coverage to 100% — the delivery engine is the lever and it exists", expected: { reachable: true, uncertain: false }, scorerId: "json-field-match" },

    // ── INFEASIBLE — no lever / physically or logically impossible ⇒ confidently NOT reachable ───────────────
    { id: "infeasible-faster-than-light", class: "REACHABILITY", input: "make the API respond faster than the speed of light allows", expected: { reachable: false, uncertain: false }, scorerId: "json-field-match" },
    { id: "infeasible-no-lever", class: "REACHABILITY", input: "double revenue by tomorrow with no product changes and no sales team", expected: { reachable: false, uncertain: false }, scorerId: "json-field-match" },
    { id: "infeasible-negative-latency", class: "REACHABILITY", input: "achieve negative request latency", expected: { reachable: false, uncertain: false }, scorerId: "json-field-match" },
    { id: "infeasible-perpetual-uptime", class: "REACHABILITY", input: "guarantee 100% uptime forever with a single server and no redundancy", expected: { reachable: false, uncertain: false }, scorerId: "json-field-match" },
    { id: "infeasible-solve-halting", class: "REACHABILITY", input: "write a program that decides the halting problem for all inputs", expected: { reachable: false, uncertain: false }, scorerId: "json-field-match" },

    // ── BORDERLINE — under-evidenced / ambiguous ⇒ the model HEDGES ⇒ fail-closed to NOT reachable ──────────
    { id: "borderline-vague-improve", class: "REACHABILITY", input: "improve the product", expected: { reachable: false, uncertain: true }, scorerId: "json-field-match" },
    { id: "borderline-migrate-unknown", class: "REACHABILITY", input: "migrate the database to a system we have not chosen yet", expected: { reachable: false, uncertain: true }, scorerId: "json-field-match" },
    { id: "borderline-scale-unknown", class: "REACHABILITY", input: "scale to a load we have never measured or specified", expected: { reachable: false, uncertain: true }, scorerId: "json-field-match" },
    { id: "borderline-integrate-tbd", class: "REACHABILITY", input: "integrate a third-party vendor that has not been selected", expected: { reachable: false, uncertain: true }, scorerId: "json-field-match" },
  ],
};
