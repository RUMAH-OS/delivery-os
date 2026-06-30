// Governance Engine — C9 Pre-flight Gate REGRESSION self-test, ported VERBATIM from the VERIFIED admin harness
// (`rumah-admin/scripts/preflight-gate-c9.ts --self-test`) and run against the INVERTED organ + injected ports.
//
// THE PROOF THIS FILE EXISTS TO MAKE: the five static-feasibility verdicts (MEASURABLE / WELL-FORMED ACCEPTANCE
// / BUDGET / CAPABILITY READINESS / REACHABILITY) are BYTE-FOR-BYTE unchanged after the `makeIConfigReadiness()`
// execFileSync default was removed. Cases (A)-(G) are copied verbatim from the admin harness; the ONLY edits are
// the import paths and the injected `ConfigReadinessPort` fakes (which the admin cases ALREADY injected). The
// admin harness's section (H) exercised the REAL execFileSync oracle — that plane wiring is now CONSUMER-side, so
// it is replaced here by (H') a RESIDENCY proof: with required keys and NO ConfigReadinessPort injected, the gate
// FAILS CLOSED (it never falls back to a DB/plane default). Same inputs ⇒ same verdicts.
//
// Run:  tsx preflight-self-test.ts   ·   exit 0 = the inverted gate matches the verified gate · 1 = drift.

import { ProbeRegistry, type MetricProbe } from "../metric-probe.js";
import {
  evaluatePreflight,
  type PreflightGoal,
  type PreflightContext,
} from "../preflight.js";
import type { ConfigReadinessFn } from "../ports.js";
import { evaluateReachability, type ReachabilityVerdict } from "../reachability-evaluator.js";

const ENV = "dev";
const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });

