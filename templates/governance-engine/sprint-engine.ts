// =============================================================================
// The Sprint Engine (C10 — the Evidence Cycle). RS-DOS-v1 §9 / §9.1 / §7.2 / §8.3 / §5 / §17.4.
// =============================================================================
// PLATFORM EXTRACTION SLICE 3 — the port-injected mirror of `rumah-admin/src/sprint-engine-c10.ts`. THE
// UNATTENDED, EVIDENCE-BOUNDED EXECUTOR — the `runSprint` that ADVANCES a goal one increment, bounded by the H1
// budget cap, writing attempt/cost/progress evidence through the sanctioned append-only doors.
//
// WHAT CHANGED vs admin (and ONLY this): the STORE/CONTRACT access path. Admin imported the value store
// functions directly from `./runtime-stores.js` (which imports `./db/client.js`) as the `realStores` DEFAULT,
// and the `GoalContractRow`/`BudgetCap` types from `./goal-contract.js`. THIS module imports NO DB — the store
// seam (`SprintStores`) is now a `Pick<>` of the injected `RuntimeStoresPort`, the `realStores` DB default is
// REMOVED (the consumer supplies the port; the residency invariant forbids a DB default), and the contract row /
// budget-cap types are the slice-1 `./ports.js` types. The `createSprintEngine` factory composes BOTH ports:
// `RuntimeStoresPort` (the evidence doors) + `GoalContractStorePort` (to source the contract row whose H1
// budget_cap bounds the work). The decision core — `runSprint`, `capAxis`/`capFor` (the FAIL-CLOSED budget
// guard), `deterministicStepId`, the H1 turn/cost bounds, the idempotency + abort→dead_letter paths — is
// BYTE-FOR-BYTE the verified admin logic.
//
// ── THE H1 CAP IS THE LOAD-BEARING PROPERTY, PRESERVED ──
//   The engine STOPS at the cap and the ledger NEVER exceeds it. A malformed/≤0 budget axis DISABLES THE WORK,
//   never the BOUND (`capAxis` fail-closed to 0 → ZERO work, not unbounded). The package's regression self-test
//   re-runs the verified cap table (turn bound, cost bound, malformed-budget fail-closed) against the in-memory
//   ports and proves the bound is byte-identical.
//
// ── §15 IS UNAFFECTED (the load-bearing structural invariant), PRESERVED ──
//   This engine NEVER mutates GoalContract STATE: it does NOT import or call `transition()`. It READS the
//   contract row only for its budget_cap. Mutating the lifecycle state is the RECONCILER's job (the sole mutator,
//   §15). The single-mutator scan therefore still finds ZERO `.transition(` callers here.
//
// ── THE SPAWNER IS INJECTABLE; THE REAL ONE IS DEFERRED ──
//   `realWorkerQueueSpawn` THROWS "DEFERRED" (the serverless host is unproven — the autonomy host must be a
//   worker/queue), so no path silently spawns a real agent. SHADOW injects a STUB spawner.
//
// NOT IN THIS SLICE: `asControllerHook` (the type-enforced fit to the `po-autoloop-c2` controller's
//   DEFERRED_EXECUTOR.runSprint hook) is DEFERRED to slice 4 — it depends on the `po-autoloop` controller types,
//   which land in slice 4. It is additive composition glue (a compile-time seam proof), NOT decision logic;
//   omitting it changes no runtime behaviour of the cap-bounded executor.
// =============================================================================

import { createHash } from "node:crypto";
import type {
  GoalContractRow,
  GoalState,
  BudgetCap,
  RuntimeStoresPort,
  GoalContractStorePort,
} from "./ports.js";
// slice-4 seam: the controller's runSprint hook shape (type-only — no value/runtime coupling, no cycle).
import type { RunSprintInput, SprintExecutor } from "./po-autoloop.js";

// ── The injectable spawner (the V-H worker/queue headless-Claude mechanism) ──────────────────────────────
export interface SpawnInput {
  goalId: string;
  sprintId: string;
  stepIndex: number;
  /** the stable, deterministic step identity (the attempt-ledger + idempotency key root). */
  stepId: string;
  objective: string;
  contractState: GoalState;
}

