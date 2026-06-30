// Governance Engine — Completion Review (C6) REGRESSION self-test, run against the INVERTED organ + injected
// re-probe seams (a fake re-read AND the package's `invokeProbe` over an IN-MEMORY `ProbeReaderPort`). NO DB.
//
// THE PROOF THIS FILE EXISTS TO MAKE: the FAIL-CLOSED DONE-gate is BYTE-FOR-BYTE preserved after the contract-row
// type moved to `./ports.js`, `acceptanceMet` is reused from the inverted `./reconciler.js`, and the re-probe
// substrate is the driver-free `./metric-probe.js`. The verdict is COMPLETE in EXACTLY ONE positively-proven
// state (well-formed acceptance ∧ re-probe ok ∧ finite ∧ meets the frozen target); EVERY other state — malformed
// acceptance, a failed/non-finite re-probe, a not-met value, a loop that CLAIMS done but whose independent
// re-read disagrees — yields INCOMPLETE. "Cannot independently confirm done" is INCOMPLETE, never a silent
// COMPLETE. Same inputs ⇒ same verdicts.
//
// Run:  tsx completion-review-self-test.ts   ·   exit 0 = the inverted logic matches the verified logic.

import { reviewCompletion, type CompletionReviewContext } from "../completion-review.js";
import type { GoalContractRow } from "../ports.js";
import type { AcceptanceShape } from "../goal-supervisor.js";
import { ProbeRegistry, assertReadOnlyTarget, type MetricProbe } from "../metric-probe.js";
import type { CredentialResolver, ProbeReaderPort } from "../ports.js";

const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });

function fixtureContract(over: Partial<GoalContractRow> = {}): GoalContractRow {
  const now = new Date();
  return {
    goalId: "c6-fixture", objective: "reach 100% invoice delivery coverage",
    acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage",
    metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: { max_turns: 100, max_cost_cents: 10000 },
    goalDeltaLedgerRef: "c6-fixture", state: "REVIEWING", prevState: "EXECUTING",
    createdAt: now, updatedAt: now, ...over,
  };
}

const target: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };

// in-memory ProbeReaderPort (the package re-probe path; NO postgres) returning a fixed value.
function fakeResolver(value: number | null): CredentialResolver {
  return async (_ref: string): Promise<ProbeReaderPort> => ({
    async read(t: string) { assertReadOnlyTarget(t); return [{ value }]; },
    async close() {},
  });
}

