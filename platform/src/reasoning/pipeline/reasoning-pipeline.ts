// =============================================================================
// THE REASONING PIPELINE — the §10 loop, composed from the organs (P2 slice 8, roadmap G-24).
// =============================================================================
// This is the PO as a THIN ORCHESTRATOR (Frozen §10): it CHAINS the reasoning organs into one callable loop and
// SHORT-CIRCUITS on each organ's fail-closed signal — nothing more. It holds NO judgment of its own: it does not
// classify, decide reachability, plan, review, or phrase; it only SEQUENCES those organs and records a fully
// CITED, inspectable trace. Every organ's fail-closed contract is honored as a short-circuit, never overridden.
//
// THE LOOP (each arrow honors the previous organ's fail-closed contract):
//   1. classify(utterance)
//        · needs_clarification  → STOP. Do NOT plan on ambiguity — narrate a clarify reply. (haltedAt classify)
//        · not consequential    → narrate a plain acknowledgement (no plan warranted). (reached the end)
//        · consequential        → continue to reachability.
//   2. evaluateReachability(goal)                                        [only for a consequential intent]
//        · reachable:false      → STOP. Do NOT plan an unreachable goal — narrate the cited blockers. (haltedAt reachability)
//        · reachable:true       → continue to plan.
//   3. plan(goal)                                                        [only for a reachable goal]
//        · needs_clarification  → STOP. The goal was too vague to decompose — narrate a clarify reply. (haltedAt plan)
//        · a valid DAG          → narrate the plan. (reached the end)
//   (execution is the WORKER-TIER slice — this pipeline STOPS at the plan; `executor?` is a clean injection
//    seam, default no-op, that the worker-tier slice will drive. It is NOT invoked here.)
//   4. narrate(outcome)          composes the founder-facing message from whatever stage was reached.
//
//   reviewCompletion is EXPOSED on the organs seam (the REVIEWING boundary consumes it) but is NEVER auto-run
//   here without evidence — a completion review with no completion is a lie waiting; it is a caller-driven step.
//
// A model INVOCATION error inside any organ PROPAGATES (a step failure is not a decision) — the pipeline adds no
// judgment, so it does not swallow it. The one exception is narrate, whose OWN contract falls back to a
// deterministic template floor (never lose the founder-facing message); that resilience lives in the organ.

import type { ResolveContext } from "../model-router.js";
import {
  classify,
  type IntakeClassification,
  type ClassifyReasoner,
} from "../organs/intake-classifier.js";
import {
  evaluateReachability,
  type ReachabilityVerdict,
  type ReachabilityReasoner,
} from "../organs/reachability.js";
import { plan, type PlanResult, type PlanReasoner } from "../organs/planner.js";
import {
  reviewCompletion,
  type CompletionReviewInput,
  type CompletionVerdict,
  type CompletionReviewReasoner,
} from "../organs/completion-review.js";
import { narrate, type ReasoningOutcome, type NarrateReasoner } from "../organs/narrator.js";

// ── The executor seam — a CLEAN injection point for the worker-tier slice (NOT driven here). ─────────────────
/** An executor takes a decided plan and runs it. This slice STOPS at the plan; the seam exists so the
 *  worker-tier slice can inject execution WITHOUT re-shaping the pipeline. The default is a no-op. */
export type Executor = (plan: PlanResult, ctx: ResolveContext) => Promise<void>;
/** The default executor: a no-op. Execution is out of scope for the reasoning slice. */
export const NOOP_EXECUTOR: Executor = async () => {};

// ── The injectable organ seam — default = the real organs (defaultReasoningOrgans). Tests inject stubs. ──────
/**
 * The organs the pipeline composes, as bound callables (each already carrying its reasoner). The pipeline
 * depends ONLY on this seam — it never constructs a reasoner or names a model. `defaultReasoningOrgans` binds
 * the REAL organs; a test injects lightweight stubs to drive each branch deterministically (DB-free, no model).
 */
