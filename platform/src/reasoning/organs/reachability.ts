// =============================================================================
// THE REACHABILITY ORGAN (C9) — the OS's fail-closed FEASIBILITY judgment (P2 slice 6, roadmap G-22).
// =============================================================================
// It answers ONE question about a goal: "on the evidence we actually have, is this goal REACHABLE?" — and it
// answers it FAIL-CLOSED at θ=0.7. A goal is NOT admitted unless it is POSITIVELY shown reachable; anything
// short of that (unparseable output, low confidence, a model that hedges) resolves to reachable:false. This is
// the honesty invariant for feasibility: "a feasibility call from assumption is a lie waiting" (Frozen §10.2).
// It reasons through the context-aware ReasoningPort (class REACHABILITY) so the OS's REAL goal/runtime state —
// the assembled, cited brief — informs the judgment, rather than a cold guess from the goal text alone.
// Spec: ADR-reasoning-model-routing.md + Frozen §10.3 (C9 §36.3 reachability, θ=0.7 fail-closed).
//
// SEPARATION OF POWERS (load-bearing):
//   · The organ JUDGES feasibility. It does NOT admit. It answers "is this reachable on the evidence?" Only the
//     deterministic C9 pre-flight gate (src/preflight-gate-c9.ts) turns a verdict into ADMIT / HALT. A confident
//     reachable:true is not an admission — it is one input the gate consults.
//   · The organ names a CLASS ("REACHABILITY"), never a model. Which model serves REACHABILITY is config
//     (reasoning-routing.config.json), resolved by the Model Router behind the (context-aware) ReasoningPort.
//
// FAIL-CLOSED at θ=0.7 (the exact rule — see parseReachabilityOutput):
//   reachable = TRUE  iff  the output parsed  AND  the model asserts reachable:true  AND  confidence ≥ 0.7
//                          AND  the model did NOT flag uncertainty.
//   reachable = FALSE for ANY of: unparseable output · confidence < 0.7 · model-flagged uncertainty ·
//                          the model itself said reachable:false. Never fabricate reachable:true.
//   A model INVOCATION error (model down / router resolves nothing / I17 context absent) is a DIFFERENT
//   failure — a step failure, NOT "unreachable." It PROPAGATES (ReasoningInvocationError / ContextRequiredError /
//   NoAvailableModelError) exactly as the port raises it; conflating "I couldn't reach a model" with "the goal is
//   unreachable" would itself be a lie. Only OUTPUT-level problems fall closed to a reachable:false verdict.
//
// SEAM to the existing M2 stub (src/reachability-evaluator.ts): that module owns the DETERMINISTIC decision rule
//   `decideReachability(verdict, θ)` and a DEFERRED LLM `evaluateReachability(input)` that throws by design. This
//   organ LIGHTS UP the real judgment WITHOUT touching that module (it has live importers — preflight-gate-c9,
//   goal-intake-c1, po-autoloop-c2). This organ's ReachabilityVerdict is a STRUCTURAL SUPERSET of the two fields
//   `decideReachability` reads ({reachable, confidence}), so a later wiring slice can feed THIS organ's verdict
//   straight into that rule. This slice ships the organ STANDALONE + eval-gated; wiring it into the live admission
//   path is a separate, reviewable follow-up (the stub keeps its fail-closed contract in the meantime).

import type {
  ReasonWithContextRequest,
  ReasonWithContextResult,
} from "../context/context-aware-port.js";
import type { ResolveContext } from "../model-router.js";

// ── The θ=0.7 feasibility floor — the fail-closed bar, kept as a named, rollback-able constant. ─────────────
/** θ (Frozen §10.3 / §36.3): a goal is admitted-as-reachable only at confidence ≥ this AND a positive assertion.
 *  A confidence strictly below θ is fail-closed to reachable:false (never silently admit an uncertain goal). */
export const REACHABILITY_CONFIDENCE_FLOOR = 0.7;

// ── The organ's output — the typed feasibility verdict a pre-flight gate consumes. ─────────────────────────

/** A single feasibility blocker: WHY the goal may not be reachable, CITED to where it was observed/decided.
 *  Honesty-by-construction (I4): a blocker with no source is unattributable — it is DROPPED, never surfaced. */
export interface ReachabilityBlocker {
  /** The blocking claim, in plain words (e.g. "no lever exists to move the acceptance metric"). */
  readonly claim: string;
  /** WHERE it came from — the citation (e.g. `goal_contract:g-1`, `os_runtime:node`). Non-empty or dropped. */
  readonly source: string;
}

