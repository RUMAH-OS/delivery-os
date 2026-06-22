// Workflow Engine — the GENERIC Capability-Pack contract (the app-agnostic install seam).
// §11 — Delivery-OS-as-installable-platform (step 2). A consuming app is an INSTALLED CAPABILITY PACK: it
// REGISTERS its workflow content into the engine the SAME way every other app does — no bespoke per-app
// wiring, no N hand-written register*() side-effect calls. This module is the ONE uniform contract.
//
// OWNERSHIP BOUNDARY: this is GENERIC mechanism only. It carries ZERO domain knowledge (no invoice/agent/app
// concepts) — grep-clean of domain terms, exactly like the rest of the engine. An app declares its content as
// a `CapabilityPack[]` (definitions/verifiers/handlers) and the engine composes a ready runtime from it.
//
// THE CONTRACT (what a consuming app uses — Admin is the worked example, a 2nd app uses the IDENTICAL surface):
//   1. Declare each capability as a `CapabilityPack` ({ id, definitions?, verifiers?, handlers? }).
//   2. `createCapabilityRuntime({ context, humanPrincipal, packs, auth })` — the SINGLE bootstrap call. It
//      registers every pack (fail-closed on key/id conflicts across packs), builds the engine via createEngine,
//      pre-wires the workflow + approvals route factories, and DERIVES enqueueKeys from the registered
//      definitions (the app never hand-maintains that list). Returns { enqueue, tick, workflowRoute,
//      approvalsRoute, enqueueKeys }.
//   3. (Lower-level) `registerPacks(packs)` registers content without building a runtime — for callers that
//      already own their own engine/route wiring. createCapabilityRuntime calls it internally.
//
// IDEMPOTENCY + FAIL-CLOSED: registering the SAME pack id twice is a no-op (no dup work, no throw) — so an
// import-side-effect path and an explicit bootstrap call compose safely. But two DISTINCT packs that claim
// the SAME definition key, verifier id, or handler key is a programming error: registerPacks THROWS a clear
// CapabilityConflictError (fail-closed — a silent last-writer-wins overwrite would mask a collision).

import { registerDefinition, getDefinition, type WorkflowDefinition } from "./definitions.js";
import { registerVerifier, getVerifier, type Verifier } from "./verifiers.js";
import { registerHandler, type Handler } from "./handlers.js";
import { createEngine, type EngineContext, type Engine } from "./engine.js";
import { createWorkflowRoute, type ScopeGuard } from "./workflow-route.js";
import { createApprovalsRoute } from "./approvals-route.js";
import type { HumanPrincipalPort, Principal } from "./human-principal.js";
import type { Hono } from "hono";

// ── A handler entry: the registered executor key + its function. (The definition step's `handler` field
// resolves to this key.) Kept as a {key, run} list so a pack is a single self-describing object. ──
export interface PackHandler {
  key: string;
  run: Handler;
}

// ── The CapabilityPack — the declarative, app-agnostic unit an app installs. ──────────────────────
// `id` is the pack's stable identifier (also the natural link to a *.capability.json manifest id). All
// content arrays are OPTIONAL: a pack may carry only definitions, only handlers, etc.
export interface CapabilityPack {
  id: string;
  definitions?: WorkflowDefinition[];
  verifiers?: { id: string; verify: Verifier }[];
  handlers?: PackHandler[];
}

// FAIL-CLOSED conflict signal: two DISTINCT packs registered the same definition key / verifier id / handler
// key. The engine refuses to silently overwrite (that would mask a real collision between installed packs).
export class CapabilityConflictError extends Error {
  constructor(kind: "definition" | "verifier" | "handler", key: string, packId: string) {
    super(`capability conflict: ${kind} "${key}" registered by pack "${packId}" is already registered by another pack`);
    this.name = "CapabilityConflictError";
  }
}

// ── registerPacks — the uniform registration. Idempotent per pack id; fail-closed on cross-pack conflicts. ──
// Re-calling with the same pack id is a no-op (so an import side-effect and an explicit bootstrap compose).
// Returns the union of all registered definition keys (the derived enqueue allow-list).
const REGISTERED_PACK_IDS = new Set<string>();
// owner index: which pack owns each registered key/id (so a re-register by the SAME pack is idempotent and a
// register by a DIFFERENT pack is a conflict). Generic — these are opaque engine keys, never domain data.
const DEFINITION_OWNER = new Map<string, string>();
const VERIFIER_OWNER = new Map<string, string>();
const HANDLER_OWNER = new Map<string, string>();