export interface ReasoningOrgans {
  classify(utterance: string, ctx: ResolveContext): Promise<IntakeClassification>;
  evaluateReachability(goal: string, ctx: ResolveContext, goalId?: string): Promise<ReachabilityVerdict>;
  plan(goal: string, ctx: ResolveContext, goalId?: string): Promise<PlanResult>;
  narrate(outcome: ReasoningOutcome, ctx: ResolveContext, forFounder?: boolean): Promise<string>;
  /** EXPOSED for the REVIEWING boundary — NOT auto-run by the loop (a review needs completion evidence). */
  reviewCompletion?(input: CompletionReviewInput, ctx: ResolveContext): Promise<CompletionVerdict>;
  /** Clean injection seam for the worker-tier slice — NOT invoked by this pipeline (STOP at the plan). */
  executor?: Executor;
}

/** The reasoners the real organs are bound to: a base port (CLASSIFY uses `reason`) + a context-aware port
 *  (REACHABILITY / PLAN / NARRATE / VERIFY use `reasonWithContext`). Both are satisfied structurally by the
 *  real ports, so the pipeline stays model-agnostic (it names classes via the organs, never a model). */
export interface OrganReasoners {
  /** Has `reason(...)` — serves CLASSIFY (a cheap class that reasons on the utterance itself). */
  readonly reasoner: ClassifyReasoner;
  /** Has `reasonWithContext(...)` — serves REACHABILITY / PLAN / NARRATE / VERIFY. */
  readonly contextReasoner: ReachabilityReasoner & PlanReasoner & NarrateReasoner & CompletionReviewReasoner;
}

/**
 * Build the REAL organs, bound to the given reasoners. This IS the pipeline's default organ set — the organs
 * name reasoning CLASSES (CLASSIFY / REACHABILITY / PLAN / NARRATE / VERIFY), the router resolves each to a
 * model. The pipeline never touches a model; it only calls these bound callables.
 */
export function defaultReasoningOrgans(deps: OrganReasoners): ReasoningOrgans {
  return {
    classify: (utterance, ctx) => classify(utterance, ctx, deps.reasoner),
    evaluateReachability: (goal, ctx, goalId) => evaluateReachability(goal, ctx, deps.contextReasoner, goalId),
    plan: (goal, ctx, goalId) => plan(goal, ctx, deps.contextReasoner, goalId),
    narrate: (outcome, ctx, forFounder) => narrate({ outcome, forFounder, ctx }, deps.contextReasoner),
    reviewCompletion: (input, ctx) => reviewCompletion(input, ctx, deps.contextReasoner),
    executor: NOOP_EXECUTOR,
  };
}

// ── The trace — a fully CITED, inspectable record of every organ that ran. ──────────────────────────────────

/** One organ's turn in the loop: which organ, its typed output (the citation), and the wall-time it took. */
export interface ReasoningStage {
  /** The organ that ran ("classify" | "reachability" | "plan" | "narrate"). */
  readonly organ: string;
  /** The organ's typed output — the trace's citation for this stage (fully inspectable). */
  readonly output: unknown;
  /** Wall-clock milliseconds this stage took (via the injectable clock). */
  readonly ms: number;
}

/**
 * The trace of one reasoning run: every organ that ran (in order, with its output), the final founder-facing
 * reply, where the loop halted (if it short-circuited on a fail-closed signal), and whether it ended by asking
 * the founder to clarify. `haltedAt` is undefined when the loop ran to completion (reached a plan or an
 * acknowledgement). Fully CITED: `stages` holds every organ's output, so the reply is always traceable to it.
 */
export interface ReasoningTrace {
  readonly stages: readonly ReasoningStage[];
  readonly finalReply: string;
  /** The organ name where the loop short-circuited on a fail-closed signal (undefined if it ran to completion). */
  readonly haltedAt?: string;
  /** True iff the loop ended by asking the founder to clarify (classifier or planner refusal). */
  readonly needsClarification?: boolean;
}

// ── The pipeline input. ─────────────────────────────────────────────────────────────────────────────────────

/** A reasoning run: the founder utterance, an optional goal in scope, the ctx, the (injectable) organs, and an
 *  optional clock (for deterministic stage timing in tests). Organs are the injection seam — the real default
 *  is `defaultReasoningOrgans(reasoners)`; tests pass stubs. */
export interface RunReasoningInput {
  readonly utterance: string;
  /** Optional goal in scope — forwarded to the context-aware organs so they pull that goal's live state. */
  readonly goalId?: string;
  readonly ctx: ResolveContext;
  /** The organs to compose. Inject stubs in tests; wire the real organs via `defaultReasoningOrgans`. */
  readonly organs: ReasoningOrgans;
  /** Clock seam for deterministic stage timing in tests; default Date.now. */
  readonly now?: () => number;
}

