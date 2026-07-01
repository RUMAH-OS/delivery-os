// =============================================================================
// The PO auto-loop / goal-lifecycle controller (C2 — the level-triggered controller that runs a goal
// through its ENTIRE §4.3 lifecycle). RS-DOS-v1 §4.3 (the state machine) · §4.4 (the level-triggered tick) ·
// §15 (the reconciler is the SOLE mutator) · §37.3 / OM-INV-2/3 (the PO-organ auto-loop). Sprint 5.2, first slice.
// =============================================================================
// THIS IS THE "ASSEMBLE THE HEART" INTEGRATION. It COMPOSES the five now-built, independently-verified
// goal-governance organs into ONE coherent loop. It re-implements NOTHING: no re-detecting progress (the GS
// owns that), no re-deciding reconcile (the reconciler owns that), and — load-bearing — NO SECOND STATE
// MUTATOR: this module NEVER imports or calls goal-contract.transition(); every contract transition goes
// through the reconciler's sole-mutator door (applyReconcilePlan), preserving §15. The single-mutator source
// scan (scripts/po-reconciler-c2.ts --self-test) therefore still finds exactly ONE caller of transition()
// in src/ (po-reconciler-c2.ts) — this controller is not a second one.
//
// ── How each organ is COMPOSED in the loop (provenance) ──
//   ADMISSION   ← evaluatePreflight (src/preflight-gate-c9.ts): admit/REFUSE at hour 0. REFUSE → no contract,
//                 a feasibility FAP via summon. ADMIT → createContract (src/goal-contract.ts), CREATED.
//   STATE       ← createContract / readContract (src/goal-contract.ts). The controller READS the durable
//                 contract each tick; it MUTATES it ONLY via the reconciler (never transition() directly).
//   OBSERVE     ← the GS's external re-read this tick (the injected re-probe value — the real
//                 metric-probe.invokeProbe + the unattended executor that MOVES the metric are DEFERRED, 5.1)
//                 recorded append-only via appendProgressSample (src/runtime-stores.ts) — the observed state.
//   SUPERVISE   ← evaluateGoalSupervision + composeHaltAndFap (src/goal-supervisor-c7.ts): the no-progress
//                 watch; on a flat delta it DRAFTS a HALT (executed:false) — CONSUMED, never recomputed.
//   RECONCILE   ← reconcile + applyReconcilePlan (src/po-reconciler-c2.ts): THE SOLE MUTATOR. It turns the GS's
//                 drafted HALT into a real §4.3 transition toward HALTED, advances EXECUTING→REVIEWING (the
//                 review boundary), and settles a terminal goal to a no-op (idempotency). It does NOT route
//                 REVIEWING→DONE on its own observed metric inside the lifecycle — that boundary is C6-gated.
//   REVIEW      ← reviewCompletion (src/completion-review-c6.ts) + decideNextBoundary (src/boundary-plan-c2mind.ts):
//                 at a §4.3 REVIEWING boundary C6 independently RE-PROBES the metric and OWNS the verdict; the
//                 controller then asks decideNextBoundary which legal edge to drive (COMPLETE→DONE ·
//                 INCOMPLETE+reachable→PLANNING · INCOMPLETE+GS-unreachable→HALTED) and hands the reconciler
//                 THAT C6-gated target. So a goal reaches DONE IF AND ONLY IF C6's INDEPENDENT re-probe confirms
//                 COMPLETE — the goal-level twin of the GS's loop-can't-lie property; the loop CANNOT self-certify
//                 done (B1 fix). C6 OWNS the DONE verdict structurally, not as a stand-in.
//   SUMMON      ← summon + fapFrom{Preflight,GoalSupervisorHalt,CompletionReview} (src/founder-summon-c1.ts):
//                 a summon-worthy boundary (pre-flight REFUSE · GS HALT · a C6 verdict that summons the founder
//                 — INCOMPLETE+unreachable→HALTED) is delivered to the founder and is NEVER dropped.
//
// ── The EXECUTION hook is STUBBED / DEFERRED (the Sprint Engine, Sprint 5.1) ──
//   The actual unattended work BETWEEN ticks — spawning agents to ADVANCE the goal — is the Sprint Engine
//   (5.1). It is a pluggable `executor` injected param whose default THROWS "DEFERRED" (modelled on §36.3's
//   deferred LLM and boundary-plan-c2mind's deferred planner), so no path silently spawns real work. This
//   slice ticks the GOVERNANCE over an INJECTED / fixture observed-state; a later slice (5.1) slots the real
//   executor in with ZERO controller changes.
//
// ── SHADOW posture (this slice) ──
//   DEFAULT = SHADOW: runGoalLifecycle runs a FIXTURE goal through the lifecycle (pure / in-memory — no DB,
//   no live goal), reports the state path + the would-summons + the per-tick decisions, and mutates nothing
//   (applyReconcilePlan in SHADOW drafts the would-transition with executed:false). `--enforce` proves the
//   real-transition capability against TEST-DB fixtures ONLY, behind a founder-★ banner. There is NO live
//   goal flow yet (Sprint 5.3), so nothing live is ever mutated. OUT OF SCOPE: the real Sprint Engine 5.1
//   (executor hook only — deferred); the Slack /goal surface 5.3; driving a LIVE goal; summon-storm triage.
// =============================================================================

