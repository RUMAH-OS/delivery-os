// =============================================================================
// THE NARRATE ORGAN (O12) — the OS COMPOSES the founder-facing reply (P2 slice 8, roadmap G-24).
// =============================================================================
// It turns an ALREADY-DECIDED outcome (a classification refusal / a reachability blockers list / a plan DAG /
// a completion verdict) into ONE founder-facing message, by REASONING through the context-aware ReasoningPort
// (class NARRATE). NARRATE is a CHEAP/high-volume class (context-policy.ts): the context that mattered was
// assembled UPSTREAM at the decision, not re-assembled to phrase the answer — so the organ reasons on the
// outcome alone (reasonWithContext skips assembly for NARRATE). Spec: ADR-reasoning-model-routing.md + Frozen
// §10 (O12 compose-identity / narration; the PO is a THIN ORCHESTRATOR that composes organs).
//
// SEPARATION OF POWERS (load-bearing):
//   · The organ PHRASES. It DECIDES NOTHING. The verdicts / plan / blockers were decided by the upstream
//     organs (classify / reachability / planner / completion-review); NARRATE only renders them into prose the
//     founder can read. It admits nothing, plans nothing, reviews nothing.
//   · The organ names a CLASS ("NARRATE"), never a model. Which model serves NARRATE is config
//     (reasoning-routing.config.json), resolved by the Model Router behind the (context-aware) ReasoningPort.
//
// FAIL-CLOSED — never lose the message, never fabricate content (the honesty invariant for narration):
//   The founder-facing reply MUST always exist AND must contain ONLY facts that are in the decided outcome.
//   So the organ has a DETERMINISTIC template floor (renderOutcomeTemplate): a plain rendering of the outcome's
//   own fields. It falls back to that floor whenever the model cannot be trusted to have phrased the SAME facts:
//     · the model returns empty / whitespace-only / degenerate text (nothing usable to show the founder);
//     · the model INVOCATION fails (the router resolves nothing / the model is down) — the decision is already
//       made; a phrasing-step failure must not discard a decided outcome, so we render it deterministically.
//   The template NEVER invents content not present in the outcome — it is a projection of the outcome's fields,
//   so the fallback is honest by construction (unlike a free-text model, it cannot hallucinate a blocker or step).

import type { ResolveContext } from "../model-router.js";
import type {
  ReasonWithContextRequest,
  ReasonWithContextResult,
} from "../context/context-aware-port.js";

// ── The ALREADY-DECIDED outcome the organ phrases. A small, self-contained union so the organ is decoupled ──
// from the concrete organ result types (the pipeline maps each organ's output into one of these). Every field
// is a fact the upstream decision produced; the organ (and its template floor) render ONLY these — nothing else.

/** One cited blocker from a reachability refusal (claim + where it was observed). */
export interface OutcomeBlocker {
  readonly claim: string;
  readonly source: string;
}

/** One step of a decided plan, rendered for the founder (the acceptance-shaped unit the planner emitted). */
export interface OutcomeStep {
  readonly id: string;
  readonly target: string;
  readonly op: string;
  readonly direction: string;
}

/** One completion-review lens finding (the axis, whether it was affirmed, the finding). */
export interface OutcomeFinding {
  readonly lens: string;
  readonly met: boolean;
  readonly finding: string;
}

/**
 * The decided outcome to phrase. A discriminated union over the stages the reasoning loop can HALT at or REACH:
 *   · clarification — the classifier / planner refused (ambiguous input) → ask the founder to clarify;
 *   · blocked       — reachability fell closed → the goal is not reachable, here are the cited blockers;
 *   · planned       — the goal is reachable and decomposed → here is the plan (the DAG's steps + surfaces);
 *   · reviewed      — a completion review returned a verdict → here is the done/needs-work/fail finding;
 *   · acknowledged  — a non-consequential utterance was understood (no plan warranted) → a plain acknowledgement.
 */