// ── Deciding the branch — a small, explicit predicate (the pipeline holds no hidden judgment). ───────────────
/**
 * Is this classification a CONSEQUENTIAL intent — one that warrants goal reasoning (reachability + planning)?
 * True when the classifier read the utterance as a thing to BUILD, or judged its blast radius medium/high.
 * A "low"-consequentiality investigate/operate utterance is acknowledged, not planned. Pure + explicit so the
 * branch is inspectable (the pipeline decides nothing subtle — it reads the classifier's own labels).
 */
export function isConsequentialIntent(cls: IntakeClassification): boolean {
  return cls.lane === "build" || cls.consequentiality === "high" || cls.consequentiality === "medium";
}

// ── The loop. ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Run the reasoning loop over an utterance, composing the organs and short-circuiting on each one's fail-closed
 * signal. Returns a fully cited ReasoningTrace. THIN: the pipeline sequences + short-circuits; it holds no
 * judgment of its own. A model invocation error inside any organ PROPAGATES (narrate is the sole exception — it
 * has its own template floor). See the loop map at the top of this file.
 */
export async function runReasoning(input: RunReasoningInput): Promise<ReasoningTrace> {
  const now = input.now ?? Date.now;
  const { organs, ctx, utterance, goalId } = input;
  const stages: ReasoningStage[] = [];

  /** Run one organ, timing it and recording its output as a cited stage. */
  async function stage<T>(organ: string, run: () => Promise<T>): Promise<T> {
    const started = now();
    const output = await run();
    stages.push({ organ, output, ms: now() - started });
    return output;
  }

  /** Narrate the terminal outcome, record the narrate stage, and assemble the final trace. */
  async function finish(outcome: ReasoningOutcome, halt?: { haltedAt: string; needsClarification?: boolean }): Promise<ReasoningTrace> {
    const reply = await stage("narrate", () => organs.narrate(outcome, ctx));
    return {
      stages,
      finalReply: reply,
      ...(halt?.haltedAt !== undefined ? { haltedAt: halt.haltedAt } : {}),
      ...(halt?.needsClarification ? { needsClarification: true } : {}),
    };
  }

  // 1. CLASSIFY. On ambiguity, STOP — do not plan on ambiguity (honor the classifier's fail-closed refusal).
  const cls = await stage("classify", () => organs.classify(utterance, ctx));
  if (cls.needs_clarification) {
    return finish(
      { kind: "clarification", utterance, reason: cls.reason ?? "the utterance was ambiguous" },
      { haltedAt: "classify", needsClarification: true },
    );
  }

  // Non-consequential utterance ⇒ no plan warranted; acknowledge it plainly (loop ran to completion).
  if (!isConsequentialIntent(cls)) {
    return finish({ kind: "acknowledged", utterance, intent: cls.intent, lane: cls.lane ?? "unknown" });
  }

  // The consequential goal is the utterance itself (the thing to build / act on).
  const goal = utterance;

  // 2. REACHABILITY. On not-reachable, STOP — do not plan an unreachable goal (honor θ=0.7 fail-closed).
  const reach = await stage("reachability", () => organs.evaluateReachability(goal, ctx, goalId));
  if (!reach.reachable) {
    return finish(
      { kind: "blocked", goal, blockers: reach.blockers.map((b) => ({ claim: b.claim, source: b.source })) },
      { haltedAt: "reachability" },
    );
  }

  // 3. PLAN. On a planner refusal (too vague to decompose), STOP — narrate a clarify reply (honor its fail-closed).
  const planned = await stage("plan", () => organs.plan(goal, ctx, goalId));
  if (planned.needs_clarification) {
    return finish(
      { kind: "clarification", utterance, reason: planned.reason ?? "the goal was too vague to decompose" },
      { haltedAt: "plan", needsClarification: true },
    );
  }

  // Execution is the WORKER-TIER slice — this pipeline STOPS at the plan (organs.executor is a seam, not run).
  return finish({
    kind: "planned",
    goal,
    steps: planned.steps.map((s) => ({ id: s.id, target: s.target, op: s.op, direction: s.direction })),
    disjointSurfaces: [...planned.disjointSurfaces],
  });
}
