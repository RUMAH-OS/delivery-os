// =============================================================================
// THE PLANNER ORGAN (C2-MIND) — the OS decomposes a goal into a DAG of steps (P2 slice 5, roadmap G-21).
// =============================================================================
// It turns a GOAL into a PLAN — a directed ACYCLIC graph of steps — by REASONING through the CONTEXT-AWARE
// ReasoningPort (class PLAN). This is the whole point of the context-aware seam (I17, Frozen §10.2): a plan
// is decomposed FROM the assembled, cited company context (what we already decided + what we observe), NEVER
// from a cold prompt — "planning from a cold prompt re-derives what we already know." The reasonWithContext
// wrapper ASSEMBLES context first (fail-closed on an empty brief) and injects it ahead of the goal; this
// organ owns the PLAN-specific prompt, the JSON parse, and the DAG's STRUCTURAL validity.
// Spec: ADR-reasoning-model-routing.md + Frozen §10.2/§10.3 (O8 planner / C2-MIND).
//
// SEPARATION OF POWERS (load-bearing):
//   · The organ DECOMPOSES. It does NOT execute, schedule, or authorize anything. It answers "what is the
//     shape of the work?" — a DAG of measurable steps. It mutates no contract, opens no sprint, drives no
//     goal. It is a STANDALONE organ this slice (the deterministic boundary-plan skeleton in
//     boundary-plan-c2mind.ts still owns the live boundary; wiring the two is a later, reviewable slice).
//   · The organ names a CLASS ("PLAN"), never a model. Which model serves PLAN is config
//     (reasoning-routing.config.json), resolved by the Model Router behind the ReasoningPort.
//
// NEVER EMIT AN INVALID DAG (the honesty invariant for a planner — a broken plan is worse than no plan):
//   A plan is returned ONLY when it is STRUCTURALLY VALID. The organ returns a needs_clarification result —
//   with EMPTY steps, never a partial/broken graph — whenever the model's output cannot become a valid DAG:
//     · the output is not parseable JSON / not the expected envelope;
//     · a step is malformed (missing/blank id or target, op or direction OFF-ENUM);
//     · a step's op CONTRADICTS its direction (op:"<=" with direction:"increase" — the same guard the GS
//       and C6 enforce on an acceptance shape: a monotone comparator that disagrees with the declared
//       direction is a contradiction, never silently accepted);
//     · two steps share an id (a DAG node id must be unique);
//     · a `dependsOn` names an id that does not exist (a DANGLING edge);
//     · the dependency graph has a CYCLE (a DAG must be acyclic — topological check);
//     · the plan is empty (a confident decomposition has at least one step);
//     · the model itself flags needs_clarification (it judged the goal too vague to decompose);
//     · the model's confidence is below the refusal floor (vague ⇒ refuse, don't guess a plan).
//   In every fail-closed case `steps` is [], `needs_clarification` is true, `via` is "fail-closed", and a
//   `reason` is attached for the audit. A confident, INVALID DAG is never returned.
//
//   A model INVOCATION error (the model is down / the router resolves nothing) is a DIFFERENT failure: it is
//   a step failure, not "the goal was vague." It PROPAGATES (ReasoningInvocationError / ContextRequiredError /
//   UnknownReasoningClassError / NoAvailableModelError) exactly as the reasoning seam raises it — conflating
//   "I can't reach a model / I have no context" with "please clarify the goal" would itself be a lie.

import type { ResolveContext } from "../model-router.js";
import type {
  ReasonWithContextRequest,
  ReasonWithContextResult,
} from "../context/context-aware-port.js";

// ── The step vocabulary — the enums the model is constrained to (Frozen §10.2 O8). ──────────────────────
// A PLAN STEP is an acceptance-shaped unit of work: it drives a `target` (a named metric/artifact/surface)
// in a `direction` (increase | decrease) to satisfy a comparator `op`. This is the SAME {op, target,
// direction} shape C2-MIND emits as a GoalContract acceptance target (see completion-review-c6.ts §4.1),
// so a step is measurable by construction and reuses the OS's one comparator/direction vocabulary.

/** The comparator a step's target must satisfy — the OS's one acceptance-operator vocabulary (GS / C6). */
export const PLAN_OPS = [">=", ">", "<=", "<", "=="] as const;
export type PlanOp = (typeof PLAN_OPS)[number];