async function main() {
  // A real, registered, version-pinned probe (the MEASURABLE dependency).
  const registry = new ProbeRegistry();
  const probe: MetricProbe = {
    probe_id: "selftest-coverage", version: 1, metric_kind: "ratio", type: "sql",
    target: "SELECT 1 AS value", expected_shape: "1 row, col value::numeric", credential_ref: "selftest-ro",
    extract: (rows) => Number((rows[0] as { value: number }).value),
  };
  registry.register(probe);

  // A reachable verdict that PASSES decideReachability (reachable=true, confidence ≥ θ).
  const reachableVerdict: ReachabilityVerdict = { reachable: true, confidence: 0.92, evidence: "precedent: 0.95 achieved before; levers available" };

  // Deterministic config-readiness fakes (the INJECTED ConfigReadinessPort — so the verdicts are stable, no plane).
  const allPresent: ConfigReadinessFn = async (_env, keys) => keys.map((key) => ({ key, state: "PRESENT" as const }));
  const oneMissing: ConfigReadinessFn = async (_env, keys) =>
    keys.map((key, i) => ({ key, state: (i === 0 ? "MISSING" : "PRESENT") as "MISSING" | "PRESENT" }));

  const baseGoal: PreflightGoal = {
    goalId: "selftest-goal",
    objective: "reach 95% invoice-delivery coverage",
    acceptanceMetric: "delivered_invoice_ratio",
    metricSourceProbeId: "selftest-coverage",
    metricSourceVersion: 1,
    budgetCap: { max_turns: 200, max_wallclock_seconds: 3600, max_cost_cents: 5000 },
    acceptance: { metric: "delivered_invoice_ratio", op: ">=", target: 0.95, direction: "increase" },
    requiredConfigKeys: ["DATABASE_URL"],
  };
  const baseCtx: PreflightContext = {
    targetEnv: ENV, probeRegistry: registry,
    reachability: { kind: "verdict", verdict: reachableVerdict },
    configReadiness: allPresent, theta: 0.7,
  };

  // ── (A) ADMIT — a fully-feasible goal: all five checks pass ──────────────────
  const admit = await evaluatePreflight(baseGoal, baseCtx);
  check("ADMIT: a fully-feasible goal is admitted", admit.admit === true && admit.blockers.length === 0);

  // ── (B) REFUSE: unmeasurable-metric (probe not registered) ───────────────────
  const rUnmeasurable = await evaluatePreflight({ ...baseGoal, metricSourceProbeId: "no-such-probe", metricSourceVersion: 9 }, baseCtx);
  check("REFUSE: unregistered probe → unmeasurable-metric", !rUnmeasurable.admit && rUnmeasurable.blockers.some((b) => b.code === "unmeasurable-metric"));

  // ── (C) REFUSE: ill-formed-acceptance (vacuous — no op/target) ───────────────
  const rIllFormed = await evaluatePreflight({ ...baseGoal, acceptance: { metric: "delivered_invoice_ratio" } }, baseCtx);
  check("REFUSE: vacuous acceptance → ill-formed-acceptance", !rIllFormed.admit && rIllFormed.blockers.some((b) => b.code === "ill-formed-acceptance"));

  // ── (D) REFUSE: no-budget (zero/absent budget) ───────────────────────────────
  const rNoBudget = await evaluatePreflight({ ...baseGoal, budgetCap: { max_turns: 0 } }, baseCtx);
  check("REFUSE: zero budget → no-budget", !rNoBudget.admit && rNoBudget.blockers.some((b) => b.code === "no-budget"));

  // ── (E) REFUSE: capability-not-ready (config not ready for the env) ──────────
  const rCapNotReady = await evaluatePreflight(baseGoal, { ...baseCtx, configReadiness: oneMissing });
  check("REFUSE: config MISSING → capability-not-ready", !rCapNotReady.admit && rCapNotReady.blockers.some((b) => b.code === "capability-not-ready"));

  // ── (F) REFUSE: statically-unreachable — the deterministic rule firing ────────
  const rUnreachableFalse = await evaluatePreflight(baseGoal, {
    ...baseCtx, reachability: { kind: "verdict", verdict: { reachable: false, confidence: 0.99, evidence: "target exceeds the historical max with no new lever" } },
  });
  check("REFUSE: reachable=false → statically-unreachable", !rUnreachableFalse.admit && rUnreachableFalse.blockers.some((b) => b.code === "statically-unreachable"));

  const rLowConfidence = await evaluatePreflight(baseGoal, {
    ...baseCtx, reachability: { kind: "verdict", verdict: { reachable: true, confidence: 0.4, evidence: "weak precedent" } },
  });
  check("REFUSE: confidence<θ → statically-unreachable (fail-closed)", !rLowConfidence.admit && rLowConfidence.blockers.some((b) => b.code === "statically-unreachable"));

  // ── (G) The DEFERRED LLM stays deferred — no silent dependency ───────────────
  const rDeferred = await evaluatePreflight(baseGoal, { targetEnv: ENV, probeRegistry: registry, configReadiness: allPresent });
  const reachCheck = rDeferred.checks.find((c) => c.check === "REACHABILITY");
  check("DEFERRED: default reachability fails CLOSED (LLM not silently relied on)", !rDeferred.admit && rDeferred.blockers.some((b) => b.code === "statically-unreachable"));
  check("DEFERRED: the blocker names the deferral honestly", !!reachCheck && /DEFERRED/.test(reachCheck.detail));
  let threw = false;
  try {
    await evaluateReachability({ metric: { description: "x", probeId: "p", probeVersion: 1 }, currentValue: null, historicalMax: null, availableLevers: [] });
  } catch { threw = true; }
  check("DEFERRED: evaluateReachability() throws (the §36.3 LLM evaluator is not built)", threw);

  // ── (H') RESIDENCY (replaces the admin harness's real-execFileSync section): with required keys and NO
  //         ConfigReadinessPort injected, the gate FAILS CLOSED — it never falls back to a DB/plane default. ──
  const rNoPort = await evaluatePreflight(baseGoal, { targetEnv: ENV, probeRegistry: registry, reachability: { kind: "verdict", verdict: reachableVerdict } });
  const capCheck = rNoPort.checks.find((c) => c.check === "CAPABILITY READINESS");
  check("RESIDENCY: required keys + NO ConfigReadinessPort injected → capability-not-ready (fail-closed, no plane default)",
    !rNoPort.admit && rNoPort.blockers.some((b) => b.code === "capability-not-ready") && !!capCheck && capCheck.pass === false);
  // and a goal with NO required keys still passes the readiness check with no port (no dependency to satisfy).
  const rNoKeys = await evaluatePreflight(
    { ...baseGoal, requiredConfigKeys: [] },
    { targetEnv: ENV, probeRegistry: registry, reachability: { kind: "verdict", verdict: reachableVerdict } },
  );
  check("RESIDENCY: a goal with NO required config keys passes readiness with no port injected (no dependency)",
    rNoKeys.admit === true && rNoKeys.blockers.length === 0);

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  console.log(`\ngovernance-engine C9 pre-flight self-test (verbatim ADMIT/REFUSE table + residency): ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