import {
  createContract,
  readContract,
  type GoalContractRow,
  type GoalState,
  type BudgetCap,
  type CreateGoalContractInput,
} from "./goal-contract.js";
import {
  evaluatePreflight,
  type PreflightGoal,
  type PreflightContext,
  type PreflightVerdict,
} from "./preflight-gate-c9.js";
import {
  evaluateGoalSupervision,
  composeHaltAndFap,
  DEFAULT_GRACE_FLOOR,
  DEFAULT_WINDOW,
  DEFAULT_EPSILON,
  type GoalSupervisionFacts,
  type GoalSupervisionVerdict,
  type ExternalReprobe,
  type ProgressPoint,
  type AcceptanceShape,
  type GraceFloor,
} from "./goal-supervisor-c7.js";
import {
  reconcile,
  applyReconcilePlan,
  type ReconcilePlan,
  type ReconcileExecution,
  type ObservedState,
  type LegalEdge,
  type ReconcileDecision,
} from "./po-reconciler-c2.js";
import {
  reviewCompletion,
  type CompletionReview,
  type CompletionReviewContext,
} from "./completion-review-c6.js";
import { decideNextBoundary, type NextBoundary } from "./boundary-plan-c2mind.js";
import {
  summon,
  defaultChannelChain,
  fapFromPreflightRefusal,
  fapFromGoalSupervisorHalt,
  fapFromCompletionReview,
  type SummonResult,
  type ChannelSeam,
  type SummonOptions,
} from "./founder-summon-c1.js";
import { appendProgressSample, readProgressSeries } from "./runtime-stores.js";

// ── Settled (non-tickable) states — mirrors the reconciler's NON_TICKABLE (a GUARD, not a re-implementation
//    of the mutator). A settled goal is re-tick-safe: the loop short-circuits to a pure no-op (idempotency). ──
const SETTLED_STATES: ReadonlyArray<GoalState> = ["DONE", "FAILED", "CLOSED", "HALTED", "SUSPENDED"];
export function isSettled(state: GoalState): boolean {
  return SETTLED_STATES.includes(state);
}

// =============================================================================
// The DEFERRED Sprint Engine executor (Sprint 5.1) — the pluggable execution hook, DEFAULT THROWS.
// =============================================================================
// Two responsibilities, BOTH the unattended-autonomy build (panel-gated + the headless-invocation [VALIDATE]
// spike, OM-INV-2/3): (a) `admitToExecuting` — bring an admitted CREATED contract up to EXECUTING (C2-MIND
// drafts → pre-flight ADMIT actuates FEASIBILITY→ACTIVE → C2-MIND plans a sprint → PLANNING→EXECUTING); and
// (b) `runSprint` — the unattended sprint work that ADVANCES the metric between ticks. Both DEFAULT to throwing
// "DEFERRED", exactly like §36.3's evaluateReachability and boundary-plan-c2mind's planNextSprint, so no path
// silently spawns real work; a later slice (5.1) slots the real executor in with ZERO controller changes.
export interface RunSprintInput {
  goalId: string;
  tickIndex: number;
  contractState: GoalState;
}
export interface SprintExecutor {
  /** Sprint 5.1 — ramp an admitted CREATED contract to EXECUTING via the legal §4.3 edges (C2-MIND/C9). Returns
   *  the resulting state. DEFERRED by default (throws). A real impl drives the ramp through the reconciler. */
  admitToExecuting?: (contract: GoalContractRow) => Promise<{ state: GoalState; transitions: string[]; note: string }>;
  /** Sprint 5.1 — the unattended work that advances the goal one increment between ticks. DEFERRED (throws). */
  runSprint?: (input: RunSprintInput) => Promise<{ note: string }>;
}