/** The direction a step drives its target — the OS's one direction vocabulary (goal-supervisor-c7). */
export const PLAN_DIRECTIONS = ["increase", "decrease"] as const;
export type PlanDirection = (typeof PLAN_DIRECTIONS)[number];

/** The refusal floor: a model confidence strictly below this ⇒ the goal is too vague to decompose ⇒ refuse
 *  (return needs_clarification with an empty plan). A named constant so the bar is a rollback-able asset. */
export const PLAN_CONFIDENCE_FLOOR = 0.5;

// ── The DAG — the plan the organ emits. ─────────────────────────────────────────────────────────────────

/**
 * One node of the plan DAG. `dependsOn` lists the ids of the steps that MUST complete before this one — the
 * edges of the graph. A step is acceptance-shaped: it drives `target` in `direction` to satisfy `op`.
 */
export interface PlanStep {
  /** Stable, unique id of the step (a DAG node id). */
  readonly id: string;
  /** The comparator the step's target must satisfy (PLAN_OPS). */
  readonly op: PlanOp;
  /** The named metric / artifact / surface the step drives (non-empty). */
  readonly target: string;
  /** The direction the step drives its target (PLAN_DIRECTIONS), non-contradictory with `op`. */
  readonly direction: PlanDirection;
  /** Ids of the steps this step depends on (its in-edges). Every id MUST exist; the graph MUST be acyclic. */
  readonly dependsOn: readonly string[];
}

/** Why the organ fell closed (attached to a needs_clarification result for the audit; never scored). */
export type PlanFailReason =
  | "unparseable-output" //          the model output had no parseable JSON object
  | "not-an-object" //               parsed JSON was not an object
  | "steps-not-array" //             `steps` was absent or not an array
  | "empty-plan" //                  zero steps but the model did not flag needs_clarification (degenerate)
  | "step-malformed" //              a step had a blank/absent id or target, or off-enum op/direction
  | "op-direction-contradiction" //  a step's op disagrees with its direction (monotone contradiction)
  | "duplicate-step-id" //           two steps share an id (a DAG node id must be unique)
  | "dangling-dependency" //         a dependsOn names an id that no step defines (a broken edge)
  | "cycle" //                       the dependency graph has a cycle (a DAG must be acyclic)
  | "model-flagged-clarification" // the model set needs_clarification:true itself (goal too vague)
  | "below-confidence-floor"; //     confidence < PLAN_CONFIDENCE_FLOOR (vague ⇒ refuse, don't guess a plan)

/**
 * The organ's output — a decomposition of the goal into a DAG. On a CONFIDENT, well-formed, STRUCTURALLY
 * VALID plan: `steps` is a non-empty valid DAG, `needs_clarification` is false, `via` is "reasoning". On a
 * FAIL-CLOSED result: `steps` is [] (never a partial/broken graph), `needs_clarification` is true, `via` is
 * "fail-closed", and `reason` records why — the organ REFUSED rather than emit an invalid DAG.
 */
export interface PlanResult {
  /** The plan's steps — a STRUCTURALLY VALID DAG on success; [] on any fail-closed result. */
  readonly steps: readonly PlanStep[];
  /** The independent surfaces the plan touches (weakly-connected components) — parallelizable workstreams. */
  readonly disjointSurfaces: readonly string[];
  /** The model's confidence in [0, 1] (0 on a fail-closed / unparseable result). */
  readonly confidence: number;
  /** True iff the organ refuses to commit to a plan (vague / unparseable / structurally invalid). */
  readonly needs_clarification: boolean;
  /** How the plan was reached. */
  readonly via: "reasoning" | "fail-closed";
  /** Present iff needs_clarification — the fail-closed reason (audit only). */
  readonly reason?: PlanFailReason;
  /** The prompt-asset version that produced this plan (rollback provenance). */
  readonly seamVersion: string;
}

// ── The VERSIONED prompt/persona — a rollback-able asset (seam_version pins it). ─────────────────────────
// Changing the wording is a versioned change: bump seam_version so a plan's provenance is exact and a
// regression can be rolled back to a known-good prompt. The persona constrains the model to the step enums
// and to a STRICT JSON envelope, and tells it — explicitly — to refuse (needs_clarification) rather than
// guess a plan. The GOAL is passed as the reasonWithContext `task`; the assembled, cited context brief is
// injected AHEAD of it by the context-aware port, so the model plans FROM context, not from a cold prompt.

const OP_LIST = PLAN_OPS.join(" | ");
const DIRECTION_LIST = PLAN_DIRECTIONS.join(" | ");