export interface SpawnOutput {
  /** the work product (a diff/artifact ref) — the durable work evidence for this step. */
  workOutput: string;
  /** the cost this step consumed (cents) — appended to the portfolio_cost_ledger (the H1 cost axis). */
  costCents: number;
  /** the acceptance-metric movement this step contributed (recorded as the attempt-ledger delta). */
  metricDelta?: number | null;
  /** the recorded hypothesis (attempt-ledger). */
  hypothesis?: string;
  /** the recorded action (attempt-ledger). */
  action?: string;
  /** an aborted spawn (the worker/queue job died) → dead_letter + breaker, NOT silently lost. */
  aborted?: boolean;
  abortReason?: string;
}

export type Spawner = (input: SpawnInput) => Promise<SpawnOutput>;

/**
 * The REAL spawner — the V-H worker/queue headless-Claude unattended spawn. DEFERRED: it THROWS. Wiring this in
 * is a later slice with ZERO engine changes (the seam is `Spawner`); until then no path can silently spawn a
 * real agent.
 */
export const realWorkerQueueSpawn: Spawner = async () => {
  throw new Error(
    "sprint-engine-c10: realWorkerQueueSpawn is DEFERRED (the V-H worker/queue headless-Claude spawn) — the " +
      "spawn MECHANISM is proven GO-WITH-CONDITIONS but the SERVERLESS host is NOT; the autonomy host must be a " +
      "worker/queue (panel-gated + the enforce-flip, founder ★). The engine ticks the evidence cycle over an " +
      "INJECTED stub spawner and spawns no real agent.",
  );
};

/** A STUB spawner (SHADOW) — returns fixture work output + a fixed per-step cost + a metric increment. Used to
 *  prove the evidence cycle + the H1-cap bound against fixtures WITHOUT spawning any real agent. */
export function makeStubSpawner(opts: {
  costCentsPerStep?: number;
  metricDeltaPerStep?: number;
  /** step indices (0-based) that should report an aborted spawn (to exercise the dead_letter path). */
  abortSteps?: number[];
} = {}): Spawner {
  const cost = opts.costCentsPerStep ?? 100;
  const delta = opts.metricDeltaPerStep ?? 0.1;
  const abort = new Set(opts.abortSteps ?? []);
  return async (input: SpawnInput): Promise<SpawnOutput> => {
    if (abort.has(input.stepIndex)) {
      return { workOutput: "", costCents: 0, aborted: true, abortReason: `stub: simulated worker/queue abort at step ${input.stepIndex}` };
    }
    return {
      workOutput: `stub-work[${input.stepId}]: applied one increment toward "${input.objective}"`,
      costCents: cost,
      metricDelta: delta,
      hypothesis: `the thinnest slice that moves the acceptance metric (stub step ${input.stepIndex})`,
      action: `stub spawn (NO real agent) — fixture work output`,
    };
  };
}

// ── The re-probe seam (the metric movement evidence) ─────────────────────────────────────────────────────
/** Re-read the acceptance metric AFTER the sprint's work — the ProgressSample appended to the goal_delta
 *  ledger. The real re-read is the MetricProbe substrate (invokeProbe under the GS's own identity); SHADOW
 *  injects a fixture re-probe. Returns null when unreadable (recorded as a null sample). */
export type Reprobe = (goalId: string) => Promise<number | null>;

// ── The store seam (the sanctioned 0052 doors) — a SUBSET of the injected RuntimeStoresPort ───────────────
// EXTRACTION CHANGE: admin typed this as `typeof recordAttempt` (the DB functions) with a `realStores` default.
// Here it is a `Pick<>` of the injected `RuntimeStoresPort` — structurally a subset of the slice-2 port, with NO
// DB default. The 10 methods are the exact sanctioned doors the engine writes/reads through.
export type SprintStores = Pick<
  RuntimeStoresPort,
  | "recordAttempt"
  | "appendCost"
  | "countAttempts"
  | "readCumulativeCost"
  | "appendProgressSample"
  | "reserveIntent"
  | "consumeIntent"
  | "isConsumed"
  | "recordFailure"
  | "recordDeadLetter"
>;

/** Re-point the engine's `SprintStores` seam onto the injected `RuntimeStoresPort` (the 6 C12 durable stores).
 *  This is the WHOLE of the store-access inversion vs admin: admin bound these to the `./runtime-stores.js` DB
 *  functions (`realStores`); here they cross the injected port. NO DB, NO default. */
export function runtimeStoresPortToSprintStores(port: RuntimeStoresPort): SprintStores {
  return port;
}