/** The default executor — every hook DEFERRED (throws by design). The governance still ticks over the injected
 *  observed-state; the deferred hooks prove the controller has NO silent dependency on un-built work. */
export const DEFERRED_EXECUTOR: SprintExecutor = {
  admitToExecuting: async () => {
    throw new Error(
      "po-autoloop-c2: admitToExecuting is DEFERRED (Sprint 5.1 / the C2-MIND sprint planner) — bringing an " +
        "admitted goal CREATED→…→EXECUTING is the unattended-autonomy build (panel-gated + the headless " +
        "[VALIDATE] spike); the gate/structure is built, the ramp is sequenced (slots in with zero controller changes)",
    );
  },
  runSprint: async () => {
    throw new Error(
      "po-autoloop-c2: runSprint is DEFERRED (Sprint 5.1 — the Sprint Engine) — the unattended work that spawns " +
        "agents to ADVANCE the goal between ticks is panel-gated + the headless-invocation [VALIDATE] spike; this " +
        "slice ticks the GOVERNANCE over injected observed-state and spawns no real work",
    );
  },
};

// =============================================================================
// The observed-state provider — the injected / fixture observed state per tick.
// =============================================================================
// In this slice the GS's external re-read value comes from here (the real metric-probe.invokeProbe and the
// executor that MOVES the metric are deferred). In Sprint 5.1 the executor runs the sprint and this becomes a
// real invokeProbe re-read; the controller is unchanged.
export interface ObservedTickInput {
  /** the cycle index for the goal-delta ledger append (idempotent on goal_id+cycle). */
  cycle: number;
  /** the GS's external re-read of the acceptance metric this tick (null = unreadable → fail-closed). */
  metricValue: number | null;
  /** did the external re-probe succeed? default true. */
  reprobeOk?: boolean;
  /** dEffort: attempts consumed so far. */
  attempts: number;
  /** dEffort: cumulative cost consumed so far (cents). */
  cumulativeCostCents: number;
  /** the loop-fingerprint fix ref for this sample (a repeated ref strengthens a stall verdict). */
  fixRef?: string | null;
  /** boundary signal: all sprint work posted (advance EXECUTING→REVIEWING for the completion review). */
  allWorkPosted?: boolean;
}

export type ObservedProvider = (goalId: string, tickIndex: number, state: GoalState) => Promise<ObservedTickInput>;

// =============================================================================
// The lifecycle context — every injected seam (provider-agnostic; inert until configured).
// =============================================================================
export interface LifecycleContext {
  /** the frozen structured acceptance {op,target,direction} (C2-MIND-derived; consumed by the GS / C6 / reconciler). */
  acceptance: AcceptanceShape;
  /** the H1 budget envelope (the GS dEffort denominator). */
  budgetCap: BudgetCap;
  /** the observed-state provider (fixture / injected). REQUIRED — the executor that would produce it is deferred. */
  observe: ObservedProvider;
  /** the C6 completion-review context (the independent re-probe seam + the frozen acceptance). */
  review: CompletionReviewContext;
  /** the deferred Sprint Engine executor (default = DEFERRED_EXECUTOR — all hooks throw). */
  executor?: SprintExecutor;
  /** GS window / epsilon / grace floor (defaults = the GS defaults). */
  gs?: { window?: number; epsilon?: number; graceFloor?: GraceFloor };
  /** the summon channel chain (default = the C1 3-tier chain). */
  summonChannels?: ChannelSeam[];
  /** summon options (default = SHADOW). */
  summonOpts?: SummonOptions;
  /** ENFORCE: drive REAL §4.3 transitions (TEST-DB fixtures only — never a live goal). Default SHADOW. */
  enforce?: boolean;
  /** persist the GS's external re-read to the durable goal_delta_ledger (ENFORCE/db only). Default = enforce. */
  persistProgress?: boolean;
  /** the maximum ticks runGoalLifecycle will run before stopping (the no-infinite-loop bound). Default 12. */
  maxTicks?: number;
  /** prior observed history (the goal-delta samples the DEFERRED executor's earlier sprints WOULD have produced)
   *  seeded into the series before tick 0, so the GS has enough samples to confirm/deny movement from the first
   *  governed tick. In Sprint 5.1 the real executor produces these; here they are the fixture's history. */
  seedProgress?: ProgressPoint[];
}

// =============================================================================
// Per-tick + lifecycle records (the SHADOW report surface).
// =============================================================================
export interface ObservedSummary {
  cycle: number;
  metricValue: number | null;
  attempts: number;
  cumulativeCostCents: number;
  observedCycles: number;
}

