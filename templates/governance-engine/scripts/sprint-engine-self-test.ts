// Governance Engine — Sprint Engine (C10) REGRESSION self-test, ported VERBATIM from the VERIFIED admin harness
// (`rumah-admin/scripts/sprint-engine-c10.ts --self-test`) and run against the INVERTED organ + the IN-MEMORY
// `RuntimeStoresPort` (the slice-2 adapter, already cage-pinned to the 0052 invariants). NO DB.
//
// THE PROOF THIS FILE EXISTS TO MAKE: the cap-fail-closed evidence cycle is BYTE-FOR-BYTE preserved after the
// `realStores` DB default was removed and the store seam re-pointed onto the injected `RuntimeStoresPort`. Cases
// (A)-(E), (G)-(H) are copied verbatim from the admin harness; the ONLY edit is `inMemoryStores()` →
// `runtimeStoresPortToSprintStores(createInMemoryRuntimeStores())` (the genuine slice-2 port), the import paths,
// and the §15 scan retargeted to the package file. The admin harness's (F) `asControllerHook` seam is DEFERRED
// (it depends on the `po-autoloop` controller types — slice 4); it is replaced here by (F') the PORT-COMPOSITION
// path: `createSprintEngine({store, contract})` runs `runSprintForGoal`, SOURCING the H1 budget envelope from the
// IN-MEMORY `GoalContractStorePort` and proving the cap bound holds end-to-end on the real ports (zero Postgres).
// Same inputs ⇒ same verdicts / the SAME cap bound.
//
// Run:  tsx sprint-engine-self-test.ts   ·   exit 0 = the inverted logic matches the verified logic · 1 = drift.

import { randomUUID } from "node:crypto";
import {
  runSprint,
  makeStubSpawner,
  realWorkerQueueSpawn,
  runtimeStoresPortToSprintStores,
  createSprintEngine,
  type SprintContext,
  type SprintStores,
} from "../sprint-engine.js";
import type { GoalContractRow, BudgetCap } from "../ports.js";
import { createInMemoryRuntimeStores, createInMemoryGoalContractStore } from "./in-memory-store.js";
import { createGoalContractOrgan } from "../goal-contract.js";

const BUDGET: BudgetCap = { max_turns: 100, max_cost_cents: 100000 };
const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });

function fixtureContract(goalId: string, budget: BudgetCap = BUDGET, objective = "reach 100% invoice delivery coverage"): GoalContractRow {
  const now = new Date();
  return {
    goalId, objective, acceptanceMetric: "delivered_invoice_ratio",
    metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL",
    budgetCap: budget, goalDeltaLedgerRef: goalId, state: "EXECUTING", prevState: "PLANNING",
    createdAt: now, updatedAt: now,
  };
}

// the genuine slice-2 in-memory RuntimeStoresPort, narrowed to the SprintStores seam (replaces admin's bespoke
// inMemoryStores()). This is even stronger than the admin fake: the cage already pins these to the 0052 invariants.
function inMemoryStores(): SprintStores {
  return runtimeStoresPortToSprintStores(createInMemoryRuntimeStores());
}

