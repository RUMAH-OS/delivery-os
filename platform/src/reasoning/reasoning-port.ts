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
    // Structural minimum an audit needs: which binding/model failed. A full ModelBinding satisfies it (the
    // resolve path passes one); the forced-model eval seam passes a lighter {model, bindingId}.
    readonly binding: { readonly model: string; readonly bindingId: string },
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

  /**
   * FORCED-MODEL SEAM (ADR §"Eval harness hook"). Run a class+prompt under an EXPLICIT model id, bypassing the
   * router's class→model resolution — the eval harness needs to score a SPECIFIC candidate, not "whatever the
   * A/B lands on." It reuses the SAME LLM invocation path as reason() (llm.complete with the model id), so the
   * harness never duplicates the model call. Emits outcome telemetry with a `:forced:` bindingId; fail-closed
   * on error (throws ReasoningInvocationError — the runner records that case as a failure, never a fake pass).
   */
  reasonForced(req: ForcedReasonRequest): Promise<ForcedReasonResult> {
    return reasonForced(this.llm, req, { now: this.now, telemetry: this.telemetry });
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

// =============================================================================
// FORCED-MODEL REASONING — the eval-harness seam, usable with just an LlmClient (no router / no DB).
// =============================================================================

/** A forced reasoning request: a class + prompt run under an EXPLICIT model (the candidate the harness scores). */
export interface ForcedReasonRequest {
  readonly class: ReasoningClass;
  readonly prompt: string;
  /** The concrete model id to force for this call (a harness candidate). Not resolved through the router. */
  readonly model: string;
  readonly system?: string;
  readonly timeoutMs?: number;
}

/** The result of a forced invocation: the model's text, the forced model + a synthetic bindingId, and latency. */
export interface ForcedReasonResult {
  readonly text: string;
  readonly model: string;
  /** `${class}:forced:${model}` — mirrors the router's bindingId shape so telemetry/audit stays uniform. */
  readonly bindingId: string;
  readonly latencyMs: number;
}

export interface ForcedReasonOptions {
  /** Clock seam for deterministic latency in tests; default Date.now. */
  readonly now?: () => number;
  /** Optional outcome sink (same shape as the port's); default no-op. */
  readonly telemetry?: ReasonTelemetrySink;
}

/**
 * Invoke a class+prompt under a FORCED model through the given LlmClient. This is the single place the eval
 * harness turns "class X under model M" into an actual model call — it reuses llm.complete exactly as the
 * ReasoningPort does, so there is ONE model-invocation path, not two. Fail-closed: a model error is wrapped
 * in ReasoningInvocationError (never a fabricated result).
 */
export async function reasonForced(
  llm: LlmClient,
  req: ForcedReasonRequest,
  opts: ForcedReasonOptions = {},
): Promise<ForcedReasonResult> {
  const now = opts.now ?? Date.now;
  const telemetry = opts.telemetry ?? (() => {});
  const bindingId = `${req.class}:forced:${req.model}`;
  const started = now();
  try {
    const text = await llm.complete(req.prompt, {
      model: req.model,
      system: req.system,
      timeoutMs: req.timeoutMs,
    });
    const latencyMs = now() - started;
    telemetry({ class: req.class, model: req.model, bindingId, outcome: "ok", latencyMs });
    return { text, model: req.model, bindingId, latencyMs };
  } catch (cause) {
    telemetry({ class: req.class, model: req.model, bindingId, outcome: "error", latencyMs: now() - started });
    throw new ReasoningInvocationError({ model: req.model, bindingId }, cause);
  }
}