export interface TickRecord {
  tickIndex: number;
  /** the contract state READ at the top of this tick (the level-triggered input). */
  stateBefore: GoalState;
  /** the deferred-executor note (proves runSprint stayed DEFERRED — no silent spawn). */
  executor: string;
  observed: ObservedSummary;
  /** the GS verdict CONSUMED this tick (never recomputed downstream). */
  gsVerdict: GoalSupervisionVerdict;
  /** the C6 completion review, run ONLY at a REVIEWING boundary that is not a GS trip (else null). */
  review: CompletionReview | null;
  /** the C6-GATED boundary (decideNextBoundary over the C6 verdict) — present iff a C6 review ran. The DONE/
   *  PLANNING/HALTED target the reconciler was asked to drive to, decided by C6's INDEPENDENT re-probe (NOT the
   *  loop's observed metric). null when this tick was not a C6 boundary. */
  reviewBoundary: NextBoundary | null;
  /** the reconcile decision + the (would-)transition (the SOLE-MUTATOR plan). */
  plan: ReconcilePlan;
  /** the apply result (executed:true only in ENFORCE; SHADOW drafts executed:false). */
  execution: ReconcileExecution;
  /** the contract state AFTER this tick (the real post-transition state in ENFORCE; the would-be state in SHADOW). */
  stateAfter: GoalState;
  /** the summon delivered this tick (GS HALT or an INCOMPLETE review needing a decision), or null. */
  summon: SummonResult | null;
}

export type LifecyclePhase =
  | "REFUSED_AT_PREFLIGHT" //   pre-flight REFUSE — no contract created; a feasibility FAP summoned
  | "ADMITTED" //              admitted + governed to a settled state (DONE / HALTED / …)
  | "ADMITTED_RAMP_DEFERRED"; // admitted, but the CREATED→EXECUTING ramp is DEFERRED (no executor wired)

export interface LifecycleResult {
  goalId: string | null;
  phase: LifecyclePhase;
  posture: "SHADOW" | "ENFORCE";
  /** the pre-flight verdict (always present — it is the admission gate). */
  preflight: PreflightVerdict;
  /** the admission summon (present iff REFUSED_AT_PREFLIGHT — the feasibility FAP). */
  admissionSummon: SummonResult | null;
  /** the created contract (null iff REFUSED). */
  contract: GoalContractRow | null;
  /** the admission ramp note (how CREATED→EXECUTING was actuated — or why it was deferred). */
  ramp: string;
  /** the per-tick governance records (the state path + decisions + would-summons). */
  ticks: TickRecord[];
  /** the ORDERED state path the goal walked (CREATED → … → terminal). */
  statePath: GoalState[];
  /** every summon delivered across the lifecycle (admission + per-tick). */
  summons: SummonResult[];
  /** the terminal/settled state reached (null iff REFUSED or ramp-deferred). */
  finalState: GoalState | null;
}

// ── small helpers ────────────────────────────────────────────────────────────────────────────────────────
function head(e: unknown): string {
  return (e as Error).message.split(" — ")[0]!;
}

