// =============================================================================
// THE STRATEGY ORGAN (O2) — the OS's deep APPROACH reasoning, from assembled context (Frozen §10.3).
// =============================================================================
// It answers ONE question about a goal: "given what we already decided and what is observed live, what is the
// APPROACH we should take — and WHY, at what RISK, versus what ALTERNATIVES?" It is the first of the two
// judgment seams (§10.3 "judgment under challenge — the PO does not think alone on hard calls"): where the PO
// forms its considered strategy for a hard goal BEFORE committing to a plan.
//
// It reasons through the context-aware ReasoningPort under class ARCH_REVIEW (deep approach reasoning — the
// highest-stakes thought, most rewarded by context; §10.2 context-policy). Strategy reasons FROM the assembled,
// cited brief the port injects ahead of the task — never from the goal text alone. It names a CLASS, never a
// model (which model serves ARCH_REVIEW is config, resolved by the Model Router behind the port).
//
// FAIL-CLOSED (the honesty invariant — a strategy from assumption is a lie waiting; §10.2):
//   A StrategyResult carries `needs_clarification`. The organ NEVER fabricates an approach. It falls closed to
//   needs_clarification:true (with an EMPTY approach/rationale) for ANY of:
//     · unparseable output              — the model produced no parseable JSON object;
//     · the model asked to clarify       — it set needs_clarification:true itself (it could not commit);
//     · an empty approach                — it returned no actual approach to take;
//     · confidence < θ (the floor)       — it is not confident enough to commit to this approach.
//   A fail-closed result still carries whatever CITED risks + alternatives the model surfaced (audit), but its
//   approach/rationale are blank — the OS must clarify before acting, never act on a guessed strategy.
//   A model INVOCATION error (model down / router resolves nothing / I17 context absent) is a DIFFERENT failure
//   — a step failure, NOT "needs clarification." It PROPAGATES exactly as the port raises it.
//
// SEPARATION OF POWERS: the organ FORMS a strategy (a document). It does NOT plan, admit, or execute. The
// downstream planner/gates consume the strategy; a confident approach is one input, never an action.

import type {
  ReasonWithContextRequest,
  ReasonWithContextResult,
} from "../context/context-aware-port.js";
import type { ResolveContext } from "../model-router.js";

// ── The confidence floor — below this the organ will not commit to an approach (fail-closed to clarify). ─────
/** θ (Frozen §10.3): an approach is committed only at confidence ≥ this. Below it the organ falls closed to
 *  needs_clarification (never a low-confidence strategy presented as settled). Named + rollback-able. */
export const STRATEGY_CONFIDENCE_FLOOR = 0.6;

// ── The organ's output — the typed strategy a planner/board consumes. ───────────────────────────────────────

/** A single strategic risk: WHAT could go wrong, CITED to where it was observed/decided. Honesty-by-construction
 *  (I4): a risk with no source is unattributable — it is DROPPED, never surfaced. */
export interface StrategyRisk {
  /** The risk, in plain words (e.g. "the acceptance metric has no existing lever"). */
  readonly claim: string;
  /** WHERE it came from — the citation (e.g. `goal_contract:g-1`, `os_runtime:node`). Non-empty or dropped. */
  readonly source: string;
}

/**
 * The structured strategy. On a COMMITTED judgment: `approach` + `rationale` are non-empty, `confidence` ≥ θ,
 * `needs_clarification` is false. On a FAIL-CLOSED judgment: `needs_clarification` is true, `approach` +
 * `rationale` are EMPTY (never a fabricated strategy), and `risks` / `alternativesConsidered` carry whatever
 * CITED material the model surfaced. `approach` is NEVER fabricated when the organ is not confident.
 */
export interface StrategyResult {
  /** The approach to take. Empty iff needs_clarification (no fabricated approach). */
  readonly approach: string;
  /** WHY this approach — the reasoning. Empty iff needs_clarification. */
  readonly rationale: string;
  /** Cited risks of the approach (uncited risks are dropped). May be non-empty even when clarifying. */
  readonly risks: readonly StrategyRisk[];
  /** The alternatives the organ weighed and set aside (plain strings). May be present even when clarifying. */
  readonly alternativesConsidered: readonly string[];
  /** The model's confidence in [0, 1] (0 on an unparseable result). */
  readonly confidence: number;
  /** TRUE iff the organ could not confidently commit — fail-closed. When true, approach/rationale are empty. */
  readonly needs_clarification: boolean;
  /** The prompt-asset version that produced this result (rollback provenance). */
  readonly seamVersion: string;
}