/** Why the organ fell closed (attached to a reachable:false verdict for the audit; never a fabricated pass). */
export type ReachabilityFailReason =
  | "unparseable-output" //     the model output had no parseable JSON object
  | "reachable-not-asserted" // the model did not positively assert reachable:true (absent / said false)
  | "below-confidence-floor" // confidence < θ (0.7) — uncertain ⇒ not admitted
  | "model-flagged-uncertain"; // the model set uncertain:true itself (it hedged)

/**
 * The structured feasibility verdict. On a POSITIVE judgment: `reachable` is true, `confidence` ≥ θ, `blockers`
 * is empty (nothing blocks it), `via` is "reasoning", `reason` absent. On a FAIL-CLOSED judgment: `reachable`
 * is false, `via` is "fail-closed", `reason` records why, and `blockers` carries whatever CITED blockers the
 * model surfaced (possibly empty when the failure is unparseable output). `reachable` is NEVER fabricated true.
 */
export interface ReachabilityVerdict {
  /** The fail-closed feasibility verdict: true ONLY when positively shown reachable at θ; false otherwise. */
  readonly reachable: boolean;
  /** The model's confidence in [0, 1] (0 on an unparseable result). */
  readonly confidence: number;
  /** Cited reasons the goal may not be reachable (empty on a positive verdict; uncited blockers are dropped). */
  readonly blockers: readonly ReachabilityBlocker[];
  /** The prompt-asset version that produced this verdict (rollback provenance). */
  readonly seamVersion: string;
  /** How the verdict was reached. */
  readonly via: "reasoning" | "fail-closed";
  /** Present iff the organ fell closed — the fail-closed reason (audit only). */
  readonly reason?: ReachabilityFailReason;
}

// ── The VERSIONED prompt/persona — a rollback-able asset (seam_version pins it). ─────────────────────────────
// Changing the wording is a versioned change: bump seam_version so a verdict's provenance is exact and a
// regression can be rolled back to a known-good prompt. The persona constrains the model to a STRICT JSON
// envelope and tells it — explicitly — to HEDGE (uncertain:true) rather than over-claim reachable, and to CITE
// every blocker. It reasons FROM the assembled context brief the context-aware port injects ahead of the task.

export const REACHABILITY_PROMPT = Object.freeze({
  seam_version: "reachability/v1",
  persona:
    "You are the reachability evaluator for a software company's autonomous Project Owner. Given a GOAL and the " +
    "assembled, cited company context (what we already decided + what is observed live), you judge ONE thing: is " +
    "this goal REACHABLE with the levers and evidence actually available? You are FAIL-CLOSED: assert reachable:" +
    "true ONLY when you are genuinely confident it can be achieved; if you are unsure, set uncertain:true rather " +
    "than over-claiming. When a goal is not reachable, list the concrete BLOCKERS, each CITED to a context source.",
  /** Build the concrete task for one goal. The goal is fenced so it is recoverable verbatim; the context brief
   *  is injected AHEAD of this string by the context-aware port (reasonWithContext), so the model reasons from it. */
  build(goal: string): string {
    return [
      REACHABILITY_PROMPT.persona,
      "",
      "Judge whether the goal below is REACHABLE, reasoning from the assembled context above.",
      "  reachable   : true ONLY if you are confident it can be achieved with available levers; else false.",
      "  confidence  : your confidence in [0,1]. Below 0.7 the OS will NOT admit the goal — do not inflate it.",
      "  uncertain   : true if you cannot confidently decide (you are hedging) — prefer this over a false positive.",
      "  blockers    : concrete reasons it may not be reachable; each MUST cite a source from the context.",
      "",
      "Respond with STRICT JSON on ONE line, no prose:",
      '{"reachable":<true|false>,"confidence":<0..1>,"uncertain":<true|false>,' +
        '"blockers":[{"claim":"<why>","source":"<citation>"}],"reason":"<one clause>"}',
      "",
      `Goal: <<<${goal}>>>`,
    ].join("\n");
  },
});

// ── Parsing + fail-closed θ=0.7 validation (pure — unit-tested directly, no model needed). ──────────────────