// =============================================================================
// tick() — ONE level-triggered governance step (idempotent). Composes observe → supervise → reconcile →
// (boundary) review → summon. The ONLY mutation door is applyReconcilePlan (the reconciler, §15); this
// function NEVER transitions the contract itself.
// =============================================================================
export async function tick(contract: GoalContractRow, ctx: LifecycleContext, tickIndex: number): Promise<TickRecord> {
  const enforce = ctx.enforce === true;
  const persist = ctx.persistProgress ?? enforce;
  const executor = ctx.executor ?? DEFERRED_EXECUTOR;
  const window = ctx.gs?.window ?? DEFAULT_WINDOW;
  const epsilon = ctx.gs?.epsilon ?? DEFAULT_EPSILON;
  const graceFloor = ctx.gs?.graceFloor ?? DEFAULT_GRACE_FLOOR;
  const channels = ctx.summonChannels ?? defaultChannelChain();
  const summonOpts = ctx.summonOpts ?? { posture: enforce ? "ENFORCE" : "SHADOW" };

  // ── SETTLED short-circuit (idempotency floor) — a re-tick of a settled goal touches NOTHING. ──
  if (isSettled(contract.state)) {
    const observed: ObservedState = {
      progressSeries: [], attempts: 0, cumulativeCostCents: 0, gsVerdict: null, acceptance: ctx.acceptance,
    };
    const plan = reconcile(contract, observed); // → SETTLED, next_transition null
    const execution = await applyReconcilePlan(plan, { enforce });
    // We still build a GS verdict-shaped placeholder for the record (no probe — the goal is settled).
    const placeholderFacts: GoalSupervisionFacts = {
      goalId: contract.goalId, window, epsilon, graceFloor,
      progressSeries: [], externalReprobe: { ok: false, value: null }, effort: { attempts: 0, cumulativeCostCents: 0, budgetCap: ctx.budgetCap },
      acceptance: ctx.acceptance, contractState: contract.state, readable: { progress: false, effort: true },
    };
    return {
      tickIndex, stateBefore: contract.state, executor: "not invoked (goal settled — no work to run)",
      observed: { cycle: -1, metricValue: null, attempts: 0, cumulativeCostCents: 0, observedCycles: 0 },
      gsVerdict: evaluateGoalSupervision(placeholderFacts), review: null, reviewBoundary: null, plan, execution,
      stateAfter: contract.state, summon: null,
    };
  }

  // ── (0) the DEFERRED executor — the unattended work that WOULD advance the goal between ticks (5.1). ──
  let executorNote: string;
  try {
    const r = await executor.runSprint!({ goalId: contract.goalId, tickIndex, contractState: contract.state });
    executorNote = `executor ran: ${r.note}`;
  } catch (e) {
    executorNote = `DEFERRED — ${head(e)} (governance ticks over the injected observed-state; no real work spawned)`;
  }

  // ── (a) OBSERVE — the GS's external re-read this tick (injected / fixture), recorded append-only. ──
  const obs = await ctx.observe(contract.goalId, tickIndex, contract.state);
  const reprobeOk = obs.reprobeOk ?? true;
  const reprobe: ExternalReprobe = {
    ok: reprobeOk, value: obs.metricValue, cycle: obs.cycle,
    probeId: contract.metricSourceProbeId, version: contract.metricSourceVersion,
    note: reprobeOk ? "external re-read (injected — the real invokeProbe + the executor are deferred, 5.1)" : "external re-read FAILED (injected)",
  };
  // record the GS's OWN measurement (the observed state) — durable in ENFORCE, in-memory series in SHADOW.
  let progressSeries: ProgressPoint[];
  if (persist) {
    if (reprobeOk) await appendProgressSample({ goalId: contract.goalId, cycle: obs.cycle, value: obs.metricValue, fixRef: obs.fixRef ?? null });
    progressSeries = (await readProgressSeries(contract.goalId)) as ProgressPoint[];
  } else {
    // SHADOW in-memory observed series — accumulated on the contract row's transient carrier.
    const carrier = shadowSeries.get(contract.goalId) ?? [];
    if (reprobeOk) carrier.push({ cycle: obs.cycle, value: obs.metricValue, fixRef: obs.fixRef ?? null });
    shadowSeries.set(contract.goalId, carrier);
    progressSeries = [...carrier];
  }

  // ── (b) SUPERVISE — the GS (consumed, never recomputed). ──
  const facts: GoalSupervisionFacts = {
    goalId: contract.goalId, window, epsilon, graceFloor,
    progressSeries, externalReprobe: reprobe,
    effort: { attempts: obs.attempts, cumulativeCostCents: obs.cumulativeCostCents, budgetCap: ctx.budgetCap },
    acceptance: ctx.acceptance, contractState: contract.state,
    readable: { progress: reprobeOk, effort: true },
  };
  const gsVerdict = evaluateGoalSupervision(facts);

  // ── (d) COMPLETION REVIEW (C6-GATED DONE BOUNDARY) — at a §4.3 REVIEWING boundary that is NOT a GS trip (the
  //       GS-early-trip path goes straight to HALTED via the reconciler). C6 independently RE-PROBES the metric
  //       and OWNS the verdict; decideNextBoundary (the 3.4 boundary planner) maps it to the legal edge the
  //       controller asks the reconciler to drive: COMPLETE→DONE · INCOMPLETE+reachable→PLANNING ·
  //       INCOMPLETE+GS-unreachable→HALTED. A goal reaches DONE IFF C6 confirms COMPLETE — the loop cannot
  //       self-certify done (the goal-level twin of the GS's loop-can't-lie property; B1 fix). ──
  let review: CompletionReview | null = null;
  let reviewBoundary: NextBoundary | null = null;
  if (contract.state === "REVIEWING" && !gsVerdict.trip) {
    review = await reviewCompletion(contract, ctx.review);
    reviewBoundary = decideNextBoundary(review.verdict, { gsUnreachable: gsVerdict.trip });
  }

  // ── (c) RECONCILE + APPLY — the SOLE MUTATOR (applyReconcilePlan is the ONLY transition() call site, inside
  //       po-reconciler-c2). At the C6 boundary the controller hands the reconciler the C6-GATED target (it only
  //       chooses WHICH legal edge to ask for, on C6's INDEPENDENT verdict — NOT a second mutator); everywhere
  //       else the reconciler decides (CONTINUE / advance-to-REVIEWING / EXECUTE_HALT / SETTLED). ──
  const observed: ObservedState = {
    progressSeries, attempts: obs.attempts, cumulativeCostCents: obs.cumulativeCostCents,
    gsVerdict, currentMetricValue: reprobe.value, acceptance: ctx.acceptance, allWorkPosted: obs.allWorkPosted,
  };
  const plan = reviewBoundary
    ? c6GatedPlan(contract, observed, reviewBoundary, review!)
    : reconcile(contract, observed);
  const execution = await applyReconcilePlan(plan, { enforce });

  // ── (e) SUMMON — a summon-worthy boundary is delivered (never dropped). ──
  let summonResult: SummonResult | null = null;
  if (!reviewBoundary && plan.decision === "EXECUTE_HALT") {
    // the GS drafted a HALT (effort-without-progress) → deliver the feasibility/strategy FAP it composed.
    const halt = composeHaltAndFap(facts, gsVerdict, { cycle: obs.cycle });
    summonResult = await summon(fapFromGoalSupervisorHalt(halt), channels, summonOpts);
  } else if (reviewBoundary && reviewBoundary.to === "HALTED") {
    // C6 INCOMPLETE + GS-unreachable → the goal is independently judged unreachable → a founder decision.
    summonResult = await summon(fapFromCompletionReview(review!), channels, summonOpts);
  }
  // reviewBoundary.to === "DONE": no summon (the result delivery is J10/Slack 5.3, not a feasibility summon).
  // reviewBoundary.to === "PLANNING": no summon (incomplete-but-reachable AUTO-replans the next sprint — the
  // deferred C2-MIND planner; it is not a founder boundary). Either way it is NEVER a contradictory DONE+summon.

  // the post-tick state: the REAL state in ENFORCE (read back); the WOULD-BE state in SHADOW (drafted edge).
  const stateAfter = execution.resulting_state ?? contract.state;

  return {
    tickIndex, stateBefore: contract.state, executor: executorNote,
    observed: { cycle: obs.cycle, metricValue: reprobe.value, attempts: obs.attempts, cumulativeCostCents: obs.cumulativeCostCents, observedCycles: progressSeries.length },
    gsVerdict, review, reviewBoundary, plan, execution, stateAfter, summon: summonResult,
  };
}