// ── The sprint context (every seam; provider-agnostic, inert until configured) ───────────────────────────
export interface SprintContext {
  /** the injectable spawner. DEFAULT = realWorkerQueueSpawn (DEFERRED — throws). SHADOW injects a stub. */
  spawn?: Spawner;
  /** the metric re-probe AFTER the work (the ProgressSample). DEFAULT = a null re-read (fail-closed). */
  reprobe?: Reprobe;
  /** the durable store seam — the injected `RuntimeStoresPort` subset. REQUIRED (no DB default in the package). */
  stores: SprintStores;
  /** a stable sprint identity (the idempotency + attempt-ledger key root). REQUIRED for idempotent re-runs. */
  sprintId: string;
  /** how many work steps this sprint WANTS to run (the planned work). The H1 cap BOUNDS this below it. */
  plannedSteps: number;
  /** the goal_delta_ledger cycle for this sprint's ProgressSample (idempotent on goal_id+cycle). */
  cycle: number;
  /** the objective text handed to the spawner. Default = the contract objective. */
  objective?: string;
  /** the durable breaker threshold for an aborted step (default 3). */
  breakerThreshold?: number;
}

// ── Evidence records (the SHADOW report surface) ─────────────────────────────────────────────────────────
export interface StepEvidence {
  stepIndex: number;
  stepId: string;
  /** "advanced" (work posted + recorded) · "skipped" (idempotent — already done) · "aborted" (dead_letter). */
  outcome: "advanced" | "skipped" | "aborted";
  workOutput: string;
  costCents: number;
  metricDelta: number | null;
  /** the cumulative cost AFTER this step (the H1 cost axis, durable). */
  cumulativeCostCents: number;
  /** the dead_letter id when the step aborted (the durable surface — not silently lost). */
  deadLetterId?: string;
  note: string;
}

export type SprintResultKind =
  | "objective_advanced" //  work posted + the metric re-probed (the normal evidence cycle)
  | "halted_at_cap" //       the H1 cap bound the sprint (stopped at the cap; ledger ≤ cap)
  | "aborted_dead_letter" // a spawn aborted past the breaker → dead_letter surfaced
  | "no_work"; //            nothing to do (0 planned steps, or all already done)

export interface SprintEvidence {
  goalId: string;
  sprintId: string;
  /** the per-step evidence (work output + cost + delta + outcome). */
  evidence: StepEvidence[];
  /** total attempts recorded on the goal AFTER this sprint (durable countAttempts) — bounded by max_turns. */
  attemptsUsed: number;
  /** cumulative cost on the goal AFTER this sprint (durable readCumulativeCost) — bounded by max_cost_cents. */
  costUsed: number;
  /** the ProgressSamples this sprint appended to the goal_delta_ledger (the re-probed metric movement). */
  progressSamples: Array<{ cycle: number; value: number | null }>;
  /** THE load-bearing property: true iff the sprint STOPPED because the H1 cap was reached (ledger never exceeds). */
  halted_at_cap: boolean;
  result: SprintResultKind;
  /** the H1 cap envelope this sprint was bounded by (for the report). */
  cap: { maxTurns: number | null; maxCostCents: number | null };
}