export const PLANNER_PROMPT = Object.freeze({
  seam_version: "planner/v1",
  persona:
    "You are the PLANNER (C2-MIND) for a software company's autonomous Project Owner. You decompose a GOAL " +
    "into a PLAN — a directed ACYCLIC graph (DAG) of measurable steps — reasoning FROM the assembled company " +
    "context provided above the goal (what we already decided + what we observe). Each step drives a named " +
    "target in a direction to satisfy a comparator. When the goal is too vague or under-specified to " +
    "decompose into a valid DAG, you REFUSE by setting needs_clarification:true rather than guessing a plan.",
  /** Build the concrete task (output instructions + fenced goal). The assembled context is injected ahead of this. */
  build(goal: string): string {
    return [
      "Decompose the GOAL below into a PLAN: a DAG of measurable steps. Use EXACTLY the allowed values.",
      "Each step is an object:",
      '  id         : a short unique id for the step (e.g. "s1"), referenced by other steps\' dependsOn',
      `  op         : the comparator the step's target must satisfy — one of: ${OP_LIST}`,
      "  target     : the named metric / artifact / surface the step drives (a non-empty string)",
      `  direction  : the direction the step drives its target — one of: ${DIRECTION_LIST}`,
      "  dependsOn  : an array of the ids of steps that must complete BEFORE this one (its dependencies)",
      "",
      "Rules the plan MUST satisfy (an invalid plan is worse than none — refuse instead):",
      "  · every id is unique; every dependsOn id refers to a step that exists;",
      "  · the dependency graph is ACYCLIC (no step depends, directly or transitively, on itself);",
      '  · a step\'s direction must not contradict its op ("increase" pairs with >= or >; "decrease" with',
      '    <= or <; "==" pairs with either);',
      "  · list disjointSurfaces: the independent surfaces/workstreams the plan touches (may proceed in parallel).",
      "",
      "If the goal is too vague or under-specified to decompose, DO NOT guess: set needs_clarification:true and steps:[].",
      "Respond with STRICT JSON on ONE line, no prose:",
      '{"steps":[{"id":"s1","op":">=","target":"<name>","direction":"increase","dependsOn":[]}],' +
        '"disjointSurfaces":["<name>"],"confidence":<0..1>,"needs_clarification":<true|false>}',
      "",
      `Goal: <<<${goal}>>>`,
    ].join("\n");
  },
});

// ── DAG STRUCTURAL VALIDATION (pure — unit-tested directly, no model needed). ───────────────────────────

/** The verdict of the structural validator: valid, or the FIRST structural fault found (fail-closed). */
export type DagValidity =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: Extract<PlanFailReason, "duplicate-step-id" | "dangling-dependency" | "cycle">; readonly detail: string };

/**
 * Validate the STRUCTURE of a step list as a DAG. Pure: no I/O, no model. Checks, in order:
 *   1. unique ids           — two steps sharing an id is not a graph;
 *   2. no dangling edges     — every dependsOn id must be defined by some step;
 *   3. acyclic               — a topological sort (Kahn's algorithm) must consume every node; a residue is a cycle.
 * Returns { valid:true } or the FIRST fault. Assumes each step is already shape-valid (id present) — the
 * parser enforces per-step shape/enum/contradiction BEFORE calling this; this function owns graph structure only.
 */
export function validateDag(steps: readonly PlanStep[]): DagValidity {
  // 1. unique ids.
  const ids = new Set<string>();
  for (const s of steps) {
    if (ids.has(s.id)) return { valid: false, reason: "duplicate-step-id", detail: `step id "${s.id}" is used more than once` };
    ids.add(s.id);
  }

  // 2. no dangling edges — every dependency must resolve to a defined step.
  for (const s of steps) {
    for (const dep of s.dependsOn) {
      if (!ids.has(dep)) {
        return { valid: false, reason: "dangling-dependency", detail: `step "${s.id}" depends on "${dep}", which no step defines` };
      }
    }
  }

  // 3. acyclic — Kahn's algorithm. Edge dep -> s (a dependency must finish before its dependent).
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // dep id -> ids that depend on it
  for (const s of steps) indegree.set(s.id, 0);
  for (const s of steps) {
    for (const dep of s.dependsOn) {
      indegree.set(s.id, (indegree.get(s.id) ?? 0) + 1);
      (dependents.get(dep) ?? dependents.set(dep, []).get(dep)!).push(s.id);
    }
  }
  const queue: string[] = [];
  for (const [id, deg] of indegree) if (deg === 0) queue.push(id);
  let removed = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    removed++;
    for (const dependent of dependents.get(id) ?? []) {
      const deg = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, deg);
      if (deg === 0) queue.push(dependent);
    }
  }
  if (removed !== steps.length) {
    return { valid: false, reason: "cycle", detail: `dependency graph has a cycle (${steps.length - removed} step(s) never become dependency-free)` };
  }

  return { valid: true };
}