// =============================================================================
// c6GatedPlan() — build the ReconcilePlan whose transition target is decided by C6's INDEPENDENT verdict (via
// the 3.4 boundary planner decideNextBoundary), NOT the loop's observed metric. This is a CHOICE of which legal
// §4.3 edge to ask the reconciler to drive — it is NOT a second mutator: applyReconcilePlan still performs the
// only transition() call, and the 0053 DB trigger independently re-validates the edge's legality. The plan's
// observed_state is set to C6's re-probed value (the independent measurement), so the routing and the summary
// can never disagree at the boundary.
// =============================================================================
function c6GatedPlan(contract: GoalContractRow, observed: ObservedState, boundary: NextBoundary, review: CompletionReview): ReconcilePlan {
  const base = reconcile(contract, observed); // reuse the observed_state summary + consumes provenance
  const c6Value = review.evidence.reprobe.value;
  const decision: ReconcileDecision =
    boundary.to === "DONE" ? "TRANSITION_DONE" : boundary.to === "HALTED" ? "EXECUTE_HALT" : "CONTINUE";
  const edge: LegalEdge = { from: "REVIEWING", to: boundary.to, guard: boundary.guard };
  return {
    ...base,
    desired_state: boundary.to,
    observed_state: { ...base.observed_state, currentMetricValue: c6Value, acceptanceMet: review.complete },
    diff:
      `C6-GATED boundary: the INDEPENDENT completion review verdict is ${review.verdict} (re-probed value ${c6Value}, ` +
      `NOT the loop's observed metric ${observed.currentMetricValue}); decideNextBoundary → REVIEWING→${boundary.to} (${boundary.guard}). ` +
      `DONE is reached IFF C6 confirms COMPLETE — the loop cannot self-certify done.`,
    decision,
    next_transition: edge,
    chain: [edge],
    actions: [
      `C6 owns the verdict (${review.verdict}) → drive the legal edge REVIEWING→${boundary.to} (${boundary.guard}); the reconciler EXECUTES it (sole mutator, §15).`,
      boundary.rationale,
    ],
  };
}

