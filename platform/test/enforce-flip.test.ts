// =============================================================================
// THE ENFORCE-FLIP PROOF — reasoning drives the GoalContract governance lifecycle, flag-gated + fail-closed.
// =============================================================================
// Proves the enforce-flip end-to-end against a real Postgres (DATABASE_URL), with INJECTED STUB organs so every
// branch is deterministic (no real model, no network). The flip wires the ReasoningPipeline into the live
// reconciler sweep behind PLATFORM_REASONING_DRIVES_GOALS; the reasoned plan is enacted by the EXISTING sole
// mutator (po-reconciler-c2.applyReconcilePlan), which stays the ONLY transition() call site.
//   (a) flag ON + a clear, reachable goal → the reconciler drives CREATED→FEASIBILITY→ACTIVE, each edge passing
//       the 0053 DB trigger (real transitions, real stamped events);
//   (b) flag ON + an ambiguous goal → HALTED + a drafted founder action, and the FEASIBILITY→ACTIVE admission
//       edge NEVER fires (no unproven forward edge);
//   (c) flag ON + an unreachable goal → HALTED (cited blockers on the founder-action draft);
//   (c2) organ-error / low-confidence / consequential-or-irreversible → HALTED (the full fail-closed policy);
//   (d) flag OFF (and flag ON without injected organs) → ZERO mutation (exact current behavior);
//   (e) SOURCE-SCAN: the goal-driver NEVER calls transition() (the sole-mutator invariant, §15, proven
//       structurally) — and po-reconciler-c2 / goal-contract stay unimported-for-mutation.
//
// Requires a local Postgres via DATABASE_URL (see bare-os.test.ts). Author≠verifier: the independent VERIFY doc
// records the neutral run. Where no DB exists, this file is authored to run on the verifier's DB machine.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { databaseUrl, REASONING_DRIVES_GOALS_FLAG } from "../src/env.js";
import { migrateUp } from "../src/db/migrate-core.js";
import { sql } from "../src/db/client.js";
import { createContract, readContract, transition, type GoalState } from "../src/goal-contract.js";
import { reconcileSweep, type ReasoningSweepDeps } from "../src/reconciler-loop.js";
import { NOOP_EXECUTOR, type ReasoningOrgans } from "../src/reasoning/pipeline/reasoning-pipeline.js";
import type { FounderActionDraft } from "../src/reasoning/goal-driver.js";
import type { IntakeClassification, Lane, Consequentiality, Reversibility } from "../src/reasoning/organs/intake-classifier.js";
import type { ReachabilityVerdict } from "../src/reasoning/organs/reachability.js";
import type { PlanResult, PlanStep } from "../src/reasoning/organs/planner.js";
import type { ResolveContext } from "../src/reasoning/model-router.js";

const CTX: ResolveContext = { requestId: "enforce-flip-test" };

// ── Typed stub-organ output builders (the shapes the real organs emit). ──────────────────────────────────────
function classification(over: Partial<IntakeClassification> = {}): IntakeClassification {
  return {
    intent: "unknown",
    lane: "build" as Lane,
    consequentiality: "medium" as Consequentiality,
    reversibility: "reversible" as Reversibility,
    confidence: 0.9,
    needs_clarification: false,
    via: "reasoning",
    seamVersion: "intake-classifier/v1",
    ...over,
  };
}
function reachable(over: Partial<ReachabilityVerdict> = {}): ReachabilityVerdict {
  return { reachable: true, confidence: 0.9, blockers: [], seamVersion: "reachability/v1", via: "reasoning", ...over };
}
const DAG: readonly PlanStep[] = [
  { id: "s1", op: ">=", target: "schema", direction: "increase", dependsOn: [] },
  { id: "s2", op: ">=", target: "api", direction: "increase", dependsOn: ["s1"] },
];
function plannedOk(over: Partial<PlanResult> = {}): PlanResult {
  return { steps: DAG, disjointSurfaces: ["schema"], confidence: 0.9, needs_clarification: false, via: "reasoning", seamVersion: "planner/v1", ...over };
}

