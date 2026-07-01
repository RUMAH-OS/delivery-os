#!/usr/bin/env tsx
// =============================================================================
// The PO auto-loop / goal-lifecycle controller (C2) — CLI (RS-DOS-v1 §4.3/§4.4/§15/§37.3). Sprint 5.2, first slice.
// =============================================================================
// SHADOW posture by default: runs a FIXTURE goal through its ENTIRE lifecycle (pure / in-memory — no DB, no
// live goal), prints the state path + the would-summons + the per-tick decisions, and EXITS 0. It mutates no
// live goal (there is no live goal-submission flow — Sprint 5.3) and spawns no real work (the executor is
// DEFERRED — Sprint 5.1).
//
//   (default)       SHADOW: walk the happy / stall / refuse fixtures through the lifecycle (report-only, exit 0).
//   --self-test     PURE, OFFLINE proof of the three lifecycle paths + idempotency + the DEFERRED executor +
//                   the no-second-mutator structural invariant (po-autoloop-c2.ts never calls transition()). No DB.
//   --db-self-test  drives REAL §4.3 transitions against TEST-DB FIXTURE goals (RUMAH_ENV=test forced): the full
//                   happy path → DONE; the stall path → HALTED + a summon; idempotent re-tick of a settled goal.
//                   This is the --enforce capability — TEST-DB fixtures only, never a live goal.
//   --facts <file>  run a supplied {goal, preflightCtx, …} lifecycle fixture in SHADOW (report-only).
//
//   --enforce  proves the real-transition CAPABILITY. OFF by default behind a loud banner: the enforce-flip that
//              mutates a LIVE goal is a FOUNDER ★ decision + the live goal flow (Sprint 5.3). Even with --enforce
//              this CLI operates on a TEST-DB fixture goal — NEVER a production goal.
// =============================================================================

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  runGoalLifecycle,
  tick,
  fixtureContractFromGoal,
  type LifecycleContext,
  type LifecycleResult,
  type TickRecord,
  type GoalSubmission,
  type SprintExecutor,
  type ObservedTickInput,
} from "../src/po-autoloop-c2.js";
import { ProbeRegistry, type MetricProbe } from "../src/metric-probe.js";
import type { PreflightGoal, PreflightContext } from "../src/preflight-gate-c9.js";
import type { ReachabilityVerdict } from "../src/reachability-evaluator.js";
import type { ProgressPoint, AcceptanceShape } from "../src/goal-supervisor-c7.js";

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = { selfTest: false, dbSelfTest: false, enforce: false, facts: null as string | null, json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--self-test") opts.selfTest = true;
  else if (a === "--db-self-test") { opts.dbSelfTest = true; opts.enforce = true; }
  else if (a === "--enforce") opts.enforce = true;
  else if (a === "--facts") opts.facts = String(argv[++i]);
  else if (a === "--json") opts.json = true;
  else if (a === "-h" || a === "--help") { process.stdout.write(usage()); process.exit(0); }
  else { process.stderr.write(`po-autoloop-c2: unknown flag "${a}" (try --help)\n`); process.exit(2); }
}

function usage(): string {
  return (
    "C2 PO auto-loop / goal-lifecycle controller (RS-DOS §4.3/§4.4/§15). SHADOW/report-only by default (exit 0).\n" +
    "Composes the seven goal-governance organs into one level-triggered loop. Mutates no live goal; spawns no real work.\n\n" +
    "  tsx scripts/po-autoloop-c2.ts                      # SHADOW: walk the happy / stall / refuse fixtures (exit 0)\n" +
    "  tsx scripts/po-autoloop-c2.ts --self-test          # pure offline: the 3 lifecycle paths + idempotency + invariants\n" +
    "  tsx scripts/po-autoloop-c2.ts --db-self-test       # real §4.3 transitions on TEST-DB fixtures (founder ★)\n" +
    "  tsx scripts/po-autoloop-c2.ts --facts <file.json>  # run a supplied lifecycle fixture in SHADOW\n"
  );
}