// SHADOW-only in-memory observed series (NO DB). Keyed by goalId; cleared per lifecycle. In ENFORCE the durable
// goal_delta_ledger (src/runtime-stores.ts) is the series — this carrier is never used there.
const shadowSeries = new Map<string, ProgressPoint[]>();

// =============================================================================
// runGoalLifecycle() — ADMISSION → the level-triggered TICK loop → a settled state. The full lifecycle.
// =============================================================================
export interface GoalSubmission {
  /** the pre-flight view of the goal (metric/acceptance/budget/required config). */
  goal: PreflightGoal;
  /** the pre-flight context (probe registry, reachability verdict seam, config readiness, target env). */
  preflightCtx: PreflightContext;
  /** the create input for the durable GoalContract (ENFORCE only — SHADOW uses a fixture row). */
  createInput?: CreateGoalContractInput;
  /** a SHADOW fixture contract row (no DB) — used when not enforcing. Defaults are derived from `goal`. */
  fixtureContract?: Partial<GoalContractRow>;
}

export async function runGoalLifecycle(submission: GoalSubmission, ctx: LifecycleContext): Promise<LifecycleResult> {
  const enforce = ctx.enforce === true;
  const posture = enforce ? "ENFORCE" : "SHADOW";
  const channels = ctx.summonChannels ?? defaultChannelChain();
  const summonOpts = ctx.summonOpts ?? { posture };
  const maxTicks = ctx.maxTicks ?? 12;
  const executor = ctx.executor ?? DEFERRED_EXECUTOR;
  const summons: SummonResult[] = [];

  // ── ADMISSION — the pre-flight feasibility gate (hour 0). ──
  const preflight = await evaluatePreflight(submission.goal, submission.preflightCtx);
  if (!preflight.admit) {
    // REFUSE → NEVER admitted: no contract is created. A feasibility FAP is summoned (the Discovery class dies here).
    const admissionSummon = await summon(fapFromPreflightRefusal(preflight, submission.goal), channels, summonOpts);
    summons.push(admissionSummon);
    return {
      goalId: submission.goal.goalId ?? null, phase: "REFUSED_AT_PREFLIGHT", posture, preflight,
      admissionSummon, contract: null, ramp: "not admitted — the pre-flight gate refused the goal at hour 0; no contract was created.",
      ticks: [], statePath: [], summons, finalState: null,
    };
  }

  // ── ADMIT — create the durable GoalContract (CREATED). ──
  let contract: GoalContractRow;
  if (enforce) {
    const input = submission.createInput ?? createInputFromGoal(submission.goal);
    contract = await createContract(input);
  } else {
    contract = fixtureContractFromGoal(submission.goal, submission.fixtureContract);
    shadowSeries.delete(contract.goalId); // fresh in-memory observed series for this SHADOW run
  }
  const statePath: GoalState[] = [contract.state];

  // ── ADMISSION RAMP — bring the CREATED contract up to EXECUTING (C2-MIND plan + C9 actuation). DEFERRED. ──
  let ramp: string;
  try {
    const r = await executor.admitToExecuting!(contract);
    contract = enforce ? (await readContract(contract.goalId))! : { ...contract, state: r.state };
    ramp = `admission ramp actuated: ${r.transitions.join(" → ")} (${r.note}).`;
  } catch (e) {
    // The default (DEFERRED) lands here. In SHADOW we advance the fixture to EXECUTING to WALK the governance
    // loop (clearly a dry-run, no DB); in ENFORCE with no ramp wired we stop — the governance loop needs a
    // contract at EXECUTING, which the C2-MIND planner (deferred) or the test fixture setup provides.
    if (enforce && contract.state !== "EXECUTING") {
      return {
        goalId: contract.goalId, phase: "ADMITTED_RAMP_DEFERRED", posture, preflight, admissionSummon: null,
        contract, ramp: `admitted (CREATED) but the CREATED→EXECUTING ramp is DEFERRED — ${head(e)}. Wire admitToExecuting (the C2-MIND planner / Sprint 5.1) or pre-drive the fixture to EXECUTING.`,
        ticks: [], statePath, summons, finalState: null,
      };
    }
    contract = { ...contract, state: "EXECUTING" };
    ramp = `admission ramp DEFERRED — ${head(e)}. SHADOW dry-run: the fixture is walked to EXECUTING to demonstrate the governance loop (no DB, no live goal).`;
  }
  if (contract.state !== statePath[statePath.length - 1]) statePath.push(contract.state);

  // ── SEED the prior observed history (the DEFERRED executor's earlier sprints) so the GS can judge from tick 0. ──
  const seed = ctx.seedProgress ?? [];
  if (seed.length) {
    if (enforce && (ctx.persistProgress ?? true)) {
      for (const s of seed) await appendProgressSample({ goalId: contract.goalId, cycle: s.cycle, value: s.value, predicted: s.predicted ?? null, fixRef: s.fixRef ?? null });
    } else {
      shadowSeries.set(contract.goalId, [...seed]);
    }
  }

  // ── THE LEVEL-TRIGGERED TICK LOOP — governs EXECUTING → … → a settled state. ──
  const ticks: TickRecord[] = [];
  let haltSummoned = false; // dedupe the GS-HALT summon (one feasibility FAP per stall, not one per halt-tick)
  for (let i = 0; i < maxTicks; i++) {
    const rec = await tick(contract, ctx, i);
    // dedupe a repeated GS-HALT summon across the multi-edge EXECUTING→REVIEWING→HALTED path.
    if (rec.summon && rec.plan.decision === "EXECUTE_HALT") {
      if (haltSummoned) { rec.summon = null; } else { haltSummoned = true; summons.push(rec.summon); }
    } else if (rec.summon) {
      summons.push(rec.summon);
    }
    ticks.push(rec);

    // advance the contract for the next tick: re-read the durable row in ENFORCE; carry the would-be state in SHADOW.
    const nextState = rec.stateAfter;
    contract = enforce ? (await readContract(contract.goalId))! : { ...contract, state: nextState };
    if (contract.state !== statePath[statePath.length - 1]) statePath.push(contract.state);

    if (rec.plan.decision === "SETTLED" || isSettled(contract.state)) break;
    // A C6 INCOMPLETE-but-reachable boundary drove REVIEWING→PLANNING — opening the NEXT sprint, which is the
    // DEFERRED C2-MIND planner (boundary-plan-c2mind.planNextSprint, Sprint 5.1). The lifecycle PAUSES at
    // PLANNING awaiting that re-plan; it must NOT let the reconciler re-route PLANNING→EXECUTING on the loop's
    // (already-overridden) self-claimed metric — that would re-open the B1 self-certify hole at PLANNING.
    if (rec.reviewBoundary?.to === "PLANNING") break;
    // A WAIT (no autonomous edge — the state advances via C9/C2-MIND, deferred) cannot progress in this slice;
    // stop rather than spin. A CONTINUE is bounded by maxTicks (the observe provider may script a trajectory).
    if (rec.plan.decision === "WAIT" && rec.execution.applied_edge === null) break;
  }

  return {
    goalId: contract.goalId, phase: "ADMITTED", posture, preflight, admissionSummon: null,
    contract, ramp, ticks, statePath, summons, finalState: contract.state,
  };
}