/** Build a stub organ set. Any organ can be a thrower (to prove the organ-invocation-error fail-closed path). */
function stubOrgans(parts: {
  classify?: IntakeClassification | (() => Promise<IntakeClassification>);
  reach?: ReachabilityVerdict | (() => Promise<ReachabilityVerdict>);
  plan?: PlanResult;
}): ReasoningOrgans {
  return {
    classify: async () => (typeof parts.classify === "function" ? parts.classify() : (parts.classify ?? classification())),
    evaluateReachability: async () => (typeof parts.reach === "function" ? parts.reach() : (parts.reach ?? reachable())),
    plan: async () => parts.plan ?? plannedOk(),
    narrate: async () => "stub narration",
    executor: NOOP_EXECUTOR,
  };
}

// ── The founder-action sink + a deps builder. ───────────────────────────────────────────────────────────────
// NB: the goal_contract_event store is append-only (DELETE is trigger-forbidden) and TRUNCATE privilege is not
// guaranteed on the verifier's app-role DB, so tests do NOT wipe the portfolio between cases. Instead every
// fixture is a FRESH goal (a unique uuid) and all assertions are SCOPED to that goalId — foreign leftover goals
// (e.g. an ACTIVE goal from case (a)) are swept harmlessly (DELEGATE→WAIT, zero mutation) and never observed.
let founderActions: FounderActionDraft[] = [];
function deps(organs: ReasoningOrgans): ReasoningSweepDeps {
  return { organs, ctx: CTX, onFounderAction: (d) => { founderActions.push(d); } };
}
/** The founder-action drafts emitted for THIS test's goal only (portfolio is not wiped — scope by goalId). */
function draftsFor(goalId: string): FounderActionDraft[] {
  return founderActions.filter((f) => f.goalId === goalId);
}

async function seed(state: GoalState = "CREATED"): Promise<string> {
  const c = await createContract({
    objective: "an OS self-goal for the enforce-flip proof",
    acceptanceMetric: "os.enforce_flip.ok",
    metricSourceProbeId: "os.enforce-flip",
    metricSourceVersion: 1,
    dataClass: "INTERNAL",
  });
  // Seed the fixture into a downstream pre-flight state via the sole door (TEST harness setup, not the driver).
  if (state !== "CREATED") await transition(c.goalId, state);
  return c.goalId;
}

/** Drive the sweep repeatedly (each sweep = one edge per goal, level-triggered) until the goal settles or the
 *  state stops changing. Returns the ordered list of states the goal passed through. */
async function driveToStable(goalId: string, d: ReasoningSweepDeps, maxSweeps = 6): Promise<GoalState[]> {
  const path: GoalState[] = [(await readContract(goalId))!.state];
  for (let i = 0; i < maxSweeps; i++) {
    await reconcileSweep({ reasoning: d });
    const s = (await readContract(goalId))!.state;
    if (s === path[path.length - 1]) break; // stable — no further edge fired
    path.push(s);
  }
  return path;
}

async function eventsFor(goalId: string): Promise<Array<{ from: GoalState; to: GoalState }>> {
  const rows = await sql<Array<{ from_state: GoalState; to_state: GoalState }>>`
    SELECT from_state, to_state FROM goal_contract_event WHERE goal_contract_id = ${goalId} ORDER BY seq`;
  return rows.map((r) => ({ from: r.from_state, to: r.to_state }));
}

beforeAll(async () => {
  const mig = postgres(databaseUrl(), { max: 1 });
  await migrateUp(mig);
  await mig.end();
}, 60_000);

afterAll(async () => {
  delete process.env[REASONING_DRIVES_GOALS_FLAG];
  // Be a good citizen on the SHARED test DB (fileParallelism:false, one DB across files): SETTLE every
  // non-settled goal this file left behind so any other suite's empty-portfolio assumption (e.g. bare-os) still
  // holds regardless of run order. The event store is append-only (no delete), so we settle via a legal terminal
  // edge (ANY non-terminal → FAILED, RS-DOS-v1 §4.3) rather than truncating.
  const nonSettled = await sql<{ goal_id: string }[]>`
    SELECT goal_id FROM goal_contract WHERE state <> ALL(${["DONE", "FAILED", "CLOSED", "HALTED", "SUSPENDED"] as unknown as string[]})`;
  for (const g of nonSettled) {
    try { await transition(g.goal_id, "FAILED"); } catch { /* best-effort cleanup */ }
  }
  await sql.end({ timeout: 5 });
});

beforeEach(() => {
  founderActions = [];
});

