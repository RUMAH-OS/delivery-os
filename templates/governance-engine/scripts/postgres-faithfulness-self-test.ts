// =============================================================================
// governance-engine — POSTGRES FAITHFULNESS self-test.
// =============================================================================
// THE SLICE-5 PROOF: the reference Postgres adapter is a FAITHFUL implementation of the 6 ports — the organs
// (createGovernanceRuntime → contract organ · reconciler · GS · sprint engine · controller · C6) produce the
// IDENTICAL verdicts/behavior on REAL Postgres that they produce on the in-memory adapter. Same cap-fail-closed,
// same sole-mutator §4.3 transitions, same C6 DONE-gate, same append-only / write-once / breaker-cooldown
// invariants — now on the de-admin'd template migrations applied to a real database.
//
// It stands up admin's throwaway TEST DB (docker-compose.test.yml / `db:test:up`, host port 55432), applies the
// de-admin'd `migrations/0001`+`0002` TEMPLATE (via the reference adapter's `applyTemplateMigrations`, substituting
// `{{app_role}}`), then runs the SAME scenario through `createGovernanceRuntime` on BOTH adapters and asserts the
// two run summaries are byte-identical (plus head-to-head store-invariant checks + a live DB-trigger backstop check).
//
// RESIDENCY: this file imports ONLY the package + the reference adapter (a relative `../adapters/postgres/` path) —
// it never imports `postgres`/`pg`/`./db/client.js` itself, so `scripts/` stays residency-clean.
//
// If no test DB is reachable, this self-test is RUNNABLE and reports SKIP honestly (exit 0) — it never fakes a pass.
//
// Run:
//   (in rumah-admin)  npm run db:test:up
//   (here)            GOVERNANCE_TEST_DATABASE_URL=postgres://rumah:rumah@localhost:55432/rumah_admin_test \
//                       tsx scripts/postgres-faithfulness-self-test.ts
//   exit 0 = organs identical on Postgres vs in-memory (or DB unreachable → SKIP) · exit 1 = a faithfulness drift.
// =============================================================================

import { randomUUID } from "node:crypto";
import { createGovernanceRuntime, type GovernanceRuntime } from "../runtime.js";
import type { GoalSubmission, LifecycleContext, SprintExecutor, ObservedTickInput } from "../po-autoloop.js";
import { ProbeRegistry, type MetricProbe } from "../metric-probe.js";
import type { PreflightGoal, PreflightContext } from "../preflight.js";
import type { ReachabilityVerdict } from "../reachability-evaluator.js";
import type { AcceptanceShape } from "../goal-supervisor.js";
import type { GoalState } from "../ports.js";
import type { IntakeLifecycleSeams } from "../goal-intake.js";
import { createInMemoryGoalContractStore, createInMemoryRuntimeStores } from "./in-memory-store.js";
import {
  openPostgres,
  applyTemplateMigrations,
  dropTemplateMigrations,
  createPostgresRuntimeStores,
  createPostgresGoalContractStore,
  type Sql,
} from "../adapters/postgres/index.js";

const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });
const L = (s = "") => process.stdout.write(s + "\n");

const ACCEPTANCE: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };
const BUDGET = { max_turns: 100, max_cost_cents: 10000 };
const REACHABLE: ReachabilityVerdict = { reachable: true, confidence: 0.95, evidence: "reachable" };
const ALL_CONFIG_PRESENT = async () => [];

const DEFAULT_URL = "postgres://rumah:rumah@localhost:55432/rumah_admin_test";
const TEST_URL = process.env.GOVERNANCE_TEST_DATABASE_URL ?? DEFAULT_URL;

function appRoleFromUrl(url: string): string {
  if (process.env.GOVERNANCE_TEST_APP_ROLE) return process.env.GOVERNANCE_TEST_APP_ROLE;
  try {
    return new URL(url).username || "rumah";
  } catch {
    return "rumah";
  }
}

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
function feasibleGoal(goalId: string): PreflightGoal {
  return {
    goalId, objective: "reach 100% invoice delivery coverage", acceptanceMetric: "delivered_invoice_ratio",
    metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, budgetCap: BUDGET,
    acceptance: { metric: "delivered_invoice_ratio", op: ">=", target: 1.0, direction: "increase" }, requiredConfigKeys: [],
  };
}
function preflightCtx(): PreflightContext {
  return { targetEnv: "test", probeRegistry: probeRegistry(), configReadiness: ALL_CONFIG_PRESENT, reachability: { kind: "verdict", verdict: REACHABLE } };
}
function trajectory(points: Array<{ value: number | null; attempts: number; cost: number }>, startCycle: number) {
  return async (_g: string, i: number): Promise<ObservedTickInput> => {
    const p = points[Math.min(i, points.length - 1)]!;
    return { cycle: startCycle + i, metricValue: p.value, attempts: p.attempts, cumulativeCostCents: p.cost };
  };
}
function happySeams(reprobe = 1.0): IntakeLifecycleSeams {
  return {
    seedProgress: [{ cycle: 0, value: 0.3 }, { cycle: 1, value: 0.5 }, { cycle: 2, value: 0.7 }, { cycle: 3, value: 0.9 }],
    observe: trajectory([{ value: 1.0, attempts: 60, cost: 6000 }, { value: 1.0, attempts: 62, cost: 6200 }], 4),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: reprobe, note: "independent re-probe (fixture)" }) },
    maxTicks: 6,
  };
}

