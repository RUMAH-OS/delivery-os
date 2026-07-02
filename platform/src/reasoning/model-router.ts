// =============================================================================
// MODEL ROUTER — resolves a reasoning CLASS to a concrete model binding (data-only).
// =============================================================================
// The enforcement mechanism for ADR-reasoning-model-routing.md: organ code names a CLASS; this router
// resolves that class to a model from CONFIG alone. Model IDs live only in reasoning-routing.config.json;
// this module reads them at runtime and never hard-codes one. Responsibilities (ADR §"Router contract"):
//   - pick `primary`, or route a DETERMINISTIC traffic fraction to a `challenger` (hash of requestId — NO
//     Math.random; A/B must be stable + reproducible so the eval harness can attribute outcomes);
//   - walk the `fallback` chain when the preferred model is unavailable (availability is a runtime input,
//     an injectable predicate — a not-yet-provisioned model simply falls through, ADR §"Model-agnostic");
//   - throw a TYPED error on an unknown class (fail-closed; the governance spine handles the step failure);
//   - emit a telemetry record {class, model, bindingId} through an injectable sink (default no-op);
//   - resolveAll() → the boot resolution map (every class → its referenced models + whether each resolves).

import type { ReasoningClass } from "./reasoning-class.js";
import { isReasoningClass } from "./reasoning-class.js";
import type { ClassBinding, RoutingConfig, RoutingParams } from "./routing-config.js";

/** The resolved binding an organ reasons through. `bindingId` is the audit key for telemetry / A/B. */
export interface ModelBinding {
  readonly model: string;
  readonly params: RoutingParams;
  /** Stable audit key: `${class}:${role}:${model}` where role ∈ {primary, challenger, fallback}. */
  readonly bindingId: string;
}

/** Which slot in the class binding produced the resolved model (for telemetry + the bindingId). */
export type BindingRole = "primary" | "challenger" | "fallback";

/** A telemetry record emitted on every successful resolve (ADR §"Router contract" — the eval-harness feed). */
export interface RouterTelemetry {
  readonly class: ReasoningClass;
  readonly model: string;
  readonly bindingId: string;
}

/** Injectable telemetry sink; default no-op so the router is side-effect-free unless a sink is supplied. */
export type TelemetrySink = (record: RouterTelemetry) => void;

/** Injectable availability predicate. Default: everything is available (build-time never gates a model). */
export type AvailabilityPredicate = (model: string) => boolean;

/** Per-resolve context. `requestId` seeds the DETERMINISTIC A/B hash — same id ⇒ same binding, always. */
export interface ResolveContext {
  readonly requestId: string;
}

// ── Typed errors — callers (and the governance spine) distinguish a class fault from a resolution fault. ──

/** Thrown when a class has no binding in the config (or is not a known reasoning class at all). */
export class UnknownReasoningClassError extends Error {
  constructor(readonly reasoningClass: string) {
    super(`unknown_reasoning_class: ${reasoningClass}`);
    this.name = "UnknownReasoningClassError";
  }
}

/** Thrown when NO candidate (primary → challenger → fallback) is available. Fail-closed — never fabricated. */
export class NoAvailableModelError extends Error {
  constructor(
    readonly reasoningClass: ReasoningClass,
    readonly candidates: readonly string[],
  ) {
    super(`no_available_model: ${reasoningClass} (tried: ${candidates.join(", ") || "<none>"})`);
    this.name = "NoAvailableModelError";
  }
}

// ── Deterministic hash (FNV-1a, 32-bit). Pure + reproducible: the ONLY source of A/B randomness. ──
// Math.random is BANNED here (non-reproducible; the eval harness could never attribute an outcome to a
// binding). A fixed hash of the requestId means the SAME request always lands in the SAME A/B bucket.
const AB_BUCKETS = 1000;

function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply via Math.imul (stays in 32-bit; deterministic across engines).
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Map a requestId to a stable bucket in [0, AB_BUCKETS). Exported for tests that assert determinism. */
export function abBucket(requestId: string): number {
  return fnv1a32(requestId) % AB_BUCKETS;
}

/**
 * Pick the PREFERRED (pre-availability) target for a class given the A/B bucket.
 * Challengers own contiguous bucket ranges sized by `traffic` (e.g. 0.1 ⇒ 100 buckets); the primary owns
 * the remainder. Ordering is the config order, so the mapping is fully determined by the config + bucket.
 */
function pickPreferred(binding: ClassBinding, bucket: number): { model: string; role: BindingRole } {
  let cursor = 0;
  for (const ch of binding.challengers) {
    const width = Math.round(ch.traffic * AB_BUCKETS);
    if (bucket >= cursor && bucket < cursor + width) {
      return { model: ch.model, role: "challenger" };
    }
    cursor += width;
  }
  return { model: binding.primary, role: "primary" };
}