// ── (a) flag ON + a clear reachable goal → CREATED→FEASIBILITY→ACTIVE (each edge passes the 0053 trigger). ────
describe("enforce-flip (a) — flag ON drives a reachable goal CREATED→FEASIBILITY→ACTIVE", () => {
  it("drives both pre-flight edges via the SOLE mutator, each stamped, and admits to ACTIVE", async () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "true";
    const goalId = await seed("CREATED");
    const d = deps(stubOrgans({ classify: classification(), reach: reachable(), plan: plannedOk() }));

    const path = await driveToStable(goalId, d);

    expect(path).toEqual(["CREATED", "FEASIBILITY", "ACTIVE"]);
    expect((await readContract(goalId))!.state).toBe("ACTIVE");
    // Real transitions, each stamped in the event stream — each edge passed the 0053 DB trigger.
    expect(await eventsFor(goalId)).toEqual([
      { from: "CREATED", to: "FEASIBILITY" },
      { from: "FEASIBILITY", to: "ACTIVE" },
    ]);
    expect(draftsFor(goalId)).toEqual([]); // an admitted goal escalates nothing
  });
});

// ── (b) flag ON + ambiguous → HALTED + founder-action; the admission edge NEVER fires. ───────────────────────
describe("enforce-flip (b) — flag ON halts an ambiguous goal (no unproven forward edge)", () => {
  it("FEASIBILITY→HALTED with a drafted founder action; FEASIBILITY→ACTIVE never fires", async () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "true";
    const goalId = await seed("FEASIBILITY");
    const d = deps(stubOrgans({ classify: classification({ needs_clarification: true, via: "fail-closed", intent: "unknown", lane: null, consequentiality: null, reversibility: null, confidence: 0.3 }) }));

    const path = await driveToStable(goalId, d);

    expect(path[path.length - 1]).toBe("HALTED");
    const evs = await eventsFor(goalId); // includes the seed's CREATED→FEASIBILITY, then the driver's edge
    expect(evs[evs.length - 1]).toEqual({ from: "FEASIBILITY", to: "HALTED" });
    expect(evs.some((e) => e.to === "ACTIVE")).toBe(false); // the admission edge NEVER fired
    expect(draftsFor(goalId)).toHaveLength(1);
    expect(draftsFor(goalId)[0]).toMatchObject({ goalId, kind: "PREFLIGHT_HALT", reason: "needs_clarification" });
  });

  it("from CREATED, converges CREATED→FEASIBILITY→HALTED and still never admits to ACTIVE", async () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "true";
    const goalId = await seed("CREATED");
    const d = deps(stubOrgans({ classify: classification({ needs_clarification: true, via: "fail-closed", intent: "unknown", lane: null, consequentiality: null, reversibility: null, confidence: 0.2 }) }));

    const path = await driveToStable(goalId, d);

    expect(path).toEqual(["CREATED", "FEASIBILITY", "HALTED"]);
    expect(await eventsFor(goalId)).toEqual([
      { from: "CREATED", to: "FEASIBILITY" },
      { from: "FEASIBILITY", to: "HALTED" },
    ]);
    expect(draftsFor(goalId).map((f) => f.reason)).toEqual(["needs_clarification"]);
  });
});

// ── (c) flag ON + unreachable → HALTED with cited blockers. ──────────────────────────────────────────────────
describe("enforce-flip (c) — flag ON halts an unreachable goal (C9 fail-closed)", () => {
  it("FEASIBILITY→HALTED; the founder-action carries the cited blockers", async () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "true";
    const goalId = await seed("FEASIBILITY");
    const d = deps(stubOrgans({
      classify: classification(),
      reach: reachable({ reachable: false, via: "fail-closed", reason: "reachable-not-asserted", confidence: 0.2, blockers: [{ claim: "no lever moves the metric", source: "goal_contract:probe" }] }),
    }));

    const path = await driveToStable(goalId, d);

    expect(path[path.length - 1]).toBe("HALTED");
    const evs = await eventsFor(goalId); // includes the seed's CREATED→FEASIBILITY, then the driver's edge
    expect(evs[evs.length - 1]).toEqual({ from: "FEASIBILITY", to: "HALTED" });
    expect(evs.some((e) => e.to === "ACTIVE")).toBe(false);
    expect(draftsFor(goalId)[0]).toMatchObject({ reason: "not_reachable" });
    expect(draftsFor(goalId)[0]!.blockers).toEqual([{ claim: "no lever moves the metric", source: "goal_contract:probe" }]);
  });
});

