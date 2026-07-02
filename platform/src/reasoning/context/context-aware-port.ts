// =============================================================================
// THE CONTEXT-AWARE REASONING PORT — I17 made executable on the reasoning path (Frozen §10.2, G-15).
// =============================================================================
// `reasonWithContext` is the seam every CONSEQUENTIAL thought goes through. For a context-requiring class it:
//   1. ASSEMBLES context FIRST (the two paired moves — knowledge-retrieve + C0-INVESTIGATE, via assembleContext);
//   2. ENFORCES I17 — if the brief is absent/empty it FAILS CLOSED with ContextRequiredError ("a thin-prompt
//      reasoning seam is a defect, not a cheaper mode"), never a cold reason() call;
//   3. INJECTS the cited brief into the prompt preamble (formatContextBrief), so the model reasons FROM it;
//   4. delegates to the underlying ReasoningPort.reason() (class → model → invoke, unchanged).
// For a cheap/high-volume class (CLASSIFY / NARRATE / CODE) it SKIPS assembly and reasons directly — the split
// is owned by requiresContext() (context-policy.ts), not re-decided here.
//
// This is additive: it WRAPS the existing ReasoningPort; it does not modify it. Organs that must think
// consequentially call reasonWithContext instead of reason — same class-indexed, model-agnostic contract,
// now with context-before-cognition enforced.

import type { ReasonResult } from "../reasoning-port.js";
import type { ReasoningClass } from "../reasoning-class.js";
import type { ResolveContext } from "../model-router.js";
import type { ContextBrief } from "./context-brief.js";
import { assembleContext, type ContextSources } from "./context-assembler.js";
import { injectContext } from "./context-prompt.js";
import { assertContextSatisfied, requiresContext } from "./context-policy.js";

/** The minimal reasoning capability this wrapper needs — satisfied by the real ReasoningPort (structural). */
export interface Reasoner {
  reason(req: {
    readonly class: ReasoningClass;
    readonly prompt: string;
    readonly ctx: ResolveContext;
    readonly system?: string;
    readonly timeoutMs?: number;
  }): Promise<ReasonResult>;
}

/** A context-aware reasoning request: a CLASS, the TASK (not a pre-baked prompt), an optional goal, the ctx. */
export interface ReasonWithContextRequest {
  readonly class: ReasoningClass;
  /** The task/instruction to reason about. The assembled context is injected AHEAD of this. */
  readonly task: string;
  /** Optional goal in scope — lets the investigate sources pull that GoalContract's live state. */
  readonly goalId?: string;
  readonly ctx: ResolveContext;
  readonly system?: string;
  readonly timeoutMs?: number;
}

/** The result of a context-aware reason: the model result PLUS the brief it reasoned from (undefined if cheap). */
export interface ReasonWithContextResult extends ReasonResult {
  /** The assembled brief the call reasoned from — undefined for cheap classes that skip assembly (audit). */
  readonly brief?: ContextBrief;
}

/**
 * Wraps a ReasoningPort with I17 context-assembly. Constructed once with the underlying port + the injected
 * context sources (knowledge corpus + investigate sources); shared by organs.
 */
export class ContextAwareReasoningPort {
  constructor(
    private readonly port: Reasoner,
    private readonly sources: ContextSources,
  ) {}

  /**
   * Reason with context. For a context-requiring class: assemble → enforce I17 (fail closed) → inject → reason.
   * For a cheap class: reason directly (no assembly). Resolution/invocation errors propagate from the
   * underlying port unchanged; ContextRequiredError is thrown here when a consequential class has no context.
   * @throws ContextRequiredError if the class requires context but the assembled brief is empty/absent.
   */
  async reasonWithContext(req: ReasonWithContextRequest): Promise<ReasonWithContextResult> {
    // Cheap / high-volume class: the split says skip assembly (§10.2 "cheap thoughts stay cheap").
    if (!requiresContext(req.class)) {
      const result = await this.port.reason({
        class: req.class,
        prompt: req.task,
        ctx: req.ctx,
        system: req.system,
        timeoutMs: req.timeoutMs,
      });
      return { ...result };
    }

    // Consequential class: assemble FIRST, then enforce I17 before any model call.
    const brief = await assembleContext(
      { class: req.class, task: req.task, goalId: req.goalId, ctx: req.ctx },
      this.sources,
    );
    // Fail closed: an empty/absent brief for a consequential class is a defect, not a cheaper mode.
    assertContextSatisfied(req.class, brief);

    const prompt = injectContext(brief, req.task);
    const result = await this.port.reason({
      class: req.class,
      prompt,
      ctx: req.ctx,
      system: req.system,
      timeoutMs: req.timeoutMs,
    });
    return { ...result, brief };
  }
}
