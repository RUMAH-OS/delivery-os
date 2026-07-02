// =============================================================================
// BOOT-TIME REASONING ORGAN FACTORY — the enforce-flip ACTIVATION (PR #55 built the seam + flag + driver; this
// constructs the REAL bound organs the boot injects into the reconciler sweep).
// =============================================================================
// `buildBootReasoning()` assembles the production `ReasoningSweepDeps` the reconciler-loop consumes when the
// PLATFORM_REASONING_DRIVES_GOALS flag is ON. It CONSTRUCTS the live reasoning stack — model router (config-only,
// never a hard-coded model id) → the REAL headless Claude client (ClaudeCliLlm) → the ReasoningPort → the
// context-aware port → the default organs — and wraps them into the deps shape the sweep double-gates on.
//
// MODEL-AGNOSTIC (ADR-reasoning-model-routing.md): this factory NEVER names a model. The router resolves every
// reasoning CLASS to a concrete model from reasoning-routing.config.json alone; ClaudeCliLlm invokes whatever id
// the router hands it (CLI default when none). If no model / no `claude` binary is available on a given node, the
// per-call invocation fails closed (ReasoningInvocationError) exactly like any organ step failure — and on a BARE
// OS with zero goals the organs are NEVER invoked (the sweep loops over an empty portfolio), so no model is ever
// spawned by merely constructing this stack.
//
// FOUNDER-ACTION SINK: the founder-action DRAFT the goal-driver emits alongside a pre-flight HALT is (a) LOGGED
// (`[founder-action] …`, the honest interim console line) AND (b) PERSISTED as an append-only `founder_action`
// event on the platform event stream (0057) — the OS side of the founder-action → Slack loop, drainable via
// GET /v1/events. Persistence is FAIL-SOFT: a store failure is logged and swallowed so a reconciler sweep never
// crashes on a persistence fault (surfacing the draft must never break the sole-mutator loop).

import { ClaudeCliLlm } from "../core/llm.js";
import { appendEvent } from "../events/event-store.js";
import { loadRoutingConfig } from "./routing-config.js";
import { ModelRouter } from "./model-router.js";
import { ReasoningPort } from "./reasoning-port.js";
import { ContextAwareReasoningPort } from "./context/context-aware-port.js";
import { EMPTY_KNOWLEDGE_PORT, type ContextSources } from "./context/context-assembler.js";
import { goalContractInvestigateSource } from "./context/sources/goal-contract-source.js";
import { runtimeInvestigateSource } from "./context/sources/runtime-source.js";
import { defaultReasoningOrgans } from "./pipeline/reasoning-pipeline.js";
import type { ResolveContext } from "./model-router.js";
import type { ReasoningSweepDeps } from "../reconciler-loop.js";
import type { FounderActionDraft } from "./goal-driver.js";
import { reasoningDrivesGoals } from "../env.js";
import { randomUUID } from "node:crypto";

/** LOG the drafted pre-flight escalation. Honest + cited — it surfaces the goal, the halt reason, and the organ
 *  trace spine, never drops the draft. Always runs (the durable append is layered ON TOP, never instead of it). */
function logFounderAction(draft: FounderActionDraft): void {
  console.log(
    `[founder-action] goal=${draft.goalId} kind=${draft.kind} reason=${draft.reason} — ${draft.summary}` +
      (draft.blockers.length ? ` | blockers: ${draft.blockers.map((b) => `${b.claim} (${b.source})`).join("; ")}` : "") +
      (draft.traceStages.length ? ` | trace: ${draft.traceStages.join(" → ")}` : ""),
  );
}

/** Build the founder-action SINK the reconciler sweep invokes on a pre-flight HALT. It (a) STILL logs the draft
 *  AND (b) PERSISTS a well-formed `founder_action` event on the platform event stream (drainable by the Slack
 *  adapter via GET /v1/events). FAIL-SOFT: a persistence failure is logged and swallowed so a store fault can
 *  never crash the sweep (the sole-mutator loop keeps running). The `append` fn is injectable for tests; it
 *  defaults to the real DB-backed appendEvent. */