interface RunSummary {
  finalState: string | null | undefined;
  contractStateAfter: string | undefined;
  c6Complete: boolean;
  realTransitionExecuted: boolean;
  progressSeriesLen: number;
  cumulativeCost: number;
}

/** Run the canonical happy-path lifecycle through a runtime and distill a comparable summary. */
async function runScenario(runtime: GovernanceRuntime, goalId: string): Promise<RunSummary> {
  // the ramp executor drives CREATED→…→EXECUTING via the runtime's contract organ (legal §4.3 edges only).
  const rampExecutor: SprintExecutor = {
    admitToExecuting: async (c) => {
      for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as GoalState[]) await runtime.contract.transition(c.goalId, to);
      return { state: "EXECUTING", transitions: ["CREATED→…→EXECUTING"], note: "fixture ramp" };
    },
    runSprint: async () => { throw new Error("runSprint DEFERRED"); },
  };
  const submission: GoalSubmission = {
    goal: feasibleGoal(goalId), preflightCtx: preflightCtx(),
    createInput: {
      goalId, // a REAL uuid → the Postgres contract row's goal_id (and the ledger scope key).
      objective: "reach 100% coverage", acceptanceMetric: "delivered_invoice_ratio",
      metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: BUDGET,
    },
  };
  const ctx: LifecycleContext = { ...happySeams(1.0), acceptance: ACCEPTANCE, budgetCap: BUDGET, executor: rampExecutor, enforce: true, persistProgress: true };
  const r = await runtime.runGoalLifecycle(submission, ctx);
  const after = await runtime.contract.readContract(r.goalId!);
  const series = await runtime.store.readProgressSeries(r.goalId!);
  return {
    finalState: r.finalState,
    contractStateAfter: after?.state,
    c6Complete: r.ticks.some((t) => t.review?.verdict === "COMPLETE"),
    realTransitionExecuted: r.ticks.some((t) => t.execution.executed === true),
    progressSeriesLen: series.length,
    cumulativeCost: await runtime.store.readCumulativeCost(r.goalId!),
  };
}

/** Head-to-head store-invariant checks: append-only no-op, dup-attempt throw, breaker cooldown, write-once,
 *  cumulative cost — proving the Postgres adapter reproduces the in-memory adapter's semantics exactly. */
async function storeInvariantParity(makeStores: () => any): Promise<Record<string, unknown>> {
  const s = makeStores();
  const g = randomUUID();
  const step = randomUUID();

  const ins1 = await s.appendProgressSample({ goalId: g, cycle: 0, value: 0.5 });
  const ins2 = await s.appendProgressSample({ goalId: g, cycle: 0, value: 0.9 }); // would-be overwrite
  const series = await s.readProgressSeries(g);

  await s.recordAttempt({ stepId: step, attempt: 1, outcome: "flat", goalId: g });
  let dupThrew = false;
  try { await s.recordAttempt({ stepId: step, attempt: 1, outcome: "progressed", goalId: g }); } catch { dupThrew = true; }

  const key = `idem:${g}`;
  const r1 = await s.reserveIntent(key, { scope: "test" });
  const r2 = await s.reserveIntent(key, { scope: "test" });
  const con1 = await s.consumeIntent(key);
  const con2 = await s.consumeIntent(key);

  const f1 = await s.recordFailure(step, { threshold: 3, cooldownMs: 60_000 });
  const f2 = await s.recordFailure(step, { threshold: 3, cooldownMs: 60_000 });
  const f3 = await s.recordFailure(step, { threshold: 3, cooldownMs: 60_000 });

  const c1 = await s.appendCost({ goalId: g, costCents: 100 });
  const c2 = await s.appendCost({ goalId: g, costCents: 50 });

  return {
    appendIdempotent: ins1 === true && ins2 === false && series.length === 1 && series[0].value === 0.5,
    dupAttemptThrew: dupThrew && (await s.countAttempts(g)) === 1,
    reservePkRace: r1.reserved === true && r2.reserved === false,
    consumeWriteOnce: con1.consumed === true && con2.consumed === false && (await s.isConsumed(key)) === true,
    breakerOpensAtThreshold: f1.breakerState === "closed" && f2.breakerState === "closed" && f3.breakerState === "open" && f3.breakerCooldownUntil != null,
    cumulativeCost: c1.cumulativeCostCents === 100 && c2.cumulativeCostCents === 150 && (await s.readCumulativeCost(g)) === 150,
  };
}