async function main() {
  // ── (A) THE EVIDENCE CYCLE — a stub sprint produces evidence + advances the metric + records attempts/cost ──
  {
    const stores = inMemoryStores();
    const goalId = randomUUID();
    let probed = 0.6;
    const ctx: SprintContext = {
      stores, sprintId: "sprint-A", plannedSteps: 3, cycle: 10,
      spawn: makeStubSpawner({ costCentsPerStep: 100, metricDeltaPerStep: 0.1 }),
      reprobe: async () => (probed = 0.9),
    };
    const r = await runSprint(fixtureContract(goalId, { max_turns: 10, max_cost_cents: 10000 }), ctx);
    check("EVIDENCE: 3 steps advanced (work output produced)", r.evidence.filter((e) => e.outcome === "advanced").length === 3);
    check("EVIDENCE: attempts recorded in the ledger (3)", r.attemptsUsed === 3 && (await stores.countAttempts(goalId)) === 3);
    check("EVIDENCE: cost recorded cumulatively (300¢)", r.costUsed === 300 && (await stores.readCumulativeCost(goalId)) === 300);
    check("EVIDENCE: a ProgressSample (the re-probed movement) was appended", r.progressSamples.length === 1 && r.progressSamples[0]!.value === 0.9);
    check("EVIDENCE: result = objective_advanced, not halted_at_cap", r.result === "objective_advanced" && r.halted_at_cap === false);
  }

  // ── (B) THE H1 CAP BOUNDS IT (THE load-bearing property) — a sprint that WOULD run 20 steps stops at the cap ──
  {
    const stores = inMemoryStores();
    const goalId = randomUUID();
    const ctx: SprintContext = {
      stores, sprintId: "sprint-B-turns", plannedSteps: 20, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 1, metricDeltaPerStep: 0.01 }), reprobe: async () => 0.5,
    };
    const r = await runSprint(fixtureContract(goalId, { max_turns: 5, max_cost_cents: 100000 }), ctx);
    check("CAP(turns): halted_at_cap = true", r.halted_at_cap === true && r.result === "halted_at_cap");
    check("CAP(turns): the attempt ledger is BOUNDED by max_turns (== 5, never 20)", (await stores.countAttempts(goalId)) === 5 && r.attemptsUsed === 5);
    check("CAP(turns): the ledger NEVER exceeds the cap (≤ 5)", (await stores.countAttempts(goalId)) <= 5);

    const stores2 = inMemoryStores();
    const goalId2 = randomUUID();
    const ctx2: SprintContext = {
      stores: stores2, sprintId: "sprint-B-cost", plannedSteps: 20, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 200, metricDeltaPerStep: 0.01 }), reprobe: async () => 0.5,
    };
    const r2 = await runSprint(fixtureContract(goalId2, { max_turns: 1000, max_cost_cents: 500 }), ctx2);
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
      spawn: makeStubSpawner({ costCentsPerStep: 100, abortSteps: [1] }), reprobe: async () => 0.5,
    };
    const r = await runSprint(fixtureContract(goalId, { max_turns: 100, max_cost_cents: 100000 }), ctx);
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

    const stores = inMemoryStores();
    let sprintThrew = false;
    try {
      await runSprint(fixtureContract(randomUUID()), { stores, sprintId: "sprint-E", plannedSteps: 1, cycle: 0 });
    } catch (e) { sprintThrew = (e as Error).message.includes("DEFERRED"); }
    check("DEFERRED: a sprint with the DEFAULT spawner throws DEFERRED (no path silently spawns real work)", sprintThrew === true);
  }

  // ── (F') PORT-COMPOSITION (replaces admin's asControllerHook seam, DEFERRED to slice 4) — createSprintEngine
  //         runs runSprintForGoal sourcing the H1 budget from the IN-MEMORY GoalContractStorePort; the cap bound
  //         holds end-to-end on the real ports (zero Postgres), and the engine NEVER transitions the contract. ──
  {
    const store = createInMemoryRuntimeStores();
    const contract = createGoalContractOrgan(createInMemoryGoalContractStore());
    const goal = await contract.createContract({
      objective: "reach 100% coverage", acceptanceMetric: "delivered_invoice_ratio",
      metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1,
      dataClass: "CONFIDENTIAL", budgetCap: { max_turns: 4, max_cost_cents: 100000 }, // cap at 4 turns
    });
    for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as const) await contract.transition(goal.goalId, to);
    const engine = createSprintEngine({ store, contract });
    const r = await engine.runSprintForGoal(goal.goalId, {
      sprintId: "sprint-F-port", plannedSteps: 20, cycle: 0,
      spawn: makeStubSpawner({ costCentsPerStep: 100, metricDeltaPerStep: 0.05 }), reprobe: async () => 0.5,
    });
    check("PORT: createSprintEngine sourced the contract (budget) from the GoalContractStorePort and ran", r.cap.maxTurns === 4);
    check("PORT: the H1 cap (max_turns=4) bounds the REAL in-memory ledger (== 4, never 20)", r.halted_at_cap === true && (await store.countAttempts(goal.goalId)) === 4 && r.attemptsUsed === 4);
    check("PORT: §15 — the contract state is UNTOUCHED by the engine (still EXECUTING)", (await contract.readContract(goal.goalId))!.state === "EXECUTING");
  }

  // ── (G) §15 UNTOUCHED (structural) — the package sprint-engine.ts NEVER imports/calls .transition() ──
  {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const srcFile = resolve(here, "..", "sprint-engine.ts");
    const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const code = stripComments(readFileSync(srcFile, "utf8"));
    const stripImports = (c: string) => c.replace(/import\s*(?:type\s*)?\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, "");
    const importsTransition = /import\s*\{[^}]*\btransition\b[^}]*\}\s*from\s*["'][^"']*(?:goal-contract|ports)(?:\.js)?["']/.test(code.replace(/import\s+type\s*\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, ""));
    const callsTransition = (stripImports(code).match(/(?:^|[^.\w])transition\s*\(|\.\s*transition\s*\(/g) ?? []).length;
    console.log(`── (G) §15 scan: does sprint-engine.ts import/call a transition value? ──`);
    console.log(`  imports transition value: ${importsTransition} · calls .transition(): ${callsTransition}\n`);
    check("§15: the engine does NOT import a transition value (state mutation is the reconciler's, §15)", importsTransition === false);
    check("§15: the engine calls .transition() ZERO times (it writes EVIDENCE, never mutates GoalContract state)", callsTransition === 0);
  }

  // ── (H) THE CAP FAILS CLOSED ON A MALFORMED BUDGET — a malformed/≤0 axis DISABLES THE WORK, never the BOUND. ──
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
    const { r: rpos, attempts: apos } = await mkSprint({ max_turns: 3, max_cost_cents: 100000 }, "positive");
    check("MALFORMED(positive control): a valid positive budget still bounds exactly (3 turns → 3 attempts)", rpos.halted_at_cap === true && apos === 3);
    const { r: runc, attempts: aunc, spawned: sunc } = await mkSprint({}, "absent");
    check("MALFORMED(absent control): an EMPTY budget {} is legitimately uncapped (absent ≠ malformed) → work runs", runc.halted_at_cap === false && aunc === 8 && sunc === true);
  }

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  console.log(`\ngovernance-engine C10 Sprint Engine self-test (verbatim cap table + idempotency + §15 + port composition): ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