/**
 * Compute the plan's DISJOINT SURFACES — the weakly-connected components of the DAG, each labelled by the
 * lexicographically-first `target` in the component. Deterministic. Two steps are on the same surface iff
 * there is any dependency edge (either direction) linking them, transitively. Independent surfaces (>1) are
 * workstreams that may proceed in parallel. Assumes a structurally valid DAG (ids unique, edges resolve).
 */
export function computeDisjointSurfaces(steps: readonly PlanStep[]): string[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    // path-compress
    let c = x;
    while (parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n; }
    return r;
  };
  const union = (a: string, b: string): void => { parent.set(find(a), find(b)); };
  for (const s of steps) parent.set(s.id, s.id);
  for (const s of steps) for (const dep of s.dependsOn) union(s.id, dep);

  // component root -> its member targets
  const byRoot = new Map<string, string[]>();
  const targetOf = new Map(steps.map((s) => [s.id, s.target] as const));
  for (const s of steps) {
    const root = find(s.id);
    (byRoot.get(root) ?? byRoot.set(root, []).get(root)!).push(targetOf.get(s.id)!);
  }
  const labels = [...byRoot.values()].map((targets) => targets.slice().sort()[0]!);
  return [...new Set(labels)].sort();
}

// ── Parsing + fail-closed validation (pure — unit-tested directly, no model needed). ────────────────────

const OP_SET: ReadonlySet<string> = new Set(PLAN_OPS);
const DIRECTION_SET: ReadonlySet<string> = new Set(PLAN_DIRECTIONS);

/** The direction a monotone comparator implies (mirrors goal-supervisor-c7 / completion-review-c6). `==` is
 *  gap-closing → no single implied direction, so it is non-contradictory with either declared direction. */
function impliedDirection(op: PlanOp): PlanDirection | null {
  if (op === ">=" || op === ">") return "increase";
  if (op === "<=" || op === "<") return "decrease";
  return null; // "=="
}

/** The needs_clarification sink for a given fail-closed reason (never emits a partial/broken DAG). */
function failClosed(reason: PlanFailReason, confidence = 0): PlanResult {
  return {
    steps: [],
    disjointSurfaces: [],
    confidence,
    needs_clarification: true,
    via: "fail-closed",
    reason,
    seamVersion: PLANNER_PROMPT.seam_version,
  };
}

/** Extract the first balanced-ish JSON object from possibly-noisy model text (the model may wrap prose). */
function extractJsonObject(raw: string): unknown | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/** Parse+shape-validate ONE raw step. Returns the typed step, or a fail reason if malformed/contradictory. */
function parseStep(raw: unknown): { step: PlanStep } | { reason: Extract<PlanFailReason, "step-malformed" | "op-direction-contradiction"> } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { reason: "step-malformed" };
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.trim() === "") return { reason: "step-malformed" };
  if (typeof o.target !== "string" || o.target.trim() === "") return { reason: "step-malformed" };
  if (typeof o.op !== "string" || !OP_SET.has(o.op)) return { reason: "step-malformed" };
  if (typeof o.direction !== "string" || !DIRECTION_SET.has(o.direction)) return { reason: "step-malformed" };
  // dependsOn: absent ⇒ [] (a root step); present ⇒ must be an array of strings.
  let dependsOn: string[];
  if (o.dependsOn === undefined) {
    dependsOn = [];
  } else if (Array.isArray(o.dependsOn) && o.dependsOn.every((d) => typeof d === "string" && d.trim() !== "")) {
    dependsOn = o.dependsOn as string[];
  } else {
    return { reason: "step-malformed" };
  }
  const op = o.op as PlanOp;
  const direction = o.direction as PlanDirection;
  // Non-contradiction guard: a monotone op that disagrees with the declared direction is a contradiction.
  const opDir = impliedDirection(op);
  if (opDir !== null && opDir !== direction) return { reason: "op-direction-contradiction" };
  return { step: { id: o.id, op, target: o.target, direction, dependsOn } };
}