// ── (c2) the FULL fail-closed policy: organ-error, low-confidence, consequential-or-irreversible all HALT. ────
describe("enforce-flip (c2) — the full fail-closed policy halts at FEASIBILITY", () => {
  it("an organ INVOCATION error → HALTED (never admit on a step failure)", async () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "true";
    const goalId = await seed("FEASIBILITY");
    const d = deps(stubOrgans({
      classify: classification(),
      reach: async () => { throw new Error("model down"); },
    }));

    await driveToStable(goalId, d);

    expect((await readContract(goalId))!.state).toBe("HALTED");
    expect(draftsFor(goalId)[0]).toMatchObject({ reason: "organ_error" });
  });

  it("reachable but BELOW the confidence floor → HALTED (low_confidence)", async () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "true";
    const goalId = await seed("FEASIBILITY");
    const d = deps(stubOrgans({ classify: classification(), reach: reachable({ confidence: 0.5 }), plan: plannedOk() }));

    await driveToStable(goalId, d);

    expect((await readContract(goalId))!.state).toBe("HALTED");
    expect(draftsFor(goalId)[0]).toMatchObject({ reason: "low_confidence" });
  });

  it("consequential-or-irreversible → HALTED (escalate to the founder, do not autonomously admit)", async () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "true";
    const goalId = await seed("FEASIBILITY");
    const d = deps(stubOrgans({ classify: classification({ consequentiality: "high", reversibility: "irreversible" }), reach: reachable(), plan: plannedOk() }));

    await driveToStable(goalId, d);

    expect((await readContract(goalId))!.state).toBe("HALTED");
    expect(draftsFor(goalId)[0]).toMatchObject({ reason: "consequential_or_irreversible" });
  });
});

// ── (d) flag OFF (and ON-without-organs) → ZERO mutation (exact current behavior). ───────────────────────────
describe("enforce-flip (d) — OFF (default) and ON-without-organs both make ZERO autonomous mutation", () => {
  it("flag OFF: a CREATED goal is untouched by the sweep (current SHADOW behavior)", async () => {
    delete process.env[REASONING_DRIVES_GOALS_FLAG];
    const goalId = await seed("CREATED");

    const res = await reconcileSweep(); // no reasoning deps, no enforce
    for (let i = 0; i < 3; i++) await reconcileSweep();

    expect((await readContract(goalId))!.state).toBe("CREATED"); // no mutation
    expect(res.transitions).toBe(0);
    expect(await eventsFor(goalId)).toEqual([]); // nothing stamped
  });

  it("flag ON but NO organs injected: fail-closed to the exact current behavior (zero mutation)", async () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "true";
    const goalId = await seed("CREATED");

    await reconcileSweep({}); // flag ON, but opts.reasoning is undefined ⇒ fail-closed
    await reconcileSweep({});

    expect((await readContract(goalId))!.state).toBe("CREATED"); // no mutation without the injected capability
    expect(await eventsFor(goalId)).toEqual([]);
  });
});

// ── (e) SOURCE-SCAN: the goal-driver NEVER calls transition() (sole-mutator invariant proven structurally). ──
describe("enforce-flip (e) — the goal-driver never calls transition() (§15 sole-mutator, structural)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const driverPath = resolve(here, "..", "src", "reasoning", "goal-driver.ts");
  const source = readFileSync(driverPath, "utf8");

  /** Strip block + line comments and string/template literals so only executable code remains (prose mentions
   *  of transition() in the doc header must not trip the scan). */
  function codeOnly(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
      .replace(/\/\/[^\n]*/g, " ") // line comments
      .replace(/`(?:\\.|[^`\\])*`/g, "``") // template literals
      .replace(/"(?:\\.|[^"\\])*"/g, '""') // double-quoted strings
      .replace(/'(?:\\.|[^'\\])*'/g, "''"); // single-quoted strings
  }

  it("contains NO transition( call in executable code", () => {
    const code = codeOnly(source);
    expect(code).not.toMatch(/\btransition\s*\(/);
  });

  it("does not import `transition` from goal-contract (imports TYPES only)", () => {
    const importLine = source.match(/import\s+type?\s*\{[^}]*\}\s*from\s*["']\.\.\/goal-contract\.js["']/);
    expect(importLine, "expected a type-only import from goal-contract").not.toBeNull();
    expect(importLine![0]).not.toMatch(/\btransition\b/);
  });
});