/** Build the ordered, de-duplicated candidate chain: preferred → primary → fallback[]. */
function candidateChain(binding: ClassBinding, preferred: { model: string; role: BindingRole }): Array<{ model: string; role: BindingRole }> {
  const chain: Array<{ model: string; role: BindingRole }> = [preferred];
  // If a challenger was preferred, the primary is the next-best before the generic fallback chain.
  if (preferred.role !== "primary") chain.push({ model: binding.primary, role: "primary" });
  for (const m of binding.fallback) chain.push({ model: m, role: "fallback" });
  // De-dupe by model id, keeping the first (highest-priority) occurrence.
  const seen = new Set<string>();
  return chain.filter((c) => (seen.has(c.model) ? false : (seen.add(c.model), true)));
}

/** One entry of the boot resolution map: a referenced model and whether it resolves in this deployment. */
export interface ResolutionEntry {
  readonly model: string;
  readonly role: BindingRole;
  readonly resolves: boolean;
}

/** The boot resolution map (ADR §"Model-agnostic enforcement"): every class → its referenced models. */
export type ResolutionMap = Record<ReasoningClass, {
  readonly candidates: readonly ResolutionEntry[];
  /** True if AT LEAST ONE candidate resolves — i.e. this class can reason in this deployment. */
  readonly resolvable: boolean;
}>;

export interface ModelRouterOptions {
  /** Runtime availability check; default: every model is available (naming a not-yet-provisioned id is safe). */
  readonly isAvailable?: AvailabilityPredicate;
  /** Telemetry sink for successful resolves; default: no-op. */
  readonly telemetry?: TelemetrySink;
}

/**
 * The Model Router. Constructed over a loaded, validated RoutingConfig — the ONE place model IDs entered
 * the process. Pure with respect to its config: given the same config + requestId + availability, resolve()
 * is deterministic.
 */
export class ModelRouter {
  private readonly isAvailable: AvailabilityPredicate;
  private readonly telemetry: TelemetrySink;

  constructor(
    private readonly config: RoutingConfig,
    opts: ModelRouterOptions = {},
  ) {
    this.isAvailable = opts.isAvailable ?? (() => true);
    this.telemetry = opts.telemetry ?? (() => {});
  }

  /**
   * Resolve a reasoning class to a concrete model binding.
   * @throws UnknownReasoningClassError if the class has no binding.
   * @throws NoAvailableModelError if no candidate in the chain is available (fail-closed).
   */
  resolve(reasoningClass: string, ctx: ResolveContext): ModelBinding {
    const binding = this.bindingFor(reasoningClass);
    const cls = reasoningClass as ReasoningClass;

    const bucket = abBucket(ctx.requestId);
    const preferred = pickPreferred(binding, bucket);
    const chain = candidateChain(binding, preferred);

    for (const candidate of chain) {
      if (this.isAvailable(candidate.model)) {
        const bindingId = `${cls}:${candidate.role}:${candidate.model}`;
        this.telemetry({ class: cls, model: candidate.model, bindingId });
        return { model: candidate.model, params: binding.params, bindingId };
      }
    }
    throw new NoAvailableModelError(cls, chain.map((c) => c.model));
  }

  /**
   * The BOOT resolution map: for every class, list the referenced models (primary ∪ challengers ∪ fallback)
   * and whether each resolves under `available`. Never throws — a fully-unavailable class is reported, not
   * fatal (boot must not crash because a model is not yet provisioned).
   * @param available optional explicit availability set; falls back to the router's own predicate.
   */
  resolveAll(available?: Set<string>): ResolutionMap {
    const check: AvailabilityPredicate = available ? (m) => available.has(m) : this.isAvailable;
    const out = {} as Record<ReasoningClass, ResolutionMap[ReasoningClass]>;
    for (const cls of Object.keys(this.config.classes) as ReasoningClass[]) {
      const binding = this.config.classes[cls];
      const refs: Array<{ model: string; role: BindingRole }> = [
        { model: binding.primary, role: "primary" },
        ...binding.challengers.map((c) => ({ model: c.model, role: "challenger" as const })),
        ...binding.fallback.map((m) => ({ model: m, role: "fallback" as const })),
      ];
      const seen = new Set<string>();
      const candidates: ResolutionEntry[] = refs
        .filter((r) => (seen.has(r.model) ? false : (seen.add(r.model), true)))
        .map((r) => ({ model: r.model, role: r.role, resolves: check(r.model) }));
      out[cls] = { candidates, resolvable: candidates.some((c) => c.resolves) };
    }
    return out;
  }

  private bindingFor(reasoningClass: string): ClassBinding {
    if (!isReasoningClass(reasoningClass)) throw new UnknownReasoningClassError(reasoningClass);
    const binding = this.config.classes[reasoningClass];
    if (!binding) throw new UnknownReasoningClassError(reasoningClass);
    return binding;
  }
}
