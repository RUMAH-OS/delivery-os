// =============================================================================
// PLOS LEAD DOMAIN (BONUS) — a SECOND brand-new domain on the SAME vendored platform.
// =============================================================================
// THE N≥2 STRENGTHENER: the same vendored Delivery OS governance-engine serves a THIRD, unrelated domain — a
// property-lead-os style LEAD-QUALIFICATION goal. The metric is `qualified-leads-count` over PLOS lead data.
// Per the slice's bonus note, wiring the live `@plos/db` is out of scope; this uses a FIXTURE lead snapshot so
// the proof imports ONLY the platform engine + this domain (NO `@plos` / `property-lead-os` import — that would
// itself be a cross-app coupling). The point stands: a lead domain the platform has never seen runs to DONE.
//
// IMPORTS: ONLY the vendored governance-engine. ZERO rumah-admin / property-lead-os imports.

import {
  ProbeRegistry,
  type MetricProbe,
  type BudgetCap,
  type AcceptanceShape,
} from "../vendor/governance-engine/index.js";

/** Qualified-leads-count — "how many leads are in stage 'qualified' or beyond?" The lead-domain North Star. */
export const QUALIFIED_LEADS_PROBE: MetricProbe = {
  probe_id: "qualified-leads-count",
  version: 1,
  metric_kind: "count",
  type: "sql",
  target:
    "SELECT count(*)::numeric AS value FROM plos_lead " +
    "WHERE stage IN ('qualified', 'proposal', 'won')",
  expected_shape: "1 row, col value::numeric (count of qualified-or-better leads)",
  credential_ref: "PLOS_RO_URL",
  extract: (rows) => Number((rows[0] as { value?: unknown } | undefined)?.value ?? null),
};

export function plosProbeRegistry(): ProbeRegistry {
  return new ProbeRegistry().register(QUALIFIED_LEADS_PROBE);
}

/** The lead-org H1 budget envelope (the consumer owns these). */
export const PLOS_BUDGET: BudgetCap = { max_turns: 80, max_cost_cents: 8_000 };

/** Acceptance: reach >= 25 qualified leads (increasing count). */
export const QUALIFIED_LEADS_TARGET = 25;
export const QUALIFIED_LEADS_ACCEPTANCE: AcceptanceShape = { op: ">=", target: QUALIFIED_LEADS_TARGET, direction: "increase" };

// ── a FIXTURE PLOS lead snapshot (stands in for the live @plos/db read; the qualified count rises to the target) ──
export const PLOS_LEAD_FIXTURE_TRAJECTORY = [
  { cycle: 0, value: 10 },
  { cycle: 1, value: 15 },
  { cycle: 2, value: 20 },
  { cycle: 3, value: 23 },
];