export type ReasoningOutcome =
  | { readonly kind: "clarification"; readonly utterance: string; readonly reason: string }
  | { readonly kind: "blocked"; readonly goal: string; readonly blockers: readonly OutcomeBlocker[] }
  | {
      readonly kind: "planned";
      readonly goal: string;
      readonly steps: readonly OutcomeStep[];
      readonly disjointSurfaces: readonly string[];
    }
  | {
      readonly kind: "reviewed";
      readonly goal: string;
      readonly verdict: string;
      readonly findings: readonly OutcomeFinding[];
    }
  | { readonly kind: "acknowledged"; readonly utterance: string; readonly intent: string; readonly lane: string };

// ── The usability floor — below this the model output is not shown to the founder (template floor is used). ──
/** The narration must have at least this many non-whitespace characters to be shown; else the deterministic
 *  template floor is used. A named constant so the bar is a rollback-able asset (kept minimal — the point is
 *  to reject empty/degenerate output, not to second-guess a real reply's wording). */
export const NARRATION_MIN_CHARS = 1;

/** True iff `text` is a usable founder-facing narration (non-empty after trimming, at/above the min floor). */
export function isUsableNarration(text: string): boolean {
  return text.trim().length >= NARRATION_MIN_CHARS;
}

// ── The DETERMINISTIC template floor — a projection of the outcome's OWN fields (never invents content). ─────
// This is the fail-closed narration: given the decided outcome, it renders a plain founder-facing message using
// ONLY the outcome's fields. It is exhaustive over the union (a compile error if a kind is added un-handled), so
// there is always a message, and the message can never contain a fact the decision did not produce.

/** Render a founder-facing message from the outcome ALONE — no model, no I/O, no fabrication. */
export function renderOutcomeTemplate(outcome: ReasoningOutcome): string {
  switch (outcome.kind) {
    case "clarification":
      return [
        "I need a little more to go on before I can act on that.",
        `What I heard: "${outcome.utterance}".`,
        `Why I paused: ${outcome.reason}.`,
        "Could you clarify what you'd like me to do?",
      ].join(" ");
    case "blocked": {
      const lines = outcome.blockers.length
        ? outcome.blockers.map((b) => `  - ${b.claim} (${b.source})`).join("\n")
        : "  - (no specific blocker was cited)";
      return [
        `I can't take on "${outcome.goal}" yet — on the evidence we have, it isn't reachable.`,
        "Blockers:",
        lines,
      ].join("\n");
    }
    case "planned": {
      const steps = outcome.steps.length
        ? outcome.steps.map((s, i) => `  ${i + 1}. ${s.target} (${s.direction} ${s.op})`).join("\n")
        : "  (no steps)";
      const surfaces = outcome.disjointSurfaces.length ? outcome.disjointSurfaces.join(", ") : "a single workstream";
      return [
        `Here is the plan for "${outcome.goal}" — ${outcome.steps.length} step(s) across: ${surfaces}.`,
        steps,
      ].join("\n");
    }
    case "reviewed": {
      const findings = outcome.findings.length
        ? outcome.findings.map((f) => `  - ${f.lens}: ${f.met ? "met" : "NOT met"} — ${f.finding}`).join("\n")
        : "  - (no lens findings)";
      return [`Completion review for "${outcome.goal}": ${outcome.verdict}.`, findings].join("\n");
    }
    case "acknowledged":
      return [
        `Understood — I read "${outcome.utterance}" as a ${outcome.lane} request (intent: ${outcome.intent}).`,
        "No plan is warranted for this one; let me know if you'd like me to take it further.",
      ].join(" ");
  }
}

// ── The VERSIONED prompt/persona — a rollback-able asset (seam_version pins it). ─────────────────────────────
// Changing the wording is a versioned change: bump seam_version so a narration's provenance is exact. The
// persona constrains the model HARD: phrase the outcome for the founder, invent NOTHING, decide NOTHING. The
// outcome is serialized into the task so the model has exactly the facts it may use — and nothing more.