// ── small helpers ────────────────────────────────────────────────────────────────────────────────────────
// The step identity is a DETERMINISTIC uuid derived from (sprintId, stepIndex) — stable across re-runs, so the
// idempotency reserve + the attempt_ledger (step_id is a uuid column) make a re-run skip the same step (no
// double-spend). A random uuid would defeat idempotency. SHA-1 over the seed, formatted 8-4-4-4-12 with the v5
// version/variant nibbles set (a valid, namespaced uuid).
function deterministicStepId(sprintId: string, stepIndex: number): string {
  const h = createHash("sha1").update(`sprint-engine-c10::${sprintId}::step::${stepIndex}`).digest("hex");
  const v = "5" + h.slice(13, 16); // version 5
  const y = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20); // variant 10xx
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${v}-${y}-${h.slice(20, 32)}`;
}

// Resolve ONE budget axis to a cap, FAIL-CLOSED. A malformed budget must DISABLE THE WORK, never the BOUND —
// the cap can NEVER be disabled by its own input (the same fail-closed lean the GS and C6 hold). Three cases:
//   * ABSENT (undefined/null) → null = uncapped on this axis (legitimate: an unset bound per the BudgetCap spec).
//   * PRESENT but MALFORMED (NaN / Infinity / negative / a non-number) OR ≤ 0 → cap 0 = ZERO work (the sprint
//     immediately halts at the cap, recording no attempt/cost). A negative `max_turns:-5` therefore yields 0 work.
//   * PRESENT, finite, > 0 → the bound itself.
function capAxis(v: unknown): number | null {
  if (v === undefined || v === null) return null; // absent → uncapped on this axis (legitimate)
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0; // malformed / ≤0 → FAIL-CLOSED to 0
  return v; // finite positive → the bound
}

function capFor(budget: BudgetCap): { maxTurns: number | null; maxCostCents: number | null } {
  return { maxTurns: capAxis(budget?.max_turns), maxCostCents: capAxis(budget?.max_cost_cents) };
}

// =============================================================================
// runSprint() — ONE evidence-bounded sprint iteration. The H1 cap is the hard bound; the engine writes
// attempt/cost/progress evidence through the sanctioned doors and NEVER mutates GoalContract state (§15).
// =============================================================================
export async function runSprint(contract: GoalContractRow, ctx: SprintContext): Promise<SprintEvidence> {
  const spawn = ctx.spawn ?? realWorkerQueueSpawn; // DEFAULT = DEFERRED (throws) — no silent real spawn
  const reprobe = ctx.reprobe ?? (async () => null);
  const stores = ctx.stores; // the INJECTED RuntimeStoresPort subset — no DB default (residency invariant)
  const objective = ctx.objective ?? contract.objective;
  const goalId = contract.goalId;
  const cap = capFor(contract.budgetCap ?? {});
  const breakerThreshold = ctx.breakerThreshold ?? 3;

  // Baselines from the DURABLE ledgers — this sprint's bound COMPOSES prior sprints' spend (the H1 cap is the
  // cumulative bound on unattended work for the whole goal, not just this sprint).
  let attemptsUsed = await stores.countAttempts(goalId);
  let costUsed = await stores.readCumulativeCost(goalId);

  const evidence: StepEvidence[] = [];
  const progressSamples: Array<{ cycle: number; value: number | null }> = [];
  let aborted_dead_letter = false;

  // ── FAIL-CLOSED BUDGET GUARD — a present-but-malformed (NaN/Infinity/negative/non-number) or ≤0 budget axis
  //    resolved to cap 0. A malformed budget DISABLES THE WORK, never the bound: halt IMMEDIATELY, before any
  //    spawn, with ZERO attempts/cost (the cap can never be disabled by its input). The work loop is skipped. ──
  const budgetFailClosed = cap.maxTurns === 0 || cap.maxCostCents === 0;
  let halted_at_cap = budgetFailClosed;

  for (let i = 0; i < ctx.plannedSteps && !budgetFailClosed; i++) {
    // ── THE H1 TURN BOUND (deterministic, pre-spawn) — one step records exactly one attempt; stop BEFORE the
    //    step that would breach max_turns, so the attempt_ledger NEVER exceeds the cap. ──
    if (cap.maxTurns !== null && attemptsUsed + 1 > cap.maxTurns) {
      halted_at_cap = true;
      break;
    }

    const stepId = deterministicStepId(ctx.sprintId, i); // a stable uuid (attempt_ledger.step_id is uuid)
    const intentKey = `sprint-step::${ctx.sprintId}::${i}`; // text idempotency key — stable across re-runs

    // ── IDEMPOTENCY (write-ahead-intent) — reserve BEFORE the side-effect. A re-run finds the intent already
    //    taken → skip (no double-spend). EXACTLY ONE caller ever owns the side-effect for a given stepId. ──
    const { reserved } = await stores.reserveIntent(intentKey, { scope: "sprint-step" });
    if (!reserved) {
      const done = await stores.isConsumed(intentKey);
      evidence.push({
        stepIndex: i, stepId, outcome: "skipped", workOutput: "", costCents: 0, metricDelta: null,
        cumulativeCostCents: costUsed,
        note: done ? "idempotent skip — this step was already completed (intent consumed); not re-spent"
                   : "idempotent skip — this step's intent is reserved by another runner; not re-spent",
      });
      continue;
    }

    // ── SPAWN the work via the INJECTABLE spawner (the V-H worker/queue mechanism; real = DEFERRED/throws). ──
    const out = await spawn({ goalId, sprintId: ctx.sprintId, stepIndex: i, stepId, objective, contractState: contract.state });

    // ── ABORT — the spawned worker died → durable breaker + dead_letter (surfaces, never silently lost, F15). ──
    if (out.aborted) {
      const breaker = await stores.recordFailure(stepId, { goalId, threshold: breakerThreshold });
      let deadLetterId: string | undefined;
      if (breaker.breakerState === "open") {
        deadLetterId = await stores.recordDeadLetter({ stepId, goalId, reason: out.abortReason ?? "spawn aborted (breaker exhausted)", payload: { sprintId: ctx.sprintId, stepIndex: i } });
        aborted_dead_letter = true;
      }
      // The intent stays RESERVED-but-unconsumed: the dead_letter is the durable surface, so the work is not
      // lost; a re-run will skip the poisoned step (it does not silently retry a dead worker in this slice).
      evidence.push({
        stepIndex: i, stepId, outcome: "aborted", workOutput: "", costCents: 0, metricDelta: null,
        cumulativeCostCents: costUsed, deadLetterId,
        note: `aborted spawn — breaker ${breaker.breakerState} (count ${breaker.breakerCount})` + (deadLetterId ? ` → dead_letter ${deadLetterId}` : ""),
      });
      if (breaker.breakerState === "open") break; // poison surfaced → stop this sprint (the reconciler escalates)
      continue;
    }

    // ── THE H1 COST BOUND (data-dependent, post-spawn / pre-append) — the step's cost is only known after the
    //    spawn; if appending it would breach max_cost_cents, STOP and DO NOT append, so the cost ledger NEVER
    //    exceeds the cap. (The work output is discarded — the cap is the hard bound, not best-effort.) ──
    if (cap.maxCostCents !== null && costUsed + out.costCents > cap.maxCostCents) {
      halted_at_cap = true;
      // release nothing — the intent stays reserved-unconsumed; this step never spent, so no double-count.
      break;
    }

    // ── RECORD THE EVIDENCE (attempt + cost) through the sanctioned append-only doors (the engine is the WRITER). ──
    await stores.recordAttempt({
      goalId, stepId, attempt: 1, hypothesis: out.hypothesis ?? null, action: out.action ?? null,
      delta: out.metricDelta ?? null, outcome: "advanced",
    });
    const { cumulativeCostCents } = await stores.appendCost({ goalId, costCents: out.costCents });
    await stores.consumeIntent(intentKey); // confirm AFTER the side-effect (write-ahead-intent closed)

    attemptsUsed += 1;
    costUsed = cumulativeCostCents;
    evidence.push({
      stepIndex: i, stepId, outcome: "advanced", workOutput: out.workOutput, costCents: out.costCents,
      metricDelta: out.metricDelta ?? null, cumulativeCostCents, note: "work posted + attempt/cost recorded (durable evidence)",
    });
  }

  // ── PRODUCE THE METRIC-MOVEMENT EVIDENCE — re-probe the acceptance metric AFTER the work and append ONE
  //    ProgressSample to the goal_delta_ledger (idempotent on goal_id+cycle; a re-run does not double-append). ──
  const reprobed = await reprobe(goalId);
  const appended = await stores.appendProgressSample({ goalId, cycle: ctx.cycle, value: reprobed });
  if (appended) progressSamples.push({ cycle: ctx.cycle, value: reprobed });

  // Re-read the durable totals so the report reflects on-disk state (the bound is proven against the ledger).
  attemptsUsed = await stores.countAttempts(goalId);
  costUsed = await stores.readCumulativeCost(goalId);

  const advanced = evidence.some((e) => e.outcome === "advanced");
  const result: SprintResultKind = halted_at_cap
    ? "halted_at_cap"
    : aborted_dead_letter
      ? "aborted_dead_letter"
      : advanced
        ? "objective_advanced"
        : "no_work";

  return { goalId, sprintId: ctx.sprintId, evidence, attemptsUsed, costUsed, progressSamples, halted_at_cap, result, cap };
}

// =============================================================================
// createSprintEngine — the port-COMPOSED bootstrap (the C10 engine wired onto BOTH ports).
// =============================================================================
// Composes the slice-2 `RuntimeStoresPort` (the evidence doors the engine writes/reads) AND the slice-1
// `GoalContractStorePort` (the durable contract whose §4.1 budget_cap is the H1 envelope the engine is bounded
// by). `runSprintForGoal` SOURCES the contract row from the contract port (instead of the caller hand-passing
// it), derives the `SprintStores` from the runtime port, then calls the UNCHANGED `runSprint`. The verified
// evidence-cycle + cap logic is untouched — this factory is additive composition glue. §15 holds: the engine
// READS the contract (for budget_cap) but NEVER transitions it.
export interface SprintEnginePorts {
  /** the 6 C12 durable stores (the evidence doors the engine writes/reads through). */
  store: RuntimeStoresPort;
  /** the durable PO contract — supplies the contract row whose §4.1 budget_cap bounds the sprint. */
  contract?: GoalContractStorePort;
}

export interface SprintEngine {
  /** Run one evidence-bounded sprint for a contract ROW (the caller supplies the row + the per-sprint ctx; the
   *  injected store is filled in). */
  runSprint(contract: GoalContractRow, ctx: Omit<SprintContext, "stores"> & { stores?: SprintStores }): Promise<SprintEvidence>;
  /** Run one sprint for a goalId, SOURCING the contract row (the H1 budget envelope) from the contract port. */
  runSprintForGoal(goalId: string, ctx: Omit<SprintContext, "stores"> & { stores?: SprintStores }): Promise<SprintEvidence>;
  /** the derived narrow store seam (exposed for diagnostics / direct runSprint use). */
  readonly sprintStores: SprintStores;
}

export function createSprintEngine(ports: SprintEnginePorts): SprintEngine {
  const sprintStores = runtimeStoresPortToSprintStores(ports.store);
  return {
    sprintStores,
    runSprint(contract, ctx) {
      return runSprint(contract, { ...ctx, stores: ctx.stores ?? sprintStores });
    },
    async runSprintForGoal(goalId, ctx) {
      if (!ports.contract) {
        throw new Error("sprint-engine-c10: runSprintForGoal needs a GoalContractStorePort to source the contract row (none injected)");
      }
      const contract = await ports.contract.readContract(goalId);
      if (!contract) throw new Error(`sprint-engine-c10: goal_contract ${goalId} not found`);
      return runSprint(contract, { ...ctx, stores: ctx.stores ?? sprintStores });
    },
  };
}

// =============================================================================
// asControllerHook — the type-enforced fit to the po-autoloop controller's DEFERRED `SprintExecutor.runSprint`
// hook (the slice-4 seam admin deferred). ADDITIVE COMPOSITION GLUE, not decision logic: it adapts a
// `SprintEngine` into the controller's `(input: RunSprintInput) => Promise<{ note: string }>` shape, sourcing the
// per-sprint params from the tick input + the supplied options, then delegating to the UNCHANGED
// `runSprintForGoal`. Wiring it changes NO runtime behaviour of the cap-bounded executor; it just lets the C10
// engine plug into the controller (the loop ticks the GOVERNANCE; the engine advances the metric between ticks).
// The controller's §15 is unaffected — the sprint engine writes evidence and NEVER mutates GoalContract state.
// =============================================================================

export interface ControllerHookOptions {
  /** derive a STABLE sprint id per tick (the idempotency + attempt-ledger key root). Default: goalId::tickIndex. */
  sprintId?: (input: RunSprintInput) => string;
  /** how many work steps each tick's sprint WANTS to run (the H1 cap bounds it). Default 1. */
  plannedSteps?: number;
  /** the goal_delta_ledger cycle for the sprint's ProgressSample. Default: the tick index. */
  cycle?: (input: RunSprintInput) => number;
  /** the injectable spawner (SHADOW = a stub; real = DEFERRED). */
  spawn?: Spawner;
  /** the metric re-probe AFTER the work. */
  reprobe?: Reprobe;
  breakerThreshold?: number;
}

/** Adapt a `SprintEngine` into the controller's `SprintExecutor.runSprint` hook. */
export function asControllerHook(engine: SprintEngine, opts: ControllerHookOptions = {}): NonNullable<SprintExecutor["runSprint"]> {
  return async (input: RunSprintInput) => {
    const evidence = await engine.runSprintForGoal(input.goalId, {
      sprintId: opts.sprintId ? opts.sprintId(input) : `${input.goalId}::${input.tickIndex}`,
      plannedSteps: opts.plannedSteps ?? 1,
      cycle: opts.cycle ? opts.cycle(input) : input.tickIndex,
      spawn: opts.spawn,
      reprobe: opts.reprobe,
      breakerThreshold: opts.breakerThreshold,
    });
    return {
      note:
        `sprint ${evidence.sprintId}: ${evidence.result} ` +
        `(${evidence.attemptsUsed} attempts / ${evidence.costUsed}¢, halted_at_cap=${evidence.halted_at_cap})`,
    };
  };
}
