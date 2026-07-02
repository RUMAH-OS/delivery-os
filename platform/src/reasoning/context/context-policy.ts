// =============================================================================
// THE I17 POLICY — "context before cognition", made executable (Frozen §10.2).
// =============================================================================
// I17 (context half): "no consequential reasoning call fires without a context-assembly step first; a
// thin-prompt reasoning seam is a DEFECT, not a cheaper mode." `requiresContext(class)` is that rule as a
// pure predicate — the single source of truth for WHICH reasoning classes must be context-assembled — and
// ContextRequiredError is the fail-closed it enforces when a consequential class would reason with no
// assembled context (see context-aware-port.ts).

import type { ReasoningClass } from "../reasoning-class.js";

// ── THE SPLIT (§10.2). Consequential = a substantive judgment whose blast radius rewards the whole relevant
//    company context ("a strong model on a thin prompt is dumb"). These MUST be context-assembled:
//      · CONVERSE     — the PO's decide/dialogue mind; it must speak from observed reality + prior decisions.
//      · PLAN         — decomposition into a DAG; planning from a cold prompt re-derives what we already know.
//      · ARCH_REVIEW  — deep architecture reasoning; the highest-stakes thought, most rewarded by context.
//      · REACHABILITY — fail-closed feasibility (θ=0.7); a feasibility call from assumption is a lie waiting.
//      · VERIFY       — adversarial completion judgment; must re-probe against the DECIDED acceptance + state.
//      · INVESTIGATE  — deep investigation; investigating without first assembling live state is contradictory.
//      · REPO_ANALYSIS— breadth reading/analysis; the assembled brief is what makes the breadth coherent.
//
//    Cheap / high-volume = mechanical or per-token work where an assembly step is pure overhead (and would
//    throttle throughput). These SKIP assembly by design — NOT a loophole, a deliberate boundary (§10.2:
//    "cheap thoughts stay cheap"):
//      · CLASSIFY — inline, high-volume {intent,lane,consequentiality} labelling. It answers "what KIND of
//                   utterance is this?" from the utterance itself; it does not DECIDE, it routes. Assembling
//                   the whole company context before every label would defeat its cheap/high-volume purpose,
//                   and any consequential thought it routes TO is itself context-assembled downstream.
//      · NARRATE  — O12 composes the founder-facing reply from an ALREADY-decided result; the context that
//                   mattered was assembled upstream at the decision, not re-assembled to phrase the answer.
//      · CODE     — mechanical author/implementation of an ALREADY-planned+context-assembled unit of work;
//                   the assembled context lives in the PLAN it implements. (The upstream PLAN is where the
//                   §10.2 rule bites; re-assembling per code call would be redundant, not smarter.)
const CONTEXT_REQUIRED: ReadonlySet<ReasoningClass> = new Set<ReasoningClass>([
  "CONVERSE",
  "PLAN",
  "ARCH_REVIEW",
  "REACHABILITY",
  "VERIFY",
  "INVESTIGATE",
  "REPO_ANALYSIS",
]);

/**
 * I17 predicate: does this reasoning class REQUIRE a context-assembly step before it may reason? TRUE for the
 * consequential classes above; FALSE for the cheap/high-volume ones (CLASSIFY / NARRATE / CODE). This is the
 * one place the split lives — the context-aware port consults it; no organ re-decides it.
 */
export function requiresContext(cls: ReasoningClass): boolean {
  return CONTEXT_REQUIRED.has(cls);
}

/**
 * Fail-closed error for I17: a consequential reasoning call was attempted with NO assembled context (an
 * absent or honestly-empty brief where policy demands one). This is the "defect, not a cheaper mode" rule
 * thrown, not silently tolerated — the governance spine treats it as a step failure, never a fabricated pass.
 */
export class ContextRequiredError extends Error {
  constructor(
    readonly reasoningClass: ReasoningClass,
    readonly detail: "absent" | "empty",
  ) {
    super(
      `context_required: reasoning class ${reasoningClass} is consequential (I17) and requires an assembled ` +
        `context brief before it may reason, but the brief was ${detail}. A thin-prompt reasoning seam is a ` +
        `defect, not a cheaper mode — assemble context first.`,
    );
    this.name = "ContextRequiredError";
  }
}

/**
 * The executable enforcement of I17. If the class requires context and the brief is absent or empty, THROW
 * ContextRequiredError (fail-closed). Otherwise return — the call may proceed. Pure; the port calls this
 * immediately before it invokes reason() for a context-requiring class.
 */
export function assertContextSatisfied(
  cls: ReasoningClass,
  brief: { readonly empty: boolean } | undefined,
): void {
  if (!requiresContext(cls)) return;
  if (brief === undefined) throw new ContextRequiredError(cls, "absent");
  if (brief.empty) throw new ContextRequiredError(cls, "empty");
}