/**
 * Parse a model's raw PLAN output into a typed PlanResult, FAIL-CLOSED. Pure: no I/O, no model. Returns a
 * needs_clarification result (with EMPTY steps — never a partial/broken DAG) whenever the output cannot become
 * a STRUCTURALLY VALID plan: unparseable, malformed step, op/direction contradiction, duplicate id, dangling
 * edge, cycle, empty plan, model-flagged, or below the confidence floor. A valid plan carries its steps + the
 * derived disjoint surfaces.
 */
export function parsePlannerOutput(raw: string): PlanResult {
  const obj = extractJsonObject(raw);
  if (obj === null) return failClosed("unparseable-output");
  if (typeof obj !== "object" || Array.isArray(obj)) return failClosed("not-an-object");
  const o = obj as Record<string, unknown>;

  // confidence is read early so a fail-closed result can still carry the model's own (low) confidence.
  const confidence =
    typeof o.confidence === "number" && Number.isFinite(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : 0;

  // The model may refuse on its own — honor it (it judged the goal too vague to decompose).
  if (o.needs_clarification === true) return failClosed("model-flagged-clarification", confidence);

  if (!Array.isArray(o.steps)) return failClosed("steps-not-array", confidence);

  // Parse + shape-validate every step (id/target present, op/direction on-enum, op≁direction non-contradictory).
  const steps: PlanStep[] = [];
  for (const rawStep of o.steps) {
    const parsed = parseStep(rawStep);
    if ("reason" in parsed) return failClosed(parsed.reason, confidence);
    steps.push(parsed.step);
  }

  // A confident decomposition has at least one step (an empty plan is degenerate ⇒ refuse).
  if (steps.length === 0) return failClosed("empty-plan", confidence);

  // STRUCTURAL DAG validity: unique ids, no dangling edges, acyclic. NEVER emit an invalid DAG.
  const validity = validateDag(steps);
  if (!validity.valid) return failClosed(validity.reason, confidence);

  // Well-formed + valid DAG BUT under-confident ⇒ vague ⇒ refuse (don't ship a low-confidence plan as a decision).
  if (confidence < PLAN_CONFIDENCE_FLOOR) return failClosed("below-confidence-floor", confidence);

  return {
    steps,
    disjointSurfaces: computeDisjointSurfaces(steps),
    confidence,
    needs_clarification: false,
    via: "reasoning",
    seamVersion: PLANNER_PROMPT.seam_version,
  };
}

// ── The organ entrypoint — reason WITH CONTEXT through the port, parse fail-closed. ─────────────────────

/** The narrow context-aware reasoning seam the organ depends on: `reasonWithContext` with a CLASS. The real
 *  ContextAwareReasoningPort satisfies this structurally, so the organ names a class and never a model, and
 *  tests can inject a lightweight double. */
export interface PlanReasoner {
  reasonWithContext(req: ReasonWithContextRequest): Promise<ReasonWithContextResult>;
}

/**
 * Decompose a goal into a plan (a DAG) through the CONTEXT-AWARE ReasoningPort (class PLAN). Builds the
 * VERSIONED task, reasons FROM the assembled+injected context (the reasonWithContext wrapper assembles the
 * cited brief first and fails closed on an empty one), and parses the model's JSON into the typed plan
 * FAIL-CLOSED — never emitting a structurally invalid DAG (see parsePlannerOutput).
 *
 * This is DECOMPOSITION, not execution: the organ mutates nothing, schedules nothing, authorizes nothing.
 *
 * @throws ContextRequiredError — a consequential PLAN call with an EMPTY assembled brief (I17 fail-closed).
 * @throws ReasoningInvocationError / UnknownReasoningClassError / NoAvailableModelError — a model/router
 *   failure PROPAGATES (a step failure is not "please clarify"). Output-level problems fail closed to a
 *   needs_clarification result instead.
 */
export async function plan(
  goal: string,
  ctx: ResolveContext,
  reasoner: PlanReasoner,
  goalId?: string,
): Promise<PlanResult> {
  const task = PLANNER_PROMPT.build(goal);
  const result = await reasoner.reasonWithContext({
    class: "PLAN",
    task,
    goalId,
    ctx,
    system: PLANNER_PROMPT.persona,
  });
  return parsePlannerOutput(result.text);
}