function enforceBanner(): void {
  const L = (s = "") => process.stderr.write(s + "\n");
  L("");
  L("============================================================================");
  L("  !! --enforce / --db-self-test — REAL §4.3 LIFECYCLE TRANSITION CAPABILITY !!");
  L("  The enforce-flip that runs a LIVE goal is a FOUNDER ★ decision and needs the");
  L("  goal-submission flow (Sprint 5.3) + the real Sprint Engine executor (5.1).");
  L("  This run operates ONLY on TEST-DB FIXTURE goals (RUMAH_ENV=test) — NO");
  L("  production goal is ever transitioned, and NO real work is spawned.");
  L("============================================================================");
  L("");
}

// =============================================================================
// Fixture builders — a registered probe, the ADMIT/REFUSE pre-flight contexts, and the per-tick observe seams.
// =============================================================================
const ACCEPTANCE: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };
const BUDGET = { max_turns: 100, max_cost_cents: 10000 };

function probeRegistry(): ProbeRegistry {
  const registry = new ProbeRegistry();
  const probe: MetricProbe = {
    probe_id: "invoice-delivery-coverage", version: 1, metric_kind: "ratio", type: "sql",
    target: "SELECT 1.0::numeric AS value", expected_shape: "1 row, col value::numeric",
    credential_ref: "PROBE_RO_URL", extract: (rows) => Number((rows[0] as any)?.value ?? null),
  };
  registry.register(probe);
  return registry;
}

const REACHABLE: ReachabilityVerdict = { reachable: true, confidence: 0.95, evidence: "100% delivery coverage is reachable; the lever (the delivery engine) exists and has precedent." };
const ALL_CONFIG_PRESENT = async () => []; // no required keys → CAPABILITY READINESS passes trivially

/** A FEASIBLE goal (admits at the pre-flight gate): a registered probe, a well-formed acceptance, a budget, a
 *  reachable verdict, ready config. */
function feasibleGoal(goalId: string): PreflightGoal {
  return {
    goalId, objective: "reach 100% invoice delivery coverage",
    acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage",
    metricSourceVersion: 1, budgetCap: BUDGET, acceptance: ACCEPTANCE, requiredConfigKeys: [],
  };
}
function feasiblePreflightCtx(): PreflightContext {
  return { targetEnv: "test", probeRegistry: probeRegistry(), configReadiness: ALL_CONFIG_PRESENT, reachability: { kind: "verdict", verdict: REACHABLE } };
}

/** An UNREACHABLE goal (refused at the pre-flight gate): an unregistered probe → unmeasurable-metric, and the
 *  DEFERRED reachability evaluator fails closed → statically-unreachable. */
function unreachableGoal(goalId: string): PreflightGoal {
  return {
    goalId, objective: "discover every off-market property in the city (unbounded, unmeasurable)",
    acceptanceMetric: "off_market_properties_found", metricSourceProbeId: "no-such-probe",
    metricSourceVersion: 1, budgetCap: { max_turns: 50 }, acceptance: { op: ">=", target: 1, direction: "increase" },
  };
}
function unreachablePreflightCtx(): PreflightContext {
  return { targetEnv: "test" }; // default reachability = the DEFERRED evaluator → fail-closed
}

/** An observe provider that replays a scripted trajectory of {value, attempts, cost} per tick (the GS's external
 *  re-read — the executor that WOULD produce it is deferred). The last entry repeats for any extra ticks. */
function trajectory(points: Array<{ value: number | null; attempts: number; cost: number; fixRef?: string }>, startCycle: number) {
  return async (_goalId: string, tickIndex: number): Promise<ObservedTickInput> => {
    const p = points[Math.min(tickIndex, points.length - 1)]!;
    return { cycle: startCycle + tickIndex, metricValue: p.value, attempts: p.attempts, cumulativeCostCents: p.cost, fixRef: p.fixRef ?? null };
  };
}

// The happy fixture: a rising history (the deferred executor's earlier sprints) then a met re-read.
function happyContext(reprobeValue = 1.0): LifecycleContext {
  return {
    acceptance: ACCEPTANCE, budgetCap: BUDGET,
    seedProgress: [{ cycle: 0, value: 0.3 }, { cycle: 1, value: 0.5 }, { cycle: 2, value: 0.7 }, { cycle: 3, value: 0.9 }],
    observe: trajectory([{ value: 1.0, attempts: 60, cost: 6000 }, { value: 1.0, attempts: 62, cost: 6200 }], 4),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: reprobeValue, note: "independent re-probe (injected fixture)" }) },
    maxTicks: 6,
  };
}

// The stall fixture: a flat history + a flat, expensive re-read (effort spent, no movement) → the GS trips.
function stallContext(): LifecycleContext {
  return {
    acceptance: ACCEPTANCE, budgetCap: BUDGET,
    seedProgress: [
      { cycle: 0, value: 0.42, fixRef: "retry-discovery" }, { cycle: 1, value: 0.42, fixRef: "retry-discovery" }, { cycle: 2, value: 0.42, fixRef: "retry-discovery" },
    ],
    observe: trajectory([
      { value: 0.42, attempts: 80, cost: 9000, fixRef: "retry-discovery" }, { value: 0.42, attempts: 82, cost: 9100, fixRef: "retry-discovery" },
    ], 3),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: 0.42, note: "independent re-probe (injected fixture)" }) },
    maxTicks: 6,
  };
}

// =============================================================================
// Report
// =============================================================================
function printLifecycle(r: LifecycleResult, label?: string): void {
  const L = (s = "") => process.stdout.write(s + "\n");
  if (label) L(`──────── ${label} ────────`);
  L(`phase:      ${r.phase}   posture ${r.posture}`);
  L(`goal:       ${r.goalId ?? "(unsubmitted)"}`);
  L(`pre-flight: admit=${r.preflight.admit}${r.preflight.blockers.length ? ` · blockers: ${r.preflight.blockers.map((b) => b.code).join(", ")}` : ""}`);
  L(`ramp:       ${r.ramp}`);
  if (r.statePath.length) L(`state path: ${r.statePath.join(" → ")}${r.finalState ? `   (final: ${r.finalState})` : ""}`);
  for (const t of r.ticks) printTick(t);
  if (r.summons.length) {
    L(`summons (${r.summons.length}):`);
    for (const s of r.summons) L(`   · [${s.boundary_class}] source ${s.source} → delivered_via ${s.delivered_via}${s.escalated ? " (escalated)" : ""}  dropped=${s.dropped}`);
  } else {
    L(`summons:    (none)`);
  }
  L("");
}

function printTick(t: TickRecord): void {
  const L = (s = "") => process.stdout.write(s + "\n");
  const o = t.observed;
  L(`  tick ${t.tickIndex} @ ${t.stateBefore.padEnd(9)} → ${t.stateAfter.padEnd(9)}  DECISION ${t.plan.decision}`);
  L(`     executor:  ${t.executor}`);
  L(`     observed:  metric=${o.metricValue ?? "n/a"} · ${o.attempts} attempts / ${o.cumulativeCostCents}¢ · ${o.observedCycles} cycles`);
  L(`     GS:        ${t.gsVerdict.verdict}${t.gsVerdict.trip ? " [TRIP]" : ""} — ${t.gsVerdict.reason}`);
  if (t.review) L(`     review C6: ${t.review.verdict} (independent re-probe ${t.review.evidence.reprobe.value}) → boundary REVIEWING→${t.reviewBoundary?.to} (${t.reviewBoundary?.guard}) — C6 GATES the DONE transition`);
  if (t.execution.applied_edge) L(`     transition:${t.execution.applied_edge.from}→${t.execution.applied_edge.to} (${t.execution.applied_edge.guard})  executed=${t.execution.executed}`);
  if (t.summon) L(`     SUMMON:    [${t.summon.boundary_class}] ${t.summon.source} → ${t.summon.delivered_via} (dropped=${t.summon.dropped})`);
}

// =============================================================================
// default — SHADOW: walk the happy / stall / refuse fixtures through the lifecycle (report-only, exit 0).
// =============================================================================
async function shadowDemo(): Promise<void> {
  const L = (s = "") => process.stdout.write(s + "\n");
  L("C2 PO auto-loop — SHADOW lifecycle walk (no DB, no live goal, no real work spawned).\n");

  const happy = await runGoalLifecycle({ goal: feasibleGoal("happy-fixture"), preflightCtx: feasiblePreflightCtx() }, happyContext());
  printLifecycle(happy, "HAPPY PATH — feasible → ADMIT → EXECUTING → met → C6 COMPLETE → DONE");

  const stall = await runGoalLifecycle({ goal: feasibleGoal("stall-fixture"), preflightCtx: feasiblePreflightCtx() }, stallContext());
  printLifecycle(stall, "STALL PATH — no progress → GS trips → reconciler HALT → summon");

  const refuse = await runGoalLifecycle({ goal: unreachableGoal("refuse-fixture"), preflightCtx: unreachablePreflightCtx() }, happyContext());
  printLifecycle(refuse, "REFUSE PATH — unreachable → pre-flight REFUSE → no contract → feasibility FAP summoned");

  L("SHADOW walk complete — exit 0 (drafted only; mutated nothing).");
  process.exit(0);
}

// =============================================================================
// --self-test — PURE, OFFLINE. The three lifecycle paths + idempotency + the DEFERRED executor + the
// no-second-mutator structural invariant. Real output. No DB.
// =============================================================================
async function selfTest(): Promise<void> {
  const L = (s = "") => process.stdout.write(s + "\n");
  const cases: Array<{ name: string; ok: boolean }> = [];
  const check = (name: string, ok: boolean) => cases.push({ name, ok });

  // ── (A) HAPPY PATH — feasible → ADMIT → EXECUTING → progressing ticks → met → C6 COMPLETE → reconciler DONE ──
  const happy = await runGoalLifecycle({ goal: feasibleGoal("happy"), preflightCtx: feasiblePreflightCtx() }, happyContext());
  printLifecycle(happy, "(A) HAPPY PATH");
  check("HAPPY: the goal is ADMITTED at the pre-flight gate", happy.phase === "ADMITTED" && happy.preflight.admit === true);
  check("HAPPY: the lifecycle reaches DONE", happy.finalState === "DONE");
  check("HAPPY: the state path is CREATED→EXECUTING→REVIEWING→DONE", happy.statePath.join(",") === "CREATED,EXECUTING,REVIEWING,DONE");
  check("HAPPY: C6 owned the DONE boundary with a COMPLETE verdict", happy.ticks.some((t) => t.review?.verdict === "COMPLETE"));
  check("HAPPY: the GS never tripped (the goal was confirmed advancing)", happy.ticks.every((t) => t.gsVerdict.trip === false));
  check("HAPPY: no summon fired (no boundary needed a founder decision)", happy.summons.length === 0);
  check("HAPPY: SHADOW mutated nothing (every apply executed:false)", happy.ticks.every((t) => t.execution.executed === false));

  // ── (B) STALL PATH — no progress → GS trips → reconciler executes the HALT → summon fired ──
  const stall = await runGoalLifecycle({ goal: feasibleGoal("stall"), preflightCtx: feasiblePreflightCtx() }, stallContext());
  printLifecycle(stall, "(B) STALL PATH");
  check("STALL: the goal is ADMITTED then governed", stall.phase === "ADMITTED");
  check("STALL: the GS tripped (effort-without-progress)", stall.ticks.some((t) => t.gsVerdict.trip === true));
  check("STALL: the reconciler decided EXECUTE_HALT (consuming the GS draft)", stall.ticks.some((t) => t.plan.decision === "EXECUTE_HALT"));
  check("STALL: the lifecycle reaches HALTED via EXECUTING→REVIEWING→HALTED", stall.finalState === "HALTED" && stall.statePath.join(",") === "CREATED,EXECUTING,REVIEWING,HALTED");
  check("STALL: exactly ONE feasibility/strategy summon fired (deduped across the halt path)", stall.summons.length === 1 && stall.summons[0]!.source === "goal-supervisor-c7" && stall.summons[0]!.boundary_class === "feasibility/strategy");
  check("STALL: the summon was NOT dropped", stall.summons[0]!.dropped === false);

  // ── (C) REFUSE PATH — unreachable → pre-flight REFUSE → no contract, refusal FAP summoned ──
  const refuse = await runGoalLifecycle({ goal: unreachableGoal("refuse"), preflightCtx: unreachablePreflightCtx() }, happyContext());
  printLifecycle(refuse, "(C) REFUSE PATH");
  check("REFUSE: the goal is REFUSED at the pre-flight gate", refuse.phase === "REFUSED_AT_PREFLIGHT" && refuse.preflight.admit === false);
  check("REFUSE: NO contract was created (refused at hour 0)", refuse.contract === null && refuse.ticks.length === 0);
  check("REFUSE: a refusal FAP was summoned (source preflight-gate-c9)", refuse.summons.length === 1 && refuse.summons[0]!.source === "preflight-gate-c9");
  check("REFUSE: the refusal summon was NOT dropped", refuse.summons[0]!.dropped === false);
  check("REFUSE: the blockers include unmeasurable-metric + statically-unreachable", refuse.preflight.blockers.some((b) => b.code === "unmeasurable-metric") && refuse.preflight.blockers.some((b) => b.code === "statically-unreachable"));

  // ── (D) IDEMPOTENT TICK — re-tick a SETTLED goal → a pure no-op (no transition, nothing observed) ──
  const doneContract = fixtureContractFromGoal(feasibleGoal("settled"), { state: "DONE" });
  let observedCalled = false;
  const settledTick = await tick(doneContract, {
    acceptance: ACCEPTANCE, budgetCap: BUDGET,
    observe: async () => { observedCalled = true; return { cycle: 0, metricValue: 1.0, attempts: 0, cumulativeCostCents: 0 }; },
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: 1.0 }) },
  }, 0);
  check("IDEMPOTENCY: re-ticking a DONE goal decides SETTLED (no transition)", settledTick.plan.decision === "SETTLED" && settledTick.execution.executed === false && settledTick.execution.applied_edge === null);
  check("IDEMPOTENCY: a settled tick observes nothing (no probe, no work — pure no-op)", observedCalled === false && settledTick.executor.startsWith("not invoked"));
  const haltedContract = fixtureContractFromGoal(feasibleGoal("settled2"), { state: "HALTED" });
  const haltedTick = await tick(haltedContract, { acceptance: ACCEPTANCE, budgetCap: BUDGET, observe: async () => ({ cycle: 0, metricValue: 0.42, attempts: 0, cumulativeCostCents: 0 }), review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: 0.42 }) } }, 0);
  check("IDEMPOTENCY: re-ticking a HALTED goal is SETTLED (settled states are terminal-for-the-loop)", haltedTick.plan.decision === "SETTLED" && haltedTick.execution.executed === false);

  // ── (E) THE EXECUTOR STAYS DEFERRED — no silent dependency on un-built work ──
  // Every governed tick records the executor as DEFERRED (the default runSprint throws). Prove it directly, and
  // prove an explicitly-injected runSprint that throws is caught (the governance still ticks).
  check("DEFERRED: every governed happy tick recorded the executor as DEFERRED (no real work spawned)", happy.ticks.every((t) => t.executor.startsWith("DEFERRED")));
  check("DEFERRED: every governed stall tick recorded the executor as DEFERRED", stall.ticks.every((t) => t.executor.startsWith("DEFERRED")));
  let sprintCalled = false;
  const throwingExecutor: SprintExecutor = { admitToExecuting: async () => { throw new Error("ramp DEFERRED"); }, runSprint: async () => { sprintCalled = true; throw new Error("runSprint DEFERRED for this test"); } };
  const ctxWithExec: LifecycleContext = { ...happyContext(), executor: throwingExecutor };
  const happyExec = await runGoalLifecycle({ goal: feasibleGoal("happy-exec"), preflightCtx: feasiblePreflightCtx() }, ctxWithExec);
  check("DEFERRED: an injected runSprint that throws is caught — the governance still reaches DONE", sprintCalled === true && happyExec.finalState === "DONE");

  // ── (G) THE B1 GUARD — the loop CANNOT self-certify done. A goal whose LOOP claims the metric is met (observe
  //       returns 1.0) but whose C6 INDEPENDENT re-probe returns 0.5 (below the frozen target) must end
  //       INCOMPLETE → PLANNING (never DONE), with NO contradictory "DONE + completion-review-INCOMPLETE summon"
  //       terminal. This reproduces the verifier's B1 fixture and is the goal-level twin of the GS's loop-can't-lie. ──
  const b1 = await runGoalLifecycle({ goal: feasibleGoal("b1-divergent"), preflightCtx: feasiblePreflightCtx() }, happyContext(0.5));
  printLifecycle(b1, "(G) B1 GUARD — loop-claims-1.0 / C6-reprobes-0.5 → INCOMPLETE → PLANNING, never DONE");
  check("B1: the goal NEVER reaches DONE (the loop cannot self-certify done over C6's independent re-probe)", b1.finalState !== "DONE" && !b1.statePath.includes("DONE"));
  check("B1: C6 INCOMPLETE gated the boundary to PLANNING (incomplete-but-reachable)", b1.finalState === "PLANNING" && b1.ticks.some((t) => t.review?.verdict === "INCOMPLETE" && t.reviewBoundary?.to === "PLANNING"));
  check("B1: NO contradictory terminal — no tick both transitions to DONE and carries an INCOMPLETE summon", !b1.ticks.some((t) => t.execution.applied_edge?.to === "DONE" && t.summon?.source === "completion-review-c6"));
  check("B1: the C6-gated boundary used C6's INDEPENDENT re-probe (0.5), not the loop's observed metric (1.0)", b1.ticks.some((t) => t.review !== null && t.review.evidence.reprobe.value === 0.5 && t.observed.metricValue === 1.0));
  // and the genuinely-met goal (C6 COMPLETE) still reaches DONE — the gate admits a truly-done goal.
  check("B1 (twin): a genuinely-met goal (C6 COMPLETE re-probe 1.0) STILL reaches DONE", happy.finalState === "DONE" && happy.ticks.some((t) => t.review?.verdict === "COMPLETE" && t.reviewBoundary?.to === "DONE"));

  // ── (F) NO SECOND MUTATOR (§15, structural) — src/po-autoloop-c2.ts NEVER imports/calls goal-contract.transition() ──
  const { readFileSync: rf } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const srcDir = resolve(here, "../src");
  const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const importsTransition = (code: string): boolean => /import\s*(?:type\s*)?\{[^}]*\btransition\b[^}]*\}\s*from\s*["'][^"']*goal-contract(?:\.js)?["']/.test(code);
  const stripImports = (code: string): string => code.replace(/import\s*(?:type\s*)?\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, "");
  const callsTransition = (code: string): number => (code.match(/(?:^|[^.\w])transition\s*\(/g) ?? []).length;
  const autoloopCode = stripComments(rf(resolve(srcDir, "po-autoloop-c2.ts"), "utf8"));
  L(`── (F) no-second-mutator scan: does src/po-autoloop-c2.ts import/call goal-contract.transition()? ──`);
  L(`  imports transition: ${importsTransition(autoloopCode)} · calls transition(): ${callsTransition(stripImports(autoloopCode))}`);
  L("");
  check("NO-SECOND-MUTATOR: the controller does NOT import goal-contract.transition (§15)", importsTransition(autoloopCode) === false);
  check("NO-SECOND-MUTATOR: the controller calls transition() ZERO times (mutation is ONLY via the reconciler)", callsTransition(stripImports(autoloopCode)) === 0);
  check("NO-SECOND-MUTATOR: the controller routes mutation through applyReconcilePlan (the reconciler's sole-mutator door)", /applyReconcilePlan\s*\(/.test(stripImports(autoloopCode)));

  // ── tally ──
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\nC2 PO auto-loop self-test: ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// =============================================================================
// --db-self-test — REAL §4.3 transitions against TEST-DB FIXTURE goals (the --enforce capability).
// =============================================================================
async function dbSelfTest(): Promise<void> {
  enforceBanner();
  process.env.RUMAH_ENV = "test"; // NEVER prod — force the test env loader
  const L = (s = "") => process.stdout.write(s + "\n");
  const cases: Array<{ name: string; ok: boolean }> = [];
  const check = (name: string, ok: boolean) => cases.push({ name, ok });

  const { sql } = await import("../src/db/client.js");
  const { readContract, transition } = await import("../src/goal-contract.js");
  const { recordAttempt, appendCost } = await import("../src/runtime-stores.js");

  // fail loud if 0052/0053 absent
  const [reg] = await sql`SELECT to_regclass('public.goal_contract') AS gc, to_regclass('public.goal_delta_ledger') AS gd`;
  if (!reg?.gc || !reg?.gd) { process.stderr.write("0052/0053 not applied — run `npm run db:test:migrate`\n"); process.exit(2); }

  const STAMP = `autoloop-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

  // The injected admission ramp: drive an admitted CREATED contract to EXECUTING via the LEGAL §4.3 edges (the
  // C2-MIND planner / Sprint 5.1 ramp is deferred — this is fixture setup, in scripts/, exactly as the reconciler
  // db-self-test sets up its EXECUTING fixtures). The controller calls this seam; it never transitions itself.
  const rampExecutor: SprintExecutor = {
    admitToExecuting: async (c) => {
      for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as const) await transition(c.goalId, to);
      return { state: "EXECUTING", transitions: ["CREATED→FEASIBILITY", "FEASIBILITY→ACTIVE", "ACTIVE→PLANNING", "PLANNING→EXECUTING"], note: "fixture legal-edge ramp (C2-MIND/C9 deferred — test setup)" };
    },
    runSprint: async () => { throw new Error("runSprint DEFERRED (Sprint 5.1)"); },
  };

  const submission = (goalId: string): GoalSubmission => ({
    goal: { ...feasibleGoal(goalId), objective: `${STAMP} — ${goalId}` },
    preflightCtx: { ...feasiblePreflightCtx(), targetEnv: "test" },
    createInput: {
      objective: `${STAMP} — ${goalId}`, acceptanceMetric: "delivered_invoice_ratio",
      metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: BUDGET,
    },
  });

  // ── (1) FULL HAPPY PATH → DONE (real transitions; C6 owns the DONE boundary) ──
  {
    const ctx: LifecycleContext = { ...happyContext(1.0), executor: rampExecutor, enforce: true, persistProgress: true };
    const r = await runGoalLifecycle(submission("happy"), ctx);
    printLifecycle(r, "(1) DB HAPPY PATH → DONE");
    const after = await readContract(r.goalId!);
    check("DB HAPPY: ADMITTED + ramped to EXECUTING via legal edges", r.phase === "ADMITTED" && r.statePath.includes("EXECUTING"));
    check("DB HAPPY: the durable contract reached DONE (real §4.3 transitions)", after!.state === "DONE" && r.finalState === "DONE");
    check("DB HAPPY: a real transition was executed (executed:true) by the reconciler", r.ticks.some((t) => t.execution.executed === true));
    check("DB HAPPY: C6 owned the DONE boundary (COMPLETE)", r.ticks.some((t) => t.review?.verdict === "COMPLETE"));
    check("DB HAPPY: the GS never tripped on the progressing goal", r.ticks.every((t) => t.gsVerdict.trip === false));
  }

  // ── (2) STALL PATH → HALTED + a summon (real transitions; the reconciler executes the GS HALT) ──
  // The lifecycle creates the contract, ramps it to EXECUTING (the injected legal-edge ramp), persists the
  // seeded + observed goal-delta samples to the durable goal_delta_ledger (runtime-stores), the GS trips on the
  // flat delta, and the reconciler drives EXECUTING→REVIEWING→HALTED. We also record a real durable attempt +
  // cost row (runtime-stores) to demonstrate the durable-store composition (the controller takes dEffort from the
  // observe provider, but the real ledgers are written through the sanctioned door).
  {
    const ctx: LifecycleContext = { ...stallContext(), executor: rampExecutor, enforce: true, persistProgress: true };
    const r = await runGoalLifecycle(submission("stall"), ctx);
    await recordAttempt({ goalId: r.goalId!, stepId: randomUUID(), attempt: 1, outcome: "retry" });
    await appendCost({ goalId: r.goalId!, costCents: 9000 });
    printLifecycle(r, "(2) DB STALL PATH → HALTED + summon");
    const after = await readContract(r.goalId!);
    check("DB STALL: ADMITTED + ramped to EXECUTING", r.phase === "ADMITTED" && r.statePath.includes("EXECUTING"));
    check("DB STALL: the GS tripped on the flat goal-delta", r.ticks.some((t) => t.gsVerdict.trip === true));
    check("DB STALL: the reconciler executed EXECUTE_HALT (the GS draft became a real transition)", r.ticks.some((t) => t.plan.decision === "EXECUTE_HALT" && t.execution.executed === true));
    check("DB STALL: the durable contract reached HALTED via EXECUTING→REVIEWING→HALTED", after!.state === "HALTED" && r.statePath.join(",") === "CREATED,EXECUTING,REVIEWING,HALTED");
    check("DB STALL: a feasibility/strategy summon fired and was not dropped", r.summons.length >= 1 && r.summons[0]!.source === "goal-supervisor-c7" && r.summons[0]!.dropped === false);
  }

  // ── (3) IDEMPOTENT re-tick of a settled (DONE) goal → no second transition ──
  {
    const ctx: LifecycleContext = { ...happyContext(1.0), executor: rampExecutor, enforce: true, persistProgress: true };
    const r = await runGoalLifecycle(submission("idem"), ctx);
    const settledState = (await readContract(r.goalId!))!.state;
    const reTick = await tick((await readContract(r.goalId!))!, ctx, 99);
    const afterReTick = (await readContract(r.goalId!))!.state;
    check("DB IDEMPOTENCY: the goal settled at DONE", settledState === "DONE");
    check("DB IDEMPOTENCY: re-ticking the settled goal is SETTLED, executes nothing", reTick.plan.decision === "SETTLED" && reTick.execution.executed === false);
    check("DB IDEMPOTENCY: the state is unchanged after the no-op re-tick (still DONE)", afterReTick === "DONE");
  }

  // ── (4) THE B1 GUARD (real DB) — loop-claims-1.0 / C6-reprobes-0.5 → durable PLANNING, NEVER DONE ──
  {
    const ctx: LifecycleContext = { ...happyContext(0.5), executor: rampExecutor, enforce: true, persistProgress: true };
    const r = await runGoalLifecycle(submission("b1"), ctx);
    printLifecycle(r, "(4) DB B1 GUARD — loop 1.0 / C6 0.5 → REVIEWING→PLANNING (never DONE)");
    const after = await readContract(r.goalId!);
    check("DB B1: the durable contract NEVER reached DONE (the loop cannot self-certify over C6)", after!.state !== "DONE" && !r.statePath.includes("DONE"));
    check("DB B1: C6 INCOMPLETE drove a REAL REVIEWING→PLANNING transition (the C6-gated edge)", after!.state === "PLANNING" && r.ticks.some((t) => t.review?.verdict === "INCOMPLETE" && t.execution.applied_edge?.to === "PLANNING" && t.execution.executed === true));
    check("DB B1: no contradictory DONE+INCOMPLETE-summon terminal", !r.ticks.some((t) => t.execution.applied_edge?.to === "DONE" && t.summon?.source === "completion-review-c6"));
  }

  await sql.end();
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\nC2 PO auto-loop DB self-test: ${cases.length - failed.length}/${cases.length} passed (TEST-DB fixtures; no live goal).`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// =============================================================================
// --facts — run a supplied lifecycle fixture in SHADOW.
// =============================================================================
async function runFacts(path: string): Promise<void> {
  if (opts.enforce) enforceBanner();
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    goal: PreflightGoal; preflightCtx?: Partial<PreflightContext>;
    acceptance?: AcceptanceShape; budgetCap?: any; seedProgress?: ProgressPoint[];
    observe: Array<{ value: number | null; attempts: number; cost: number; fixRef?: string }>; startCycle?: number; reprobe?: number;
  };
  const acceptance = raw.acceptance ?? ACCEPTANCE;
  const ctx: LifecycleContext = {
    acceptance, budgetCap: raw.budgetCap ?? BUDGET, seedProgress: raw.seedProgress ?? [],
    observe: trajectory(raw.observe, raw.startCycle ?? 0),
    review: { acceptance, reprobe: async () => ({ value: raw.reprobe ?? null, note: "injected fixture re-probe" }) },
    maxTicks: 8,
  };
  const preflightCtx: PreflightContext = { targetEnv: "test", probeRegistry: probeRegistry(), configReadiness: ALL_CONFIG_PRESENT, reachability: { kind: "verdict", verdict: REACHABLE }, ...(raw.preflightCtx as any) };
  const r = await runGoalLifecycle({ goal: raw.goal, preflightCtx }, ctx);
  if (opts.json) process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  else printLifecycle(r);
  process.exit(0); // SHADOW report-only — mutates nothing.
}

// ── entrypoint ─────────────────────────────────────────────────────────────────
if (opts.selfTest) {
  selfTest().catch((e) => { process.stderr.write(`po-autoloop-c2: ${e?.stack ?? e}\n`); process.exit(2); });
} else if (opts.dbSelfTest) {
  dbSelfTest().catch((e) => { process.stderr.write(`po-autoloop-c2: ${e?.stack ?? e}\n`); process.exit(2); });
} else if (opts.facts) {
  runFacts(opts.facts).catch((e) => { process.stderr.write(`po-autoloop-c2: ${(e as Error)?.stack ?? e}\n`); process.exit(2); });
} else {
  shadowDemo().catch((e) => { process.stderr.write(`po-autoloop-c2: ${e?.stack ?? e}\n`); process.exit(2); });
}