export const NARRATOR_PROMPT = Object.freeze({
  seam_version: "narrator/v1",
  persona:
    "You are the NARRATOR (O12) for a software company's autonomous Project Owner. Your ONLY job is to phrase " +
    "an ALREADY-DECIDED outcome into one clear, warm, founder-facing message. You DECIDE NOTHING and you INVENT " +
    "NOTHING: every fact in your reply must come from the outcome you are given — do not add blockers, steps, " +
    "verdicts, caveats, or promises that are not in it. Be concise and plain-spoken; no jargon, no JSON.",
  /**
   * Build the concrete narration task from a decided outcome. The outcome is serialized (fenced) so the model
   * has EXACTLY the facts it may use and can recover them verbatim. `forFounder` tunes the register only.
   */
  build(outcome: ReasoningOutcome, forFounder: boolean): string {
    const audience = forFounder
      ? "Write for the FOUNDER: a short, direct, human message (2-5 sentences)."
      : "Write a short internal note (terse, factual).";
    return [
      NARRATOR_PROMPT.persona,
      "",
      "Phrase the decided outcome below into ONE reply. Use ONLY the facts in it — invent nothing, decide nothing.",
      audience,
      "",
      "Decided outcome (JSON — the ONLY facts you may use):",
      `  <<<${JSON.stringify(outcome)}>>>`,
      "",
      "Respond with the founder-facing message as plain prose (no JSON, no preamble).",
    ].join("\n");
  },
});

// ── The organ entrypoint — reason through the CONTEXT-aware port (NARRATE skips assembly), fail-closed. ──────

/** The narrow context-aware reasoning seam the organ depends on: `reasonWithContext` with a CLASS. The real
 *  ContextAwareReasoningPort satisfies this structurally, so the organ names NARRATE and never a model, and
 *  tests can inject a lightweight double. */
export interface NarrateReasoner {
  reasonWithContext(req: ReasonWithContextRequest): Promise<ReasonWithContextResult>;
}

/** The narration request: the decided outcome, the audience flag, and the resolve ctx. */
export interface NarrateInput {
  /** The ALREADY-DECIDED outcome to phrase (verdicts / plan / blockers). The organ renders it, deciding nothing. */
  readonly outcome: ReasoningOutcome;
  /** True (default) → a founder-facing register; false → a terse internal note. Tunes tone only, not facts. */
  readonly forFounder?: boolean;
  readonly ctx: ResolveContext;
}

/**
 * Compose the founder-facing reply from an ALREADY-DECIDED outcome, through the context-aware ReasoningPort
 * (class NARRATE — a cheap class, so reasonWithContext reasons on the outcome alone, no assembly). Builds the
 * VERSIONED task, reasons, and returns the model's prose.
 *
 * FAIL-CLOSED to the deterministic template floor (renderOutcomeTemplate) — never lose the message, never
 * fabricate content: if the model returns empty/degenerate text, OR the model invocation fails, the organ
 * renders the outcome's OWN fields deterministically instead. The founder always gets a truthful message.
 *
 * This is PHRASING, not judgment: it admits nothing, plans nothing, reviews nothing.
 */
export async function narrate(input: NarrateInput, reasoner: NarrateReasoner): Promise<string> {
  const task = NARRATOR_PROMPT.build(input.outcome, input.forFounder ?? true);
  let text: string;
  try {
    const result = await reasoner.reasonWithContext({
      class: "NARRATE",
      task,
      ctx: input.ctx,
      system: NARRATOR_PROMPT.persona,
    });
    text = result.text;
  } catch {
    // A phrasing-step failure must not discard an already-decided outcome — render it deterministically.
    return renderOutcomeTemplate(input.outcome);
  }
  // Empty / degenerate model output ⇒ fall back to the honest template floor (never show the founder nothing).
  if (!isUsableNarration(text)) return renderOutcomeTemplate(input.outcome);
  return text.trim();
}