/** The reachable:false sink for a given fail-closed reason (never fabricates reachable:true). */
function failClosed(
  reason: ReachabilityFailReason,
  confidence = 0,
  blockers: readonly ReachabilityBlocker[] = [],
): ReachabilityVerdict {
  return {
    reachable: false,
    confidence,
    blockers,
    seamVersion: REACHABILITY_PROMPT.seam_version,
    via: "fail-closed",
    reason,
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

/** Keep only CITED blockers (I4: an uncited blocker is unattributable — dropped, never surfaced). */
function parseBlockers(raw: unknown): ReachabilityBlocker[] {
  if (!Array.isArray(raw)) return [];
  const out: ReachabilityBlocker[] = [];
  for (const b of raw) {
    if (b === null || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const claim = typeof o.claim === "string" ? o.claim.trim() : "";
    const source = typeof o.source === "string" ? o.source.trim() : "";
    if (claim.length > 0 && source.length > 0) out.push({ claim, source });
  }
  return out;
}

/**
 * Parse a model's raw REACHABILITY output into a typed ReachabilityVerdict, FAIL-CLOSED at θ=0.7. Pure: no I/O,
 * no model. The exact rule (never fabricate reachable:true):
 *   · unparseable output              ⇒ reachable:false (reason "unparseable-output")
 *   · model flagged uncertain:true    ⇒ reachable:false (reason "model-flagged-uncertain")
 *   · model did not assert reachable  ⇒ reachable:false (reason "reachable-not-asserted")
 *   · confidence < θ (0.7)            ⇒ reachable:false (reason "below-confidence-floor")
 *   · else (reachable:true ∧ conf ≥ θ ∧ not uncertain) ⇒ reachable:true (via "reasoning")
 * A fail-closed verdict still carries the model's own confidence and any CITED blockers it surfaced.
 */
export function parseReachabilityOutput(raw: string): ReachabilityVerdict {
  const obj = extractJsonObject(raw);
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return failClosed("unparseable-output");
  }
  const o = obj as Record<string, unknown>;

  // Confidence is read early so a fail-closed verdict can still carry the model's own (possibly low) confidence.
  const confidence =
    typeof o.confidence === "number" && Number.isFinite(o.confidence)
      ? Math.max(0, Math.min(1, o.confidence))
      : 0;
  const blockers = parseBlockers(o.blockers);

  // The model hedged — honor it (an honest "I'm not sure" is fail-closed, never a coin-flip admit).
  if (o.uncertain === true) return failClosed("model-flagged-uncertain", confidence, blockers);

  // Feasibility must be POSITIVELY asserted — absent / false / non-boolean all fail closed (no guessing true).
  if (o.reachable !== true) return failClosed("reachable-not-asserted", confidence, blockers);

  // Asserted reachable BUT under θ ⇒ uncertain ⇒ fail closed (don't admit a goal we cannot confidently reach).
  if (confidence < REACHABILITY_CONFIDENCE_FLOOR) {
    return failClosed("below-confidence-floor", confidence, blockers);
  }

  // Positively shown reachable at θ — the only path to reachable:true.
  return {
    reachable: true,
    confidence,
    blockers: [],
    seamVersion: REACHABILITY_PROMPT.seam_version,
    via: "reasoning",
  };
}

// ── The organ entrypoint — reason through the CONTEXT-AWARE port, parse fail-closed. ─────────────────────────

/** The narrow reasoning seam the organ depends on: `reasonWithContext` with a CLASS. The real
 *  ContextAwareReasoningPort satisfies this structurally, so the organ names a class and never a model, and
 *  tests can inject a lightweight double. */
export interface ReachabilityReasoner {
  reasonWithContext(req: ReasonWithContextRequest): Promise<ReasonWithContextResult>;
}

/**
 * Evaluate whether `goal` is REACHABLE, through the context-aware ReasoningPort (class REACHABILITY). Builds the
 * VERSIONED task, reasons FROM the assembled cited context (the OS's real goal/runtime state informs feasibility),
 * and parses the model's JSON into the typed verdict FAIL-CLOSED at θ=0.7 (see parseReachabilityOutput).
 *
 * This is JUDGMENT, not admission: the deterministic C9 pre-flight gate turns the verdict into ADMIT / HALT — a
 * confident reachable:true is not itself an admission.
 *
 * @param goal    the goal statement to judge.
 * @param ctx     the resolve context (request id) forwarded to the router.
 * @param reasoner the context-aware reasoning seam (ContextAwareReasoningPort satisfies it structurally).
 * @param goalId  optional goal in scope — lets the investigate sources pull THAT GoalContract's live state.
 * @throws ReasoningInvocationError / ContextRequiredError / UnknownReasoningClassError / NoAvailableModelError —
 *   a model/router/context failure PROPAGATES (a step failure is not "unreachable"). Output-level problems fail
 *   closed to a reachable:false verdict instead.
 */
export async function evaluateReachability(
  goal: string,
  ctx: ResolveContext,
  reasoner: ReachabilityReasoner,
  goalId?: string,
): Promise<ReachabilityVerdict> {
  const task = REACHABILITY_PROMPT.build(goal);
  const result = await reasoner.reasonWithContext({
    class: "REACHABILITY",
    task,
    goalId,
    ctx,
    system: REACHABILITY_PROMPT.persona,
  });
  return parseReachabilityOutput(result.text);
}
