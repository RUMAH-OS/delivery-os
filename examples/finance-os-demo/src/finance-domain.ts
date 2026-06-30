// =============================================================================
// FINANCE OS — the consumer's OWN domain (brand-new; NOT admin's property/invoice/lead probes).
// =============================================================================
// THE EXTRACTION PROOF, consumer half: this file defines a FINANCE business domain that the Delivery OS
// governance platform has never seen. It declares two MetricProbe DESCRIPTORS over a fictional finance schema
// (a SaaS subscriptions + invoices ledger), the goal acceptance shapes, and the H1 budget envelope. Nothing
// here is lifted from rumah-admin — the metric ids (`monthly-recurring-revenue`, `invoices-collected-ratio`),
// the SQL targets, and the credential ref (`FINANCE_RO_URL`) are this consumer's own.
//
// IMPORTS: ONLY the vendored governance-engine barrel. ZERO rumah-admin / property-lead-os imports.
// (The MetricProbe descriptor type + the ProbeRegistry are PLATFORM types; the descriptors are DOMAIN data.)

import {
  ProbeRegistry,
  type MetricProbe,
  type BudgetCap,
  type AcceptanceShape,
} from "../vendor/governance-engine/index.js";

// ── The finance metric PROBES (the consumer's own least-privilege, read-only descriptors) ──────────────────
// Each is a single read-only SELECT over the consumer's (fictional) finance schema. They are NEVER admin's
// probes — a brand-new domain. The platform's `assertReadOnlyTarget` (L3) accepts them; the consumer would
// supply a `FINANCE_RO_URL` read-only role at invoke time (L1/L2). In this in-memory proof the lifecycle reads
// the metric through the injected observe/reprobe seams, but the descriptors are REGISTERED so the platform's
// C9 pre-flight gate can confirm the metric source exists + is version-pinned (no latest-fallback).

/** MRR — the finance North-Star scalar. "What is our active monthly recurring revenue, in euros?" */
export const MRR_PROBE: MetricProbe = {
  probe_id: "monthly-recurring-revenue",
  version: 1,
  metric_kind: "scalar",
  type: "sql",
  target:
    "SELECT coalesce(sum(amount_cents), 0)::numeric / 100 AS value " +
    "FROM finance_subscription WHERE status = 'active'",
  expected_shape: "1 row, col value::numeric (euros)",
  credential_ref: "FINANCE_RO_URL",
  extract: (rows) => Number((rows[0] as { value?: unknown } | undefined)?.value ?? null),
};

/** Invoices-collected ratio — "what fraction of issued invoices are paid?" (0..1). The stall goal's metric. */
export const INVOICES_COLLECTED_PROBE: MetricProbe = {
  probe_id: "invoices-collected-ratio",
  version: 1,
  metric_kind: "ratio",
  type: "sql",
  target:
    "SELECT (count(*) FILTER (WHERE status = 'paid'))::numeric / nullif(count(*), 0) AS value " +
    "FROM finance_invoice",
  expected_shape: "1 row, col value::numeric in [0,1]",
  credential_ref: "FINANCE_RO_URL",
  extract: (rows) => Number((rows[0] as { value?: unknown } | undefined)?.value ?? null),
};

/** Build a fresh registry holding ONLY this consumer's finance probes (no admin probe is ever registered). */
export function financeProbeRegistry(): ProbeRegistry {
  return new ProbeRegistry().register(MRR_PROBE).register(INVOICES_COLLECTED_PROBE);
}

// ── The finance goal envelopes (acceptance + H1 budget) ────────────────────────────────────────────────────

/** The finance H1 budget envelope (the GS dEffort denominator). The consumer owns these numbers. */
export const FINANCE_BUDGET: BudgetCap = { max_turns: 120, max_cost_cents: 12_000 };

/** Acceptance for the MRR growth goal: reach >= €50,000 MRR (increasing). */
export const MRR_ACCEPTANCE: AcceptanceShape = { op: ">=", target: 50_000, direction: "increase" };
export const MRR_TARGET = 50_000;

/** Acceptance for the invoice-collection goal: collect 100% of issued invoices (ratio reaches 1.0). */
export const COLLECTION_ACCEPTANCE: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };
