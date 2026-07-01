#!/usr/bin/env tsx
// =============================================================================
// The Sprint Engine (C10 — the Evidence Cycle) — CLI (RS-DOS-v1 §9 / §7.2 / §17.4). Sprint 5.1, first slice.
// =============================================================================
// SHADOW posture by default: runs a STUB sprint (fixture spawner, fixture evidence) on the TEST DB, reports
// the evidence + attempts/cost + halted_at_cap, EXITS 0, spawns NO real agent, touches NO live goal.
//
//   (default)       SHADOW: run a couple of STUB sprints on TEST-DB fixtures (report-only, exit 0). The real
//                   work output is a fixture; the real worker/queue headless spawn is DEFERRED.
//   --self-test     PURE, OFFLINE proof (in-memory store fakes — no DB): the H1-cap bound (stops at the cap,
//                   ledger ≤ cap) · idempotent re-run (no double-spend) · the DEFERRED real spawner throws ·
//                   the abort→dead_letter surface · the §15 structural invariant (no transition() here).
//   --db-self-test  proves the capability against the REAL TEST DB (RUMAH_ENV=test forced): evidence is
//                   DURABLY written, the H1 cap bounds the REAL ledger (rows ≤ cap), an idempotent re-run does
//                   NOT double-spend, and the DEFERRED real spawner throws. TEST-DB fixtures only — no live goal.
//
//   --enforce  proves the real-spawn CAPABILITY surface. OFF by default behind a loud banner: the enforce-flip
//              that uses the REAL worker/queue headless spawn is a FOUNDER ★ decision + the V-H worker/queue
//              host (Sprint 5.3). EVEN WITH --enforce there is NO real agent — the real spawner stays DEFERRED
//              (it throws); --enforce runs the STUB against TEST-DB fixtures to prove the evidence cycle + cap.
// =============================================================================

import { randomUUID } from "node:crypto";
import {
  runSprint,
  makeStubSpawner,
  realWorkerQueueSpawn,
  realStores,
  asControllerHook,
  type SprintContext,
  type SprintStores,
  type SprintEvidence,
  type Spawner,
} from "../src/sprint-engine-c10.js";
import type { GoalContractRow, BudgetCap } from "../src/goal-contract.js";

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = { selfTest: false, dbSelfTest: false, enforce: false, json: false };
for (const a of argv) {
  if (a === "--self-test") opts.selfTest = true;
  else if (a === "--db-self-test") { opts.dbSelfTest = true; opts.enforce = true; }
  else if (a === "--enforce") opts.enforce = true;
  else if (a === "--json") opts.json = true;
  else if (a === "-h" || a === "--help") { process.stdout.write(usage()); process.exit(0); }
  else { process.stderr.write(`sprint-engine-c10: unknown flag "${a}" (try --help)\n`); process.exit(2); }
}

function usage(): string {
  return (
    "C10 Sprint Engine (the Evidence Cycle, RS-DOS §9). SHADOW/stub by default (exit 0). The unattended,\n" +
    "evidence-bounded executor: spawns work via an INJECTABLE spawner (the real worker/queue headless spawn is\n" +
    "DEFERRED), writes attempt/cost/progress EVIDENCE, and STOPS at the H1 cap. Mutates NO GoalContract state (§15).\n\n" +
    "  tsx scripts/sprint-engine-c10.ts                 # SHADOW: stub sprints on TEST-DB fixtures (exit 0)\n" +
    "  tsx scripts/sprint-engine-c10.ts --self-test     # pure offline: cap-bound + idempotency + deferred-spawn + §15\n" +
    "  tsx scripts/sprint-engine-c10.ts --db-self-test  # real TEST-DB evidence + the H1 cap bounds the real ledger\n"
  );
}

function enforceBanner(): void {
  const L = (s = "") => process.stderr.write(s + "\n");
  L("");
  L("============================================================================");
  L("  !! --enforce / --db-self-test — REAL-SPAWN CAPABILITY SURFACE !!");
  L("  enforce = founder ★ + the V-H worker/queue host (the REAL headless spawn).");
  L("  That host is DEFERRED: realWorkerQueueSpawn THROWS. This run spawns NO real");
  L("  agent — it runs the STUB spawner against TEST-DB fixtures (RUMAH_ENV=test) to");
  L("  prove the evidence cycle + the H1-cap bound. No live goal is ever touched.");
  L("============================================================================");
  L("");
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const BUDGET: BudgetCap = { max_turns: 5, max_cost_cents: 500 };

function fixtureContract(goalId: string, budget: BudgetCap = BUDGET, objective = "reach 100% invoice delivery coverage"): GoalContractRow {
  const now = new Date();
  return {
    goalId, objective, acceptanceMetric: "delivered_invoice_ratio",
    metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL",
    budgetCap: budget, goalDeltaLedgerRef: goalId, state: "EXECUTING", prevState: "PLANNING",
    createdAt: now, updatedAt: now,
  };
}

// ── report ───────────────────────────────────────────────────────────────────
function printSprint(r: SprintEvidence, label?: string): void {
  const L = (s = "") => process.stdout.write(s + "\n");
  if (label) L(`──────── ${label} ────────`);
  L(`goal:        ${r.goalId}   sprint ${r.sprintId}`);
  L(`H1 cap:      max_turns=${r.cap.maxTurns ?? "∞"} · max_cost_cents=${r.cap.maxCostCents ?? "∞"}`);
  L(`result:      ${r.result}${r.halted_at_cap ? "   [HALTED AT H1 CAP — ledger ≤ cap]" : ""}`);
  L(`evidence:    ${r.evidence.length} steps (${r.evidence.filter((e) => e.outcome === "advanced").length} advanced · ${r.evidence.filter((e) => e.outcome === "skipped").length} skipped · ${r.evidence.filter((e) => e.outcome === "aborted").length} aborted)`);
  for (const e of r.evidence) L(`   · step ${e.stepIndex} [${e.outcome}] ${e.costCents}¢ (cum ${e.cumulativeCostCents}¢) — ${e.note}`);
  L(`attemptsUsed:${r.attemptsUsed}   costUsed: ${r.costUsed}¢`);
  L(`progress:    ${r.progressSamples.map((p) => `cycle ${p.cycle}=${p.value ?? "n/a"}`).join(", ") || "(none)"}`);
  L("");
}

// =============================================================================
// In-memory store fakes (the SprintStores seam) — a faithful, race-light model of the 0052 doors for the PURE
// offline self-test (no DB). Mirrors the invariants the engine relies on: append-only attempt/cost, idempotent
// progress (goal_id+cycle), write-ahead-intent (reserve-once / consume-once), a durable-shaped breaker.
// =============================================================================
function inMemoryStores(): SprintStores & { _dump: () => any } {
  const attempts: Array<{ goalId: string | null; stepId: string; attempt: number; delta: number | null }> = [];
  const costs: Array<{ goalId: string; costCents: number; cumulative: number }> = [];
  const progress = new Map<string, { value: number | null }>(); // key goalId|cycle
  const intents = new Map<string, { consumed: boolean }>();
  const breakers = new Map<string, { state: "closed" | "open" | "half_open"; count: number }>();
  const deadLetters: Array<{ id: string; stepId: string; reason: string }> = [];

  return {
    async recordAttempt(a) {
      if (attempts.some((x) => x.stepId === a.stepId && x.attempt === a.attempt)) {
        throw new Error(`attempt_ledger unique (step_id, attempt) violated for ${a.stepId}/${a.attempt}`);
      }
      attempts.push({ goalId: a.goalId ?? null, stepId: a.stepId, attempt: a.attempt, delta: a.delta ?? null });
    },
    async countAttempts(goalId) { return attempts.filter((x) => x.goalId === goalId).length; },
    async appendCost(c) {
      const prior = costs.filter((x) => x.goalId === c.goalId).reduce((m, x) => Math.max(m, x.cumulative), 0);
      const cumulative = prior + c.costCents;
      costs.push({ goalId: c.goalId, costCents: c.costCents, cumulative });
      return { cumulativeCostCents: cumulative };
    },
    async readCumulativeCost(goalId) { return costs.filter((x) => x.goalId === goalId).reduce((m, x) => Math.max(m, x.cumulative), 0); },
    async appendProgressSample(s) {
      const k = `${s.goalId}|${s.cycle}`;
      if (progress.has(k)) return false; // idempotent on goal_id+cycle
      progress.set(k, { value: s.value ?? null });
      return true;
    },
    async reserveIntent(key) {
      if (intents.has(key)) return { reserved: false };
      intents.set(key, { consumed: false });
      return { reserved: true };
    },
    async consumeIntent(key) {
      const it = intents.get(key);
      if (!it || it.consumed) return { consumed: false };
      it.consumed = true;
      return { consumed: true };
    },
    async isConsumed(key) { return intents.get(key)?.consumed === true; },
    async recordFailure(stepId, o = {}) {
      const threshold = o.threshold ?? 3;
      const b = breakers.get(stepId) ?? { state: "closed" as const, count: 0 };
      b.count += 1;
      if (b.count >= threshold) b.state = "open";
      breakers.set(stepId, b);
      return { stepId, goalId: o.goalId ?? null, runId: null, breakerState: b.state, breakerCount: b.count, breakerCooldownUntil: null, updatedAt: new Date() };
    },
    async recordDeadLetter(d) { const id = randomUUID(); deadLetters.push({ id, stepId: d.stepId, reason: d.reason }); return id; },
    _dump: () => ({ attempts, costs, progress: [...progress.entries()], intents: [...intents.entries()], breakers: [...breakers.entries()], deadLetters }),
  };
}

// =============================================================================
// --self-test — PURE, OFFLINE. The H1-cap bound + idempotency + the DEFERRED spawner + abort→dead_letter +
// the §15 structural invariant. Real output. No DB.
// =============================================================================
async function selfTest(): Promise<void> {
  const L = (s = "") => process.stdout.write(s + "\n");
  const cases: Array<{ name: string; ok: boolean }> = [];
  const check = (name: string, ok: boolean) => cases.push({ name, ok });

  // ── (A) THE EVIDENCE CYCLE — a stub sprint produces evidence + advances the metric + records attempts/cost ──
  {
    const stores = inMemoryStores();
    const goalId = randomUUID();
    let probed = 0.6;
    const ctx: SprintContext = {
      stores, sprintId: "sprint-A", plannedSteps: 3, cycle: 10,
      spawn: makeStubSpawner({ costCentsPerStep: 100, metricDeltaPerStep: 0.1 }),
      reprobe: async () => (probed = 0.9), // the work moved the metric 0.6 → 0.9
    };
    const r = await runSprint(fixtureContract(goalId, { max_turns: 10, max_cost_cents: 10000 }), ctx);
    printSprint(r, "(A) EVIDENCE CYCLE — stub sprint produces evidence + advances the metric");
    check("EVIDENCE: 3 steps advanced (work output produced)", r.evidence.filter((e) => e.outcome === "advanced").length === 3);
    check("EVIDENCE: attempts recorded in the ledger (3)", r.attemptsUsed === 3 && (await stores.countAttempts(goalId)) === 3);
    check("EVIDENCE: cost recorded cumulatively (300¢)", r.costUsed === 300 && (await stores.readCumulativeCost(goalId)) === 300);
    check("EVIDENCE: a ProgressSample (the re-probed movement) was appended", r.progressSamples.length === 1 && r.progressSamples[0]!.value === 0.9);
    check("EVIDENCE: result = objective_advanced, not halted_at_cap", r.result === "objective_advanced" && r.halted_at_cap === false);
  }

  // ── (B) THE H1 CAP BOUNDS IT (THE load-bearing property) — a sprint that WOULD run 20 steps stops at the cap ──
  {
    // turn-bound: max_turns=5 with 1 attempt/step → exactly 5 advanced, ledger == 5, never 20.
    const stores = inMemoryStores();
    const goalId = randomUUID();
    const ctx: SprintContext = {
      stores, sprintId: "sprint-B-turns", plannedSteps: 20, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 1, metricDeltaPerStep: 0.01 }),
      reprobe: async () => 0.5,
    };
    const r = await runSprint(fixtureContract(goalId, { max_turns: 5, max_cost_cents: 100000 }), ctx);
    printSprint(r, "(B1) H1 TURN CAP — 20 planned steps, max_turns=5 → STOPS at 5");
    check("CAP(turns): halted_at_cap = true", r.halted_at_cap === true && r.result === "halted_at_cap");
    check("CAP(turns): the attempt ledger is BOUNDED by max_turns (== 5, never 20)", (await stores.countAttempts(goalId)) === 5 && r.attemptsUsed === 5);
    check("CAP(turns): the ledger NEVER exceeds the cap (≤ 5)", (await stores.countAttempts(goalId)) <= 5);

    // cost-bound: max_cost_cents=500 with 200¢/step → 2 steps (400¢) fit, the 3rd (600¢) would breach → stop.
    const stores2 = inMemoryStores();
    const goalId2 = randomUUID();
    const ctx2: SprintContext = {
      stores: stores2, sprintId: "sprint-B-cost", plannedSteps: 20, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 200, metricDeltaPerStep: 0.01 }),
      reprobe: async () => 0.5,
    };
    const r2 = await runSprint(fixtureContract(goalId2, { max_turns: 1000, max_cost_cents: 500 }), ctx2);
    printSprint(r2, "(B2) H1 COST CAP — 200¢/step, max_cost_cents=500 → STOPS at 400¢ (3rd would breach)");
    check("CAP(cost): halted_at_cap = true", r2.halted_at_cap === true && r2.result === "halted_at_cap");
    check("CAP(cost): the cost ledger is BOUNDED by max_cost_cents (== 400, the 3rd step's 600¢ never appended)", (await stores2.readCumulativeCost(goalId2)) === 400 && r2.costUsed === 400);
    check("CAP(cost): the cost ledger NEVER exceeds the cap (≤ 500)", (await stores2.readCumulativeCost(goalId2)) <= 500);
  }

  // ── (C) IDEMPOTENCY — a re-run of the SAME sprint does NOT double-spend (write-ahead-intent) ──
  {
    const stores = inMemoryStores();
    const goalId = randomUUID();
    const mk = (): SprintContext => ({
      stores, sprintId: "sprint-C", plannedSteps: 3, cycle: 7,
      spawn: makeStubSpawner({ costCentsPerStep: 100 }), reprobe: async () => 0.8,
    });
    const first = await runSprint(fixtureContract(goalId, { max_turns: 100, max_cost_cents: 100000 }), mk());
    const second = await runSprint(fixtureContract(goalId, { max_turns: 100, max_cost_cents: 100000 }), mk());
    printSprint(first, "(C) IDEMPOTENCY — first run");
    printSprint(second, "(C) IDEMPOTENCY — re-run (same sprintId) → every step SKIPPED, no double-spend");
    check("IDEMPOTENCY: the first run advanced 3 steps (3 attempts / 300¢)", first.attemptsUsed === 3 && first.costUsed === 300);
    check("IDEMPOTENCY: the re-run SKIPPED every step (idempotent)", second.evidence.every((e) => e.outcome === "skipped"));
    check("IDEMPOTENCY: the ledgers did NOT double-spend (still 3 attempts / 300¢)", (await stores.countAttempts(goalId)) === 3 && (await stores.readCumulativeCost(goalId)) === 300);
    check("IDEMPOTENCY: the re-run did not double-append the ProgressSample (cycle 7 already recorded)", second.progressSamples.length === 0);
  }

  // ── (D) ABORT → DEAD_LETTER — an aborted spawn SURFACES (not silently lost) ──
  {
    const stores = inMemoryStores();
    const goalId = randomUUID();
    const ctx: SprintContext = {
      stores, sprintId: "sprint-D", plannedSteps: 4, cycle: 0, breakerThreshold: 1,
      spawn: makeStubSpawner({ costCentsPerStep: 100, abortSteps: [1] }), // step 1 aborts; threshold 1 → open immediately
      reprobe: async () => 0.5,
    };
    const r = await runSprint(fixtureContract(goalId, { max_turns: 100, max_cost_cents: 100000 }), ctx);
    printSprint(r, "(D) ABORT → DEAD_LETTER — step 1 aborts → breaker opens → dead_letter surfaced");
    const aborted = r.evidence.find((e) => e.outcome === "aborted");
    check("ABORT: the aborted step surfaced a dead_letter (not silently lost)", !!aborted && !!aborted.deadLetterId);
    check("ABORT: result = aborted_dead_letter", r.result === "aborted_dead_letter");
    check("ABORT: the aborted step recorded NO attempt/cost (only the successful step 0 did)", r.attemptsUsed === 1 && r.costUsed === 100);
  }

  // ── (E) THE REAL SPAWNER STAYS DEFERRED — no silent dependency on the un-built worker/queue host ──
  {
    let threw = false;
    try {
      await realWorkerQueueSpawn({ goalId: "g", sprintId: "s", stepIndex: 0, stepId: "s::step::0", objective: "x", contractState: "EXECUTING" });
    } catch (e) { threw = (e as Error).message.includes("DEFERRED"); }
    check("DEFERRED: realWorkerQueueSpawn THROWS 'DEFERRED' (the V-H worker/queue host is not wired)", threw === true);

    // and a sprint whose spawner is the DEFAULT (deferred) surfaces the throw — it never silently no-ops.
    const stores = inMemoryStores();
    let sprintThrew = false;
    try {
      await runSprint(fixtureContract(randomUUID()), { stores, sprintId: "sprint-E", plannedSteps: 1, cycle: 0 });
    } catch (e) { sprintThrew = (e as Error).message.includes("DEFERRED"); }
    check("DEFERRED: a sprint with the DEFAULT spawner throws DEFERRED (no path silently spawns real work)", sprintThrew === true);
  }

  // ── (F) THE CONTROLLER SEAM FITS — asControllerHook is typed as the controller's DEFERRED_EXECUTOR.runSprint ──
  {
    const stores = inMemoryStores();
    const goalId = randomUUID();
    const hook = asControllerHook(
      async () => fixtureContract(goalId, { max_turns: 10, max_cost_cents: 10000 }),
      (input) => ({ stores, sprintId: `${input.goalId}:tick:${input.tickIndex}`, plannedSteps: 2, cycle: input.tickIndex, spawn: makeStubSpawner(), reprobe: async () => 0.9 }),
    );
    const out = await hook({ goalId, tickIndex: 0, contractState: "EXECUTING" });
    L(`── (F) controller seam — DEFERRED_EXECUTOR.runSprint(...) note ──`);
    L(`  ${out.note}\n`);
    check("SEAM: asControllerHook satisfies the controller's runSprint signature and returns a {note}", typeof out.note === "string" && out.note.length > 0);
    check("SEAM: the hook ran the real evidence cycle (the note reports advanced steps + cumulative cost)", /advanced/.test(out.note) && /¢/.test(out.note));
  }

  // ── (G) §15 UNTOUCHED (structural) — src/sprint-engine-c10.ts NEVER imports/calls goal-contract.transition() ──
  {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const srcFile = resolve(here, "../src/sprint-engine-c10.ts");
    const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const code = stripComments(readFileSync(srcFile, "utf8"));
    const stripImports = (c: string) => c.replace(/import\s*(?:type\s*)?\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, "");
    const importsTransition = /import\s*(?:type\s*)?\{[^}]*\btransition\b[^}]*\}\s*from\s*["'][^"']*goal-contract(?:\.js)?["']/.test(code);
    const callsTransition = (stripImports(code).match(/(?:^|[^.\w])transition\s*\(/g) ?? []).length;
    L(`── (G) §15 scan: does src/sprint-engine-c10.ts import/call goal-contract.transition()? ──`);
    L(`  imports transition: ${importsTransition} · calls transition(): ${callsTransition}\n`);
    check("§15: the engine does NOT import goal-contract.transition (state mutation is the reconciler's, §15)", importsTransition === false);
    check("§15: the engine calls transition() ZERO times (it writes EVIDENCE, never mutates GoalContract state)", callsTransition === 0);
  }

  // ── (H) THE CAP FAILS CLOSED ON A MALFORMED BUDGET — a malformed/≤0 axis DISABLES THE WORK, never the BOUND.
  //       The H1 cap can NEVER be disabled by its own input: negative / NaN / Infinity / non-number / zero →
  //       ZERO work (halted_at_cap, no attempt/cost recorded), NOT unbounded. (BUG-2 fix / regression guard.) ──
  {
    const mkSprint = async (budget: any, label: string) => {
      const stores = inMemoryStores();
      const goalId = randomUUID();
      let spawned = false;
      const ctx: SprintContext = {
        stores, sprintId: `sprint-H-${label}`, plannedSteps: 8, cycle: 0,
        spawn: async () => { spawned = true; return { workOutput: "x", costCents: 100, metricDelta: 0.1 }; },
        reprobe: async () => 0.5,
      };
      const r = await runSprint(fixtureContract(goalId, budget), ctx);
      const attempts = await stores.countAttempts(goalId);
      const cost = await stores.readCumulativeCost(goalId);
      return { r, attempts, cost, spawned };
    };
    const malformed: Array<[any, string]> = [
      [{ max_turns: -5, max_cost_cents: -1 }, "negative-both"],
      [{ max_turns: NaN }, "turns-NaN"],
      [{ max_cost_cents: Infinity }, "cost-Infinity"],
      [{ max_turns: 0 }, "turns-zero"],
      [{ max_cost_cents: 0 }, "cost-zero"],
      [{ max_turns: "5" }, "turns-non-number"],
    ];
    for (const [budget, label] of malformed) {
      const { r, attempts, cost, spawned } = await mkSprint(budget, label);
      check(`MALFORMED(${label}): halted_at_cap = true (the malformed budget disabled the WORK, not the BOUND)`, r.halted_at_cap === true && r.result === "halted_at_cap");
      check(`MALFORMED(${label}): ZERO attempts + ZERO cost recorded (not 8 unbounded steps)`, attempts === 0 && cost === 0 && r.attemptsUsed === 0 && r.costUsed === 0);
      check(`MALFORMED(${label}): the spawner was NEVER called (fail-closed before any spawn)`, spawned === false);
    }
    // positive axes STILL bound exactly (the fail-closed change did not weaken the live cap).
    const { r: rpos, attempts: apos } = await mkSprint({ max_turns: 3, max_cost_cents: 100000 }, "positive");
    check("MALFORMED(positive control): a valid positive budget still bounds exactly (3 turns → 3 attempts)", rpos.halted_at_cap === true && apos === 3);
    // an EMPTY budget {} is the legitimate "uncapped" case (absent ≠ malformed) — it runs the planned work.
    const { r: runc, attempts: aunc, spawned: sunc } = await mkSprint({}, "absent");
    check("MALFORMED(absent control): an EMPTY budget {} is legitimately uncapped (absent ≠ malformed) → work runs", runc.halted_at_cap === false && aunc === 8 && sunc === true);
  }

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\nC10 Sprint Engine self-test: ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// =============================================================================
// --db-self-test — REAL TEST DB. Evidence is DURABLY written; the H1 cap bounds the REAL ledger; an idempotent
// re-run does not double-spend; the DEFERRED real spawner throws. TEST-DB fixtures only (no live goal).
// =============================================================================
async function dbSelfTest(): Promise<void> {
  enforceBanner();
  process.env.RUMAH_ENV = "test"; // NEVER prod — force the test env loader
  const L = (s = "") => process.stdout.write(s + "\n");
  const cases: Array<{ name: string; ok: boolean }> = [];
  const check = (name: string, ok: boolean) => cases.push({ name, ok });

  const { sql } = await import("../src/db/client.js");
  // fail loud if 0052 absent
  const [reg] = await sql`SELECT to_regclass('public.attempt_ledger') AS al, to_regclass('public.portfolio_cost_ledger') AS pc, to_regclass('public.goal_delta_ledger') AS gd`;
  if (!reg?.al || !reg?.pc || !reg?.gd) { process.stderr.write("0052 not applied — run `npm run db:test:migrate`\n"); await sql.end(); process.exit(2); }

  // ── (1) THE EVIDENCE CYCLE — durable attempt/cost/progress written through the sanctioned 0052 doors ──
  {
    const goalId = randomUUID();
    const ctx: SprintContext = {
      stores: realStores, sprintId: `db-${goalId}-A`, plannedSteps: 3, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 100, metricDeltaPerStep: 0.1 }), reprobe: async () => 0.9,
    };
    const r = await runSprint(fixtureContract(goalId, { max_turns: 10, max_cost_cents: 10000 }), ctx);
    printSprint(r, "(1) DB EVIDENCE CYCLE — durable attempt/cost/progress");
    const [ac] = await sql`SELECT COUNT(*)::int AS n FROM attempt_ledger WHERE goal_id = ${goalId}`;
    const [cc] = await sql`SELECT COALESCE(MAX(cumulative_cost_cents),0)::int AS c FROM portfolio_cost_ledger WHERE goal_id = ${goalId}`;
    const [pg] = await sql`SELECT COUNT(*)::int AS n, MAX(value)::float AS v FROM goal_delta_ledger WHERE goal_id = ${goalId}`;
    check("DB EVIDENCE: 3 attempts durably recorded", ac?.n === 3 && r.attemptsUsed === 3);
    check("DB EVIDENCE: 300¢ durably recorded (cumulative)", cc?.c === 300 && r.costUsed === 300);
    check("DB EVIDENCE: 1 ProgressSample durably appended (re-probe 0.9)", pg?.n === 1 && pg?.v === 0.9);
    check("DB EVIDENCE: result = objective_advanced", r.result === "objective_advanced" && r.halted_at_cap === false);
  }

  // ── (2) THE H1 CAP BOUNDS THE REAL LEDGER — 20 planned steps, the cap stops it; rows ≤ cap ──
  {
    // turn cap
    const goalId = randomUUID();
    const r = await runSprint(fixtureContract(goalId, { max_turns: 5, max_cost_cents: 1_000_000 }), {
      stores: realStores, sprintId: `db-${goalId}-turns`, plannedSteps: 20, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 1 }), reprobe: async () => 0.5,
    });
    printSprint(r, "(2a) DB H1 TURN CAP — 20 planned, max_turns=5 → STOPS at 5 (ledger ≤ cap)");
    const [ac] = await sql`SELECT COUNT(*)::int AS n FROM attempt_ledger WHERE goal_id = ${goalId}`;
    check("DB CAP(turns): halted_at_cap = true", r.halted_at_cap === true);
    check("DB CAP(turns): the REAL attempt ledger is bounded (== 5, never 20)", ac?.n === 5);
    check("DB CAP(turns): the REAL attempt ledger NEVER exceeds the cap (≤ 5)", (ac?.n ?? 0) <= 5);

    // cost cap
    const goalId2 = randomUUID();
    const r2 = await runSprint(fixtureContract(goalId2, { max_turns: 1000, max_cost_cents: 500 }), {
      stores: realStores, sprintId: `db-${goalId2}-cost`, plannedSteps: 20, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 200 }), reprobe: async () => 0.5,
    });
    printSprint(r2, "(2b) DB H1 COST CAP — 200¢/step, max_cost_cents=500 → STOPS at 400¢ (ledger ≤ cap)");
    const [cc] = await sql`SELECT COALESCE(MAX(cumulative_cost_cents),0)::int AS c FROM portfolio_cost_ledger WHERE goal_id = ${goalId2}`;
    check("DB CAP(cost): halted_at_cap = true", r2.halted_at_cap === true);
    check("DB CAP(cost): the REAL cost ledger is bounded (== 400, the 600¢ step never appended)", cc?.c === 400);
    check("DB CAP(cost): the REAL cost ledger NEVER exceeds the cap (≤ 500)", (cc?.c ?? 0) <= 500);
  }

  // ── (3) IDEMPOTENT RE-RUN against the REAL stores — no double-spend ──
  {
    const goalId = randomUUID();
    const mk = (): SprintContext => ({
      stores: realStores, sprintId: `db-${goalId}-idem`, plannedSteps: 3, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 100 }), reprobe: async () => 0.8,
    });
    const first = await runSprint(fixtureContract(goalId, { max_turns: 100, max_cost_cents: 100000 }), mk());
    const second = await runSprint(fixtureContract(goalId, { max_turns: 100, max_cost_cents: 100000 }), mk());
    printSprint(second, "(3) DB IDEMPOTENT RE-RUN — every step skipped, ledgers unchanged");
    const [ac] = await sql`SELECT COUNT(*)::int AS n FROM attempt_ledger WHERE goal_id = ${goalId}`;
    const [cc] = await sql`SELECT COALESCE(MAX(cumulative_cost_cents),0)::int AS c FROM portfolio_cost_ledger WHERE goal_id = ${goalId}`;
    check("DB IDEMPOTENCY: the first run advanced 3 steps", first.attemptsUsed === 3 && first.costUsed === 300);
    check("DB IDEMPOTENCY: the re-run skipped every step", second.evidence.every((e) => e.outcome === "skipped"));
    check("DB IDEMPOTENCY: the REAL ledgers did NOT double-spend (still 3 attempts / 300¢)", ac?.n === 3 && cc?.c === 300);
  }

  // ── (4) THE REAL SPAWNER STAYS DEFERRED (real-DB context) — no silent dependency ──
  // NB: a per-run-UNIQUE sprintId (BUG-1 fix) — a fixed sprintId would leave a durable reserved intent in
  // idempotency_store, so a RE-RUN would idempotently SKIP step 0 before reaching the deferred spawner (a
  // non-hermetic 13/14). A fresh sprintId each run reserves a fresh intent → reaches the spawn → throws.
  {
    let threw = false;
    try {
      await runSprint(fixtureContract(randomUUID()), { stores: realStores, sprintId: `db-deferred-${randomUUID()}`, plannedSteps: 1, cycle: 0 });
    } catch (e) { threw = (e as Error).message.includes("DEFERRED"); }
    check("DB DEFERRED: a sprint with the DEFAULT (real) spawner throws DEFERRED — the worker/queue host is not wired", threw === true);
  }

  // ── (5) THE CAP FAILS CLOSED ON A MALFORMED BUDGET (real DB) — a negative budget writes ZERO durable evidence
  //       (the malformed budget disables the WORK, never the BOUND; the cap can never be disabled by its input). ──
  {
    const goalId = randomUUID();
    const r = await runSprint(fixtureContract(goalId, { max_turns: -5, max_cost_cents: -1 }), {
      stores: realStores, sprintId: `db-malformed-${randomUUID()}`, plannedSteps: 8, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 100 }), reprobe: async () => 0.5,
    });
    printSprint(r, "(5) DB MALFORMED BUDGET — max_turns:-5 → ZERO work (fail-closed, ledger empty)");
    const [ac] = await sql`SELECT COUNT(*)::int AS n FROM attempt_ledger WHERE goal_id = ${goalId}`;
    const [cc] = await sql`SELECT COALESCE(MAX(cumulative_cost_cents),0)::int AS c FROM portfolio_cost_ledger WHERE goal_id = ${goalId}`;
    check("DB MALFORMED: halted_at_cap = true (a malformed budget disabled the WORK, not the BOUND)", r.halted_at_cap === true && r.result === "halted_at_cap");
    check("DB MALFORMED: ZERO durable attempts + ZERO durable cost (never mapped a malformed budget to uncapped)", ac?.n === 0 && cc?.c === 0 && r.attemptsUsed === 0 && r.costUsed === 0);
  }

  await sql.end();
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\nC10 Sprint Engine DB self-test: ${cases.length - failed.length}/${cases.length} passed (TEST-DB fixtures; no live goal; no real agent).`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// =============================================================================
// default — SHADOW: stub sprints on TEST-DB fixtures (report-only, exit 0).
// =============================================================================
async function shadowDemo(): Promise<void> {
  if (opts.enforce) enforceBanner();
  process.env.RUMAH_ENV = "test";
  const L = (s = "") => process.stdout.write(s + "\n");
  L("C10 Sprint Engine — SHADOW evidence cycle (STUB spawner, TEST-DB fixtures, NO real agent, NO live goal).\n");

  const { sql } = await import("../src/db/client.js");
  const stub: Spawner = makeStubSpawner({ costCentsPerStep: 100, metricDeltaPerStep: 0.1 });

  const g1 = randomUUID();
  const r1 = await runSprint(fixtureContract(g1, { max_turns: 10, max_cost_cents: 10000 }), {
    stores: realStores, sprintId: `shadow-${g1}`, plannedSteps: 3, cycle: 0, spawn: stub, reprobe: async () => 0.9,
  });
  if (opts.json) L(JSON.stringify(r1, null, 2)); else printSprint(r1, "EVIDENCE CYCLE — 3 stub steps advance the metric (bounded by the H1 cap)");

  const g2 = randomUUID();
  const r2 = await runSprint(fixtureContract(g2, { max_turns: 4, max_cost_cents: 10000 }), {
    stores: realStores, sprintId: `shadow-${g2}`, plannedSteps: 12, cycle: 0, spawn: stub, reprobe: async () => 0.4,
  });
  if (opts.json) L(JSON.stringify(r2, null, 2)); else printSprint(r2, "H1 CAP — 12 planned steps, max_turns=4 → STOPS at the cap (halted_at_cap)");

  await sql.end();
  L("SHADOW evidence cycle complete — exit 0 (stub spawner; no real agent spawned; no GoalContract state mutated).");
  process.exit(0);
}

// ── entrypoint ─────────────────────────────────────────────────────────────────
if (opts.selfTest) {
  selfTest().catch((e) => { process.stderr.write(`sprint-engine-c10: ${e?.stack ?? e}\n`); process.exit(2); });
} else if (opts.dbSelfTest) {
  dbSelfTest().catch((e) => { process.stderr.write(`sprint-engine-c10: ${e?.stack ?? e}\n`); process.exit(2); });
} else {
  shadowDemo().catch((e) => { process.stderr.write(`sprint-engine-c10: ${e?.stack ?? e}\n`); process.exit(2); });
}