export function registerPacks(packs: CapabilityPack[]): { enqueueKeys: string[] } {
  for (const pack of packs) {
    if (REGISTERED_PACK_IDS.has(pack.id)) continue; // idempotent: this pack is already installed.

    for (const def of pack.definitions ?? []) {
      const owner = DEFINITION_OWNER.get(def.key);
      if (owner && owner !== pack.id) throw new CapabilityConflictError("definition", def.key, pack.id);
      DEFINITION_OWNER.set(def.key, pack.id);
      registerDefinition(def);
    }
    for (const v of pack.verifiers ?? []) {
      const owner = VERIFIER_OWNER.get(v.id);
      if (owner && owner !== pack.id) throw new CapabilityConflictError("verifier", v.id, pack.id);
      VERIFIER_OWNER.set(v.id, pack.id);
      registerVerifier(v.id, v.verify);
    }
    for (const h of pack.handlers ?? []) {
      const owner = HANDLER_OWNER.get(h.key);
      if (owner && owner !== pack.id) throw new CapabilityConflictError("handler", h.key, pack.id);
      HANDLER_OWNER.set(h.key, pack.id);
      registerHandler(h.key, h.run);
    }
    REGISTERED_PACK_IDS.add(pack.id);
  }
  return { enqueueKeys: [...DEFINITION_OWNER.keys()] };
}

// ── The bootstrap surface a consuming app receives. The ONE handle an app holds after installation. ──
export interface CapabilityRuntime {
  engine: Engine;
  enqueue: Engine["enqueue"];
  tick: Engine["tick"];
  workflowRoute: Hono<{ Variables: { principal: Principal } }>;
  approvalsRoute: Hono<{ Variables: { principal: Principal } }>;
  enqueueKeys: string[];
}

export interface CapabilityRuntimeContext {
  // the app's EngineContext (its db client + run/step/outbox tables + optional race hook). For the approvals
  // route the tables must also carry workflowApprovalAudit (the engine's approvals-route declares that shape).
  context: EngineContext & { tables: EngineContext["tables"] & { workflowApprovalAudit: unknown } };
  // the app's HumanPrincipalPort impl (the verified-human gate on the approvals route).
  humanPrincipal: HumanPrincipalPort;
  // the app's auth ScopeGuard FACTORY (maps the app's verifier/scope-grants onto the engine's workflow:* scopes).
  auth: ScopeGuard;
  // the app's installed capability packs (definitions/verifiers/handlers). Registered uniformly.
  packs: CapabilityPack[];
  // OPTIONAL: the scope the human gate requires (default workflow:admin — see approvals-route).
  approvalsScope?: string;
}

// ── createCapabilityRuntime — the SINGLE bootstrap an app makes. Composes ports + packs into a ready engine. ──
// It (1) registers the packs uniformly (fail-closed on conflict), (2) builds the engine, (3) pre-wires both
// route factories, and (4) DERIVES enqueueKeys from the registered definitions — the app hand-maintains nothing.
export function createCapabilityRuntime(rc: CapabilityRuntimeContext): CapabilityRuntime {
  const { enqueueKeys } = registerPacks(rc.packs);
  const engine = createEngine(rc.context);

  const workflowRoute = createWorkflowRoute({
    db: rc.context.db,
    tables: rc.context.tables,
    engine,
    auth: rc.auth,
    enqueueKeys, // DERIVED from the registered pack definitions — not a hand-maintained list.
  });

  const approvalsRoute = createApprovalsRoute({
    db: rc.context.db,
    tables: rc.context.tables as EngineContext["tables"] & { workflowApprovalAudit: any },
    humanPrincipal: rc.humanPrincipal,
    requiredScope: rc.approvalsScope,
  });

  return { engine, enqueue: engine.enqueue, tick: engine.tick, workflowRoute, approvalsRoute, enqueueKeys };
}

// re-export the registry readers a pack author may want for a self-check (purely generic).
export { getDefinition, getVerifier };
