// =============================================================================
// THE PLAN GOLDEN SUITE — the planner organ's frozen gate (P2 slice 5, roadmap G-21).
// =============================================================================
// I17 — "intelligence measured, never assumed." This is the FROZEN golden set the eval harness replays to
// measure whichever model serves the PLAN class. It is the organ's gate: a model is not adoptable for PLAN
// until it is GREEN on these goldens (passesGate). Real-model scoring runs when a model is provisioned; the
// machinery + the goldens ship now so the organ is gated from day one.
//
// Each case is a real goal → the EXPECTED plan SHAPE, scored by `json-field-match` (structural subset match:
// only the fields named in `expected` are checked). A plan's raw output is a `{steps, disjointSurfaces,
// confidence, needs_clarification}` envelope; the goldens gate on the shape that matters per case:
//   · step COUNT       — `stepCount` (a derived field the scorer projects: steps.length);
//   · a VALID DAG      — `validDag:true` (a derived boolean: the output parses to a structurally valid DAG);
//   · disjoint surfaces — `surfaceCount` (steps split into N independent parallel workstreams);
//   · REFUSAL          — `needs_clarification:true` for goals too vague to decompose (refuse, don't guess).
// `stepCount`, `validDag`, and `surfaceCount` are DERIVED by the plan-shape scorer (plan-shape below), not
// literal output fields — so a case can gate on "a valid 3-step DAG" without pinning the exact ids/targets a
// model chooses. The vague cases gate on `needs_clarification:true` and are scored on the raw field.
//
// A suite is model-agnostic: it names NO model. The runner forces each candidate model over every case.

import type { EvalSuite, Scorer } from "../eval-case.js";
import { parsePlannerOutput } from "../../organs/planner.js";

/**
 * The `plan-shape` scorer — the PLAN suite's organ-specific scorer (NOT a built-in; the caller registers it
 * in runSuite via `scorers`). It runs the model output through the ORGAN'S OWN fail-closed parser
 * (parsePlannerOutput) — the exact code path the organ uses — and PROJECTS a derived shape:
 *   · validDag           — true iff the parser produced a structurally VALID plan (not needs_clarification);
 *   · stepCount          — steps.length (0 on a refusal);
 *   · surfaceCount       — disjointSurfaces.length (independent parallel workstreams);
 *   · needs_clarification — the organ refused (raw field).
 * Then it compares each field named in `expected` (a json-field-match subset over the DERIVED shape). This
 * lets a golden gate on "a valid 3-step DAG that splits into 2 surfaces" without pinning the exact ids/targets
 * a model chooses. Deterministic, side-effect-free. Fail-closed: a non-object `expected` fails the case.
 */
export const PLAN_SHAPE_SCORER: Scorer = (output, expected) => {
  if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
    return { score: 0, pass: false, detail: "plan-shape expects an object `expected`" };
  }
  const plan = parsePlannerOutput(output);
  const derived: Record<string, unknown> = {
    validDag: !plan.needs_clarification,
    stepCount: plan.steps.length,
    surfaceCount: plan.disjointSurfaces.length,
    needs_clarification: plan.needs_clarification,
  };
  const want = expected as Record<string, unknown>;
  const fields = Object.keys(want);
  if (fields.length === 0) return { score: 1, pass: true };
  const mismatches: string[] = [];
  let matched = 0;
  for (const f of fields) {
    if (JSON.stringify(derived[f]) === JSON.stringify(want[f])) matched++;
    else mismatches.push(`${f}: expected ${JSON.stringify(want[f])}, got ${JSON.stringify(derived[f])}`);
  }
  return { score: matched / fields.length, pass: matched === fields.length, detail: mismatches.length ? mismatches.join("; ") : undefined };
};

/** The frozen PLAN goldens. Ids are stable (a report keys failures by id). Scored by the `plan-shape` scorer
 *  (registered by the caller in runSuite — see planner-organ.test.ts), which projects the derived shape. */
export const PLAN_SUITE: EvalSuite = {
  class: "PLAN",
  cases: [
    // ── linear plans (a chain of steps) ─────────────────────────────────────────────────────────────────
    { id: "plan-single-step", class: "PLAN", input: "raise unit-test coverage on the billing module to 90%", expected: { validDag: true, stepCount: 1, needs_clarification: false }, scorerId: "plan-shape" },
    { id: "plan-linear-chain", class: "PLAN", input: "ship the invoicing feature end to end", expected: { validDag: true, stepCount: 3, needs_clarification: false }, scorerId: "plan-shape" },
    { id: "plan-migrate-then-verify", class: "PLAN", input: "migrate the customers table to the new schema then verify no rows lost", expected: { validDag: true, stepCount: 2, needs_clarification: false }, scorerId: "plan-shape" },

    // ── branching / fan-in plans (a real DAG, not just a chain) ──────────────────────────────────────────
    { id: "plan-fan-in", class: "PLAN", input: "build the API and the SPA, then wire them and deploy", expected: { validDag: true, stepCount: 4, needs_clarification: false }, scorerId: "plan-shape" },
    { id: "plan-diamond", class: "PLAN", input: "cut over to the new payments provider with a rehearsal and a rollback path", expected: { validDag: true, needs_clarification: false }, scorerId: "plan-shape" },

    // ── disjoint surfaces (independent workstreams that may proceed in parallel) ───────────────────────────
    { id: "plan-two-surfaces", class: "PLAN", input: "improve CI speed and separately reduce the onboarding email bounce rate", expected: { validDag: true, surfaceCount: 2, needs_clarification: false }, scorerId: "plan-shape" },

    // ── direction / op coverage (decrease + increase targets) ─────────────────────────────────────────────
    { id: "plan-decrease-target", class: "PLAN", input: "bring the p95 checkout latency down below 300ms", expected: { validDag: true, needs_clarification: false }, scorerId: "plan-shape" },
    { id: "plan-increase-target", class: "PLAN", input: "grow weekly active users above 1000", expected: { validDag: true, needs_clarification: false }, scorerId: "plan-shape" },

    // ── a longer plan (decomposition depth) ───────────────────────────────────────────────────────────────
    { id: "plan-deep", class: "PLAN", input: "harden the deploy pipeline: add tests, add a canary, add rollback, and add alerting", expected: { validDag: true, stepCount: 4, needs_clarification: false }, scorerId: "plan-shape" },

    // ── a plan that must simply be a VALID DAG (shape-agnostic on count) ───────────────────────────────────
    { id: "plan-valid-dag-any", class: "PLAN", input: "reduce the monthly infra bill without dropping any customer-facing SLA", expected: { validDag: true, needs_clarification: false }, scorerId: "plan-shape" },

    // ── VAGUE → needs_clarification (the organ must refuse to decompose, not guess a plan) ─────────────────
    { id: "vague-make-it-better", class: "PLAN", input: "make it better", expected: { validDag: false, needs_clarification: true }, scorerId: "plan-shape" },
    { id: "vague-do-the-needful", class: "PLAN", input: "do the needful", expected: { validDag: false, needs_clarification: true }, scorerId: "plan-shape" },
    { id: "vague-fix-everything", class: "PLAN", input: "fix everything that's wrong", expected: { validDag: false, needs_clarification: true }, scorerId: "plan-shape" },
    { id: "vague-sort-it-out", class: "PLAN", input: "just sort it out", expected: { needs_clarification: true }, scorerId: "plan-shape" },
  ],
};