async function dbReachable(sql: Sql): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function main() {
  L("governance-engine POSTGRES FAITHFULNESS self-test — organs identical on Postgres vs in-memory\n");

  const appRole = appRoleFromUrl(TEST_URL);
  let sql: Sql | null = null;
  try {
    sql = openPostgres(TEST_URL, { connectTimeout: 5 });
    const up = await dbReachable(sql);
    if (!up) {
      await sql.end({ timeout: 2 }).catch(() => {});
      L(`SKIP  test DB not reachable at ${TEST_URL}`);
      L("      This self-test is RUNNABLE — stand up the test DB and re-run:");
      L("        (in rumah-admin)  npm run db:test:up");
      L(`        (here)            GOVERNANCE_TEST_DATABASE_URL=${DEFAULT_URL} tsx scripts/postgres-faithfulness-self-test.ts`);
      L("\nNo faithfulness drift asserted (DB absent). exit 0 (honest SKIP — nothing faked).");
      process.exit(0);
    }
  } catch (e) {
    L(`SKIP  could not open a Postgres client (${(e as Error).message}). Self-test is runnable; stand up the test DB.`);
    process.exit(0);
  }

  L(`[0] test DB reachable (${TEST_URL}); de-admin'ing the template with {{app_role}} = '${appRole}'`);
  // clean-room: drop any prior template objects, then apply the de-admin'd template migrations EXACTLY as a consumer would.
  await dropTemplateMigrations(sql).catch(() => {});
  const applied = await applyTemplateMigrations(sql, { appRole });
  check(`template migrations applied (${applied.join(", ")})`, applied.length === 2);

  // ── (1) full lifecycle through createGovernanceRuntime on BOTH adapters → compare summaries ──
  L("\n[1] full goal lifecycle through createGovernanceRuntime — in-memory vs Postgres");
  const memRuntime = createGovernanceRuntime({
    goalContractStore: createInMemoryGoalContractStore(),
    runtimeStores: createInMemoryRuntimeStores(),
    probeRegistry: probeRegistry(),
  });
  const pgRuntime = createGovernanceRuntime({
    goalContractStore: createPostgresGoalContractStore(sql),
    runtimeStores: createPostgresRuntimeStores(sql),
    probeRegistry: probeRegistry(),
  });

  const memSummary = await runScenario(memRuntime, randomUUID());
  const pgSummary = await runScenario(pgRuntime, randomUUID());

  check("in-memory lifecycle reaches DONE (C6-gated, real transition, series captured)",
    memSummary.finalState === "DONE" && memSummary.contractStateAfter === "DONE" && memSummary.c6Complete && memSummary.realTransitionExecuted && memSummary.progressSeriesLen > 0);
  check("POSTGRES lifecycle reaches DONE (C6-gated, real transition, series captured)",
    pgSummary.finalState === "DONE" && pgSummary.contractStateAfter === "DONE" && pgSummary.c6Complete && pgSummary.realTransitionExecuted && pgSummary.progressSeriesLen > 0);
  check("FAITHFUL: the two run summaries are byte-identical (organs behave identically on Postgres)",
    JSON.stringify(memSummary) === JSON.stringify(pgSummary));
  L(`      in-memory: ${JSON.stringify(memSummary)}`);
  L(`      postgres : ${JSON.stringify(pgSummary)}`);

  // ── (2) head-to-head store-invariant parity ──
  L("\n[2] store-invariant parity (append-only · dup-attempt · PK-race · write-once · breaker · cumulative cost)");
  const memInv = await storeInvariantParity(() => createInMemoryRuntimeStores());
  const pgInv = await storeInvariantParity(() => createPostgresRuntimeStores(sql!));
  for (const k of Object.keys(memInv)) check(`in-memory invariant: ${k}`, memInv[k] === true);
  for (const k of Object.keys(pgInv)) check(`POSTGRES invariant: ${k}`, pgInv[k] === true);
  check("FAITHFUL: in-memory and Postgres store-invariant results are identical", JSON.stringify(memInv) === JSON.stringify(pgInv));

  // ── (3) the DB trigger is a LIVE owner-proof backstop (a raw illegal UPDATE throws) ──
  L("\n[3] DB backstop: the §4.3 trigger refuses a RAW illegal UPDATE (owner-proof, bypassing the organ)");
  const gid = randomUUID();
  await pgRuntime.contract.createContract({
    goalId: gid, objective: "trigger probe", acceptanceMetric: "m", metricSourceProbeId: "p",
    metricSourceVersion: 1, dataClass: "INTERNAL", budgetCap: {},
  });
  let triggerThrew = false;
  try {
    // CREATED → DONE is illegal (skips the whole lifecycle). The organ would refuse it in TS; here we go AROUND
    // the organ with a raw SQL UPDATE to prove the DB trigger independently refuses it.
    await sql`UPDATE goal_contract SET state = 'DONE' WHERE goal_id = ${gid}`;
  } catch {
    triggerThrew = true;
  }
  const stillCreated = (await pgRuntime.contract.readContract(gid))?.state === "CREATED";
  check("the 0001/0053 state-machine trigger refuses a raw CREATED→DONE UPDATE (state unchanged)", triggerThrew && stillCreated);

  // ── teardown (clean-room) ──
  await dropTemplateMigrations(sql).catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});

  // ── tally ──
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\ngovernance-engine Postgres faithfulness self-test: ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