// =============================================================================
// Fixture / create-input helpers (SHADOW uses an in-memory row; ENFORCE creates a durable contract).
// =============================================================================
export function createInputFromGoal(goal: PreflightGoal): CreateGoalContractInput {
  return {
    objective: goal.objective,
    acceptanceMetric: goal.acceptanceMetric,
    metricSourceProbeId: goal.metricSourceProbeId,
    metricSourceVersion: goal.metricSourceVersion,
    dataClass: "CONFIDENTIAL",
    budgetCap: goal.budgetCap,
  };
}

export function fixtureContractFromGoal(goal: PreflightGoal, over: Partial<GoalContractRow> = {}): GoalContractRow {
  const now = new Date();
  const goalId = goal.goalId ?? "fixture-goal";
  return {
    goalId,
    objective: goal.objective,
    acceptanceMetric: goal.acceptanceMetric,
    metricSourceProbeId: goal.metricSourceProbeId,
    metricSourceVersion: goal.metricSourceVersion,
    dataClass: "CONFIDENTIAL",
    budgetCap: goal.budgetCap,
    goalDeltaLedgerRef: goalId,
    state: "CREATED",
    prevState: null,
    // 0055 additive spine columns — the single-tenant / v1 defaults (mirror the DB DEFAULTs).
    tenantId: "RUMAH",
    streamId: "default",
    stateMachineVersion: 1,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}