// ── The VERSIONED prompt/persona — a rollback-able asset (seam_version pins it). ─────────────────────────────
// Changing the wording is a versioned change: bump seam_version so a result's provenance is exact and a
// regression can be rolled back to a known-good prompt. The persona constrains the model to a STRICT JSON
// envelope and tells it — explicitly — to ASK TO CLARIFY (needs_clarification:true) rather than invent an
// approach it cannot justify, and to CITE every risk. It reasons FROM the assembled context brief the
// context-aware port injects ahead of the task.

export const STRATEGY_PROMPT = Object.freeze({
  seam_version: "strategy/v1",
  persona:
    "You are the strategy organ for a software company's autonomous Project Owner. Given a GOAL and the " +
    "assembled, cited company context (what we already decided + what is observed live), you form the " +
    "APPROACH the company should take to achieve it — the considered strategy, not a plan. You are HONEST: " +
    "commit to an approach ONLY when the context genuinely supports one; if the context is insufficient or " +
    "the goal is under-specified, set needs_clarification:true rather than inventing a strategy. Weigh the " +
    "ALTERNATIVES you set aside, and name every RISK, each CITED to a context source.",
  /** Build the concrete task for one goal. The goal is fenced so it is recoverable verbatim; the context brief
   *  is injected AHEAD of this string by the context-aware port (reasonWithContext), so the model reasons from it. */
  build(goal: string): string {
    return [
      STRATEGY_PROMPT.persona,
      "",
      "Form the APPROACH for the goal below, reasoning from the assembled context above.",
      "  approach            : the strategy to take (one clear paragraph). Empty if you cannot commit.",
      "  rationale           : WHY this approach, grounded in the context.",
      "  risks               : concrete risks of the approach; each MUST cite a source from the context.",
      "  alternativesConsidered : approaches you weighed and set aside (short phrases).",
      "  confidence          : your confidence in [0,1]. Below 0.6 the OS will NOT commit — do not inflate it.",
      "  needs_clarification : true if you cannot confidently commit to an approach — prefer this over guessing.",
      "",
      "Respond with STRICT JSON on ONE line, no prose:",
      '{"approach":"<how>","rationale":"<why>","risks":[{"claim":"<risk>","source":"<citation>"}],' +
        '"alternativesConsidered":["<alt>"],"confidence":<0..1>,"needs_clarification":<true|false>}',
      "",
      `Goal: <<<${goal}>>>`,
    ].join("\n");
  },
});

// ── Parsing + fail-closed validation (pure — unit-tested directly, no model needed). ────────────────────────

/** The needs_clarification sink (never fabricates an approach). Carries any CITED risks/alternatives + the
 *  model's own confidence for the audit, but leaves approach/rationale blank. */
function needsClarification(
  confidence = 0,
  risks: readonly StrategyRisk[] = [],
  alternativesConsidered: readonly string[] = [],
): StrategyResult {
  return {
    approach: "",
    rationale: "",
    risks,
    alternativesConsidered,
    confidence,
    needs_clarification: true,
    seamVersion: STRATEGY_PROMPT.seam_version,
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

/** Keep only CITED risks (I4: an uncited risk is unattributable — dropped, never surfaced). */
function parseRisks(raw: unknown): StrategyRisk[] {
  if (!Array.isArray(raw)) return [];
  const out: StrategyRisk[] = [];
  for (const r of raw) {
    if (r === null || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const claim = typeof o.claim === "string" ? o.claim.trim() : "";
    const source = typeof o.source === "string" ? o.source.trim() : "";
    if (claim.length > 0 && source.length > 0) out.push({ claim, source });
  }
  return out;
}

/** Keep only non-empty string alternatives (a blank alternative carries no judgment — dropped). */
function parseAlternatives(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const a of raw) {
    if (typeof a === "string" && a.trim().length > 0) out.push(a.trim());
  }
  return out;
}

/**
 * Parse a model's raw STRATEGY output into a typed StrategyResult, FAIL-CLOSED. Pure: no I/O, no model. The
 * exact rule (never fabricate an approach):
 *   · unparseable output              ⇒ needs_clarification (confidence 0)
 *   · model set needs_clarification    ⇒ needs_clarification (honor it, carry its risks/alternatives)
 *   · empty approach OR empty rationale ⇒ needs_clarification (nothing to commit to)
 *   · confidence < θ (0.6)            ⇒ needs_clarification (not confident enough to commit)
 *   · else (approach ∧ rationale ∧ conf ≥ θ ∧ not asked-to-clarify) ⇒ committed strategy
 */
export function parseStrategyOutput(raw: string): StrategyResult {
  const obj = extractJsonObject(raw);
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return needsClarification();
  }
  const o = obj as Record<string, unknown>;

  const confidence =
    typeof o.confidence === "number" && Number.isFinite(o.confidence)
      ? Math.max(0, Math.min(1, o.confidence))
      : 0;
  const risks = parseRisks(o.risks);
  const alternativesConsidered = parseAlternatives(o.alternativesConsidered);
  const approach = typeof o.approach === "string" ? o.approach.trim() : "";
  const rationale = typeof o.rationale === "string" ? o.rationale.trim() : "";

  // The model asked to clarify — honor it (an honest "I can't commit" is never overridden into a strategy).
  if (o.needs_clarification === true) return needsClarification(confidence, risks, alternativesConsidered);

  // No actual approach/rationale ⇒ nothing to commit to (never present a blank strategy as settled).
  if (approach.length === 0 || rationale.length === 0) {
    return needsClarification(confidence, risks, alternativesConsidered);
  }

  // Under the confidence floor ⇒ clarify (don't commit to an approach we cannot confidently justify).
  if (confidence < STRATEGY_CONFIDENCE_FLOOR) {
    return needsClarification(confidence, risks, alternativesConsidered);
  }

  // Confident, committed strategy — the only path to a non-clarifying result.
  return {
    approach,
    rationale,
    risks,
    alternativesConsidered,
    confidence,
    needs_clarification: false,
    seamVersion: STRATEGY_PROMPT.seam_version,
  };
}

// ── The organ entrypoint — reason through the CONTEXT-AWARE port, parse fail-closed. ─────────────────────────

/** The narrow reasoning seam the organ depends on: `reasonWithContext` with a CLASS. The real
 *  ContextAwareReasoningPort satisfies this structurally, so the organ names a class and never a model, and
 *  tests can inject a lightweight double. */
export interface StrategyReasoner {
  reasonWithContext(req: ReasonWithContextRequest): Promise<ReasonWithContextResult>;
}

/**
 * Form the strategy for `goal`, through the context-aware ReasoningPort (class ARCH_REVIEW). Builds the
 * VERSIONED task, reasons FROM the assembled cited context (the OS's real decided/observed state informs the
 * approach), and parses the model's JSON into the typed result FAIL-CLOSED (see parseStrategyOutput).
 *
 * This is JUDGMENT, not action: the result is a strategy DOCUMENT. It does not plan, admit, or execute.
 *
 * @param goal     the goal statement to form a strategy for.
 * @param ctx      the resolve context (request id) forwarded to the router.
 * @param reasoner the context-aware reasoning seam (ContextAwareReasoningPort satisfies it structurally).
 * @param goalId   optional goal in scope — lets the investigate sources pull THAT GoalContract's live state.
 * @throws ReasoningInvocationError / ContextRequiredError / UnknownReasoningClassError / NoAvailableModelError —
 *   a model/router/context failure PROPAGATES (a step failure is not "needs clarification"). Output-level
 *   problems fall closed to needs_clarification instead.
 */
export async function formStrategy(
  goal: string,
  ctx: ResolveContext,
  reasoner: StrategyReasoner,
  goalId?: string,
): Promise<StrategyResult> {
  const task = STRATEGY_PROMPT.build(goal);
  const result = await reasoner.reasonWithContext({
    class: "ARCH_REVIEW",
    task,
    goalId,
    ctx,
    system: STRATEGY_PROMPT.persona,
  });
  return parseStrategyOutput(result.text);
}