export function makeFounderActionSink(
  append: typeof appendEvent = appendEvent,
): (draft: FounderActionDraft) => Promise<void> {
  return async (draft) => {
    logFounderAction(draft); // (a) surface the draft — always, even if the durable append below fails.
    try {
      // (b) durable, drainable record. payload mirrors the draft's re-checkable fields (trace = the organ spine).
      await append({
        type: "founder_action",
        aggregate: { type: "goal", id: draft.goalId },
        payload: {
          kind: draft.kind,
          reason: draft.reason,
          summary: draft.summary,
          blockers: draft.blockers,
          trace: draft.traceStages,
        },
      });
    } catch (e) {
      // FAIL-SOFT: a persistence fault must not break the reconciler sweep — log loud, swallow, keep going.
      console.error(
        `[founder-action] persist FAILED (fail-soft — sweep continues) goal=${draft.goalId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };
}

/**
 * Construct the REAL bound reasoning organs + the resolve context + the founder-action sink the reconciler sweep
 * drives goals through when the enforce-flip flag is ON. Purely a CONSTRUCTOR — it spawns no model and touches no
 * DB; the returned organs are invoked lazily by the sweep, and only for a goal that actually exists.
 *
 *   router  ← ModelRouter(loadRoutingConfig())   — class → model, config-only, model-agnostic
 *   llm     ← ClaudeCliLlm()                      — the REAL headless `claude -p` client (CLI default model)
 *   port    ← ReasoningPort(router, llm)          — resolves + invokes (serves CLASSIFY via `reason`)
 *   ctxPort ← ContextAwareReasoningPort(port, …)  — assembles context first (REACHABILITY/PLAN/NARRATE/VERIFY)
 *   organs  ← defaultReasoningOrgans({ reasoner: port, contextReasoner: ctxPort })
 */
export function buildBootReasoning(): ReasoningSweepDeps {
  // The live model stack — router (config-only) + the real headless Claude client. No model id is named here.
  const router = new ModelRouter(loadRoutingConfig());
  const llm = new ClaudeCliLlm();
  const port = new ReasoningPort(router, llm);

  // The C0-INVESTIGATE sources over the LIVE truth domains (goal-contract + OS runtime). Knowledge-retrieve is
  // the honest EMPTY corpus until a corpus is wired (a later slice) — the investigate half is real at N=1.
  const sources: ContextSources = {
    knowledge: EMPTY_KNOWLEDGE_PORT,
    investigators: [goalContractInvestigateSource(), runtimeInvestigateSource()],
  };
  const contextPort = new ContextAwareReasoningPort(port, sources);

  // The bound organs — CLASSIFY reasons via the base port; the context-requiring classes via the context port.
  const organs = defaultReasoningOrgans({ reasoner: port, contextReasoner: contextPort });

  // A stable per-boot requestId seeds the router's DETERMINISTIC A/B hash for this process's lifetime (a real
  // id; Math.random/Date.now would also be fine in app code, but a UUID is unambiguous and collision-free).
  const ctx: ResolveContext = { requestId: `boot:${randomUUID()}` };

  return { organs, ctx, onFounderAction: makeFounderActionSink() };
}

/**
 * THE BOOT GATE (the on-switch): return the real bound reasoning deps IFF the enforce-flip flag is ON, else
 * `undefined` — so the boot constructs NOTHING and the sweep stays inert SHADOW when the flag is off. This is the
 * single decision the boot makes; the sweep's own double-gate (reasoningDrivesGoals() && reasoning !== undefined)
 * is the authority, so this can never accidentally arm a sweep the flag hasn't also enabled.
 */
export function armedReasoning(): ReasoningSweepDeps | undefined {
  return reasoningDrivesGoals() ? buildBootReasoning() : undefined;
}
