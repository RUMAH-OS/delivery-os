// =============================================================================
// infrastructure/execution-node/bootstrap/runtime-tick.mjs  —  the RUNTIME_TICK_ENTRY.
// -----------------------------------------------------------------------------
// COMPOSITION-ROOT module (architecture.config.json layer "composition" — the Clean-Architecture
// `main`, the outermost ring). It adapts the Core governance runtime's drain into the minimal
// `RuntimeTick` seam the WorkerDaemon depends on (worker-daemon.ts `RuntimeTick`). The daemon never
// learns what the runtime IS — it holds only this seam; the wiring lives HERE, in the composition root.
//
// Why this is its own entry: the worker plist injects DOS_RUNTIME_TICK = this file's path so the
// daemon body and the drain it advances are versioned + supervised as one unit (NEO-EXEC-07 §5.1).
//
// This module imports NOTHING gated — it receives the already-wired `runtime` + provider `registry`
// from worker-entry.mjs (which is the only place Core and the adapters meet). It is pure glue.
// =============================================================================

/**
 * createRuntimeTick — build the injected `RuntimeTick` for the WorkerDaemon.
 *
 * @param {object} deps
 * @param {object} deps.runtime   the Core GovernanceRuntime (createGovernanceRuntime(...) result).
 * @param {Array<object>} deps.registry  the ExecutionProviderPort registry the selector reads.
 * @param {(runtime: object, registry: Array<object>) => Promise<{consumerCursor?: string, gsPostedAt?: string, advanced: boolean}>} [deps.drainStep]
 *        the single durable-bus drain step. DEFAULT = a conservative quiescent step (advanced:false)
 *        until a consumer injects the real Supabase-bus drain — honest: a no-op tick still emits a
 *        heartbeat, so liveness is provable before the drain protocol is wired, and `advanced:false`
 *        never falsely claims progress (alive != moving).
 * @returns {{ tick: () => Promise<{consumerCursor?: string, gsPostedAt?: string, advanced: boolean}> }}
 */
export function createRuntimeTick({ runtime, registry, drainStep } = {}) {
  if (!runtime) throw new Error("runtime-tick: a Core runtime is required (the composition root wires it).");
  const drain =
    typeof drainStep === "function"
      ? drainStep
      : // conservative default: a quiescent tick. The registry being empty is the null-registry no-op
        // case; otherwise a real drain is the consumer's injected step. We NEVER report advanced:true
        // without an observed cursor move — staleness must reach the off-node dead-man honestly.
        async (_runtime, reg) => ({ advanced: false, ...(Array.isArray(reg) && reg.length ? {} : {}) });

  return {
    async tick() {
      const result = await drain(runtime, registry ?? []);
      return {
        consumerCursor: result?.consumerCursor,
        gsPostedAt: result?.gsPostedAt,
        advanced: Boolean(result?.advanced),
      };
    },
  };
}

export default createRuntimeTick;