async function main() {
  const contract = fixtureContract();

  // ── (A) the ONE COMPLETE state — well-formed ∧ re-probe ok ∧ finite ∧ meets the target ──
  const rOk = await reviewCompletion(contract, { acceptance: target, reprobe: async () => ({ value: 1.0 }) });
  check("COMPLETE: well-formed + independent re-read 1.0 meets '>= 1.0' → COMPLETE", rOk.verdict === "COMPLETE" && rOk.complete === true);
  check("COMPLETE: the evidence marks it INDEPENDENT (re-probed, not the loop's claim)", rOk.evidence.independent === true && rOk.evidence.reprobeSound === true && rOk.evidence.met === true);

  // ── (B) NOT MET — a sound, finite re-read that does not reach the target → INCOMPLETE ──
  const rNotMet = await reviewCompletion(contract, { acceptance: target, reprobe: async () => ({ value: 0.42 }) });
  check("INCOMPLETE: re-read 0.42 does NOT satisfy '>= 1.0' → INCOMPLETE", rNotMet.verdict === "INCOMPLETE" && rNotMet.evidence.met === false);

  // ── (C) FAILED RE-PROBE — the independent re-read throws → unconfirmable → fail-closed INCOMPLETE ──
  const rFailed = await reviewCompletion(contract, { acceptance: target, reprobe: async () => { throw new Error("probe down"); } });
  check("INCOMPLETE: a FAILED re-probe is unconfirmable → fail-closed INCOMPLETE", rFailed.verdict === "INCOMPLETE" && rFailed.evidence.reprobe.ok === false && rFailed.evidence.reprobeSound === false);

  // ── (D) NON-FINITE / NULL RE-READ — cannot confirm → fail-closed INCOMPLETE ──
  const rNaN = await reviewCompletion(contract, { acceptance: target, reprobe: async () => ({ value: Number.NaN }) });
  check("INCOMPLETE: a non-finite (NaN) re-read → fail-closed INCOMPLETE", rNaN.verdict === "INCOMPLETE" && rNaN.evidence.reprobeSound === false);
  const rNull = await reviewCompletion(contract, { acceptance: target, reprobe: async () => ({ value: null }) });
  check("INCOMPLETE: a null re-read → fail-closed INCOMPLETE", rNull.verdict === "INCOMPLETE" && rNull.evidence.reprobeSound === false);

  // ── (E) MALFORMED ACCEPTANCE — no comparable target can ever be confirmed done → INCOMPLETE ──
  const rNoOp = await reviewCompletion(contract, { acceptance: {} as AcceptanceShape, reprobe: async () => ({ value: 1.0 }) });
  check("INCOMPLETE: a malformed acceptance (no op/target) → INCOMPLETE even with a 'good' re-read", rNoOp.verdict === "INCOMPLETE" && rNoOp.evidence.acceptanceWellFormed === false);
  // contradictory shape (op<= + direction increase) is malformed → INCOMPLETE.
  const rContradiction = await reviewCompletion(contract, { acceptance: { op: "<=", target: 0.1, direction: "increase" }, reprobe: async () => ({ value: 0.05 }) });
  check("INCOMPLETE: a contradictory acceptance (op<= + dir increase) is malformed → INCOMPLETE", rContradiction.verdict === "INCOMPLETE" && rContradiction.evidence.acceptanceWellFormed === false);

  // ── (F) THE LOOP CANNOT SELF-CERTIFY — C6's OWN re-read overrides a 'done' claim. We pass a re-read of 0.40
  //        (the independent truth is flat) even though a caller might claim the goal reached 1.0 → INCOMPLETE. ──
  const rLie = await reviewCompletion(contract, { acceptance: target, reprobe: async () => ({ value: 0.40, note: "independent re-read: flat truth, not the loop's 1.0 claim" }) });
  check("INCOMPLETE: the independent re-read (0.40) drives the verdict, not a loop 'done' claim → INCOMPLETE", rLie.verdict === "INCOMPLETE" && rLie.evidence.reprobe.value === 0.40);

  // ── (G) PORT-COMPOSITION — the DEFAULT re-probe via invokeProbe over the IN-MEMORY ProbeReaderPort (zero
  //        Postgres). A registered, version-pinned probe re-reads 1.0 → COMPLETE; 0.5 → INCOMPLETE. ──
  const registry = new ProbeRegistry();
  const probe: MetricProbe = {
    probe_id: "invoice-delivery-coverage", version: 1, metric_kind: "ratio", type: "sql",
    target: "SELECT value FROM coverage", expected_shape: "1 row, col value", credential_ref: "c6-ro",
    extract: (rows) => Number((rows[0] as { value: number }).value),
  };
  registry.register(probe);
  const ctxComplete: CompletionReviewContext = { acceptance: target, resolver: fakeResolver(1.0), registry };
  const rPortComplete = await reviewCompletion(contract, ctxComplete);
  check("PORT COMPLETE: the default invokeProbe re-read (1.0) over the in-memory ProbeReaderPort → COMPLETE", rPortComplete.verdict === "COMPLETE");
  const rPortIncomplete = await reviewCompletion(contract, { acceptance: target, resolver: fakeResolver(0.5), registry });
  check("PORT INCOMPLETE: the default invokeProbe re-read (0.5) does not meet the target → INCOMPLETE", rPortIncomplete.verdict === "INCOMPLETE");
  // no resolver + no reprobe wired → the default re-probe throws → unconfirmable → fail-closed INCOMPLETE.
  const rNoWire = await reviewCompletion(contract, { acceptance: target });
  check("PORT FAIL-CLOSED: no re-probe wired at all → unconfirmable → INCOMPLETE (never a silent COMPLETE)", rNoWire.verdict === "INCOMPLETE" && rNoWire.evidence.reprobe.ok === false);

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  console.log(`\ngovernance-engine C6 completion-review self-test (the ONE COMPLETE state + every fail-closed INCOMPLETE + port composition): ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
