// =============================================================================
// REASONING PORT — the single seam organs reason through (ADR-reasoning-model-routing.md).
// =============================================================================
// An organ says "reason with class CONVERSE about this prompt"; it NEVER names a model. The port:
//   1. resolves the class → a concrete ModelBinding via the Model Router (config-only; deterministic A/B);
//   2. invokes that model through the EXISTING core LLM client (llm.ts), passing the resolved model id +
//      the class params — the router-selected id flows through LlmCompleteOptions.model (the minimal seam);
//   3. records an outcome telemetry record {class, model, bindingId, outcome} for the eval harness;
//   4. FAILS CLOSED — if nothing resolves (typed router throw) or the model call errors, it propagates a
//      typed error. It NEVER fabricates a result (honesty invariant: the model narrates, it never invents).

import type { LlmClient } from "../core/llm.js";
import type { ModelBinding, ModelRouter, ResolveContext } from "./model-router.js";
import type { ReasoningClass } from "./reasoning-class.js";

/** A reasoning request: a CLASS (not a model), the prompt, and a ctx whose requestId seeds the A/B hash. */
export interface ReasonRequest {
  /** The reasoning class (organ code depends only on this). */
  readonly class: ReasoningClass;
  readonly prompt: string;
  readonly ctx: ResolveContext;
  /** Optional system-style preamble forwarded to the LLM client. */
  readonly system?: string;
  /** Optional hard per-call timeout (ms), forwarded to the LLM client. */
  readonly timeoutMs?: number;
}

/** The result of a reasoning invocation: the model's text plus the binding that produced it (for audit). */
export interface ReasonResult {
  readonly text: string;
  readonly binding: ModelBinding;
}

/** Outcome telemetry (ADR §"Router contract" — the {class, model, bindingId, outcome} eval-harness feed). */
export interface ReasonTelemetry {
  readonly class: ReasoningClass;
  readonly model: string;
  readonly bindingId: string;
  readonly outcome: "ok" | "error";
  readonly latencyMs: number;
}

/** Injectable outcome sink; default no-op. Distinct from the router's resolve-time telemetry sink. */
export type ReasonTelemetrySink = (record: ReasonTelemetry) => void;

/** Thrown when the underlying model invocation fails. Fail-closed — no fabricated result is ever returned. */
export class ReasoningInvocationError extends Error {
  constructor(
    readonly binding: ModelBinding,
    readonly cause: unknown,
  ) {
    super(`reasoning_invocation_failed: ${binding.bindingId}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "ReasoningInvocationError";
  }
}

export interface ReasoningPortOptions {
  readonly telemetry?: ReasonTelemetrySink;
  /** Clock seam for deterministic latency in tests; default Date.now. */
  readonly now?: () => number;
}

/**
 * The ReasoningPort. Wires a ModelRouter (class → model) to a core LlmClient (the actual invocation).
 * Constructed once per process (or per test) and shared by organs.
 */
export class ReasoningPort {
  private readonly telemetry: ReasonTelemetrySink;
  private readonly now: () => number;

  constructor(
    private readonly router: ModelRouter,
    private readonly llm: LlmClient,
    opts: ReasoningPortOptions = {},
  ) {
    this.telemetry = opts.telemetry ?? (() => {});
    this.now = opts.now ?? Date.now;
  }

  /**
   * Reason with a class. Resolves the model, invokes it, records outcome telemetry, returns the result.
   * @throws UnknownReasoningClassError / NoAvailableModelError (from the router) — fail-closed, propagated.
   * @throws ReasoningInvocationError if the model call fails — fail-closed, never a fabricated result.
   */
  async reason(req: ReasonRequest): Promise<ReasonResult> {
    // Resolution errors (unknown class / nothing available) propagate untouched — the governance spine
    // treats them as a step failure; there is no fallback to a fabricated answer.
    const binding = this.router.resolve(req.class, req.ctx);
    const started = this.now();
    try {
      const text = await this.llm.complete(req.prompt, {
        model: binding.model,
        system: req.system,
        timeoutMs: req.timeoutMs,
      });
      this.emit(req.class, binding, "ok", started);
      return { text, binding };
    } catch (cause) {
      this.emit(req.class, binding, "error", started);
      throw new ReasoningInvocationError(binding, cause);
    }
  }

  private emit(cls: ReasoningClass, binding: ModelBinding, outcome: "ok" | "error", started: number): void {
    this.telemetry({
      class: cls,
      model: binding.model,
      bindingId: binding.bindingId,
      outcome,
      latencyMs: this.now() - started,
    });
  }
}
