// =============================================================================
// The OS Engine Runtime — the VENDOR→CONSUME FLIP (PLATFORM-HOME-EXTRACTION.md §1.1 / §3).
// =============================================================================
// This is the OS-owned split of rumah-admin/src/engine-admin/engine-instance.ts. That file did TWO jobs in
// one module: (a) CONSTRUCT the engine (OS) and (b) REGISTER tenant packs INVOICE_SEND_PACK/OWNER_INVOICE_PACK/…
// (TENANT). The flip separates them:
//
//   * CONSTRUCTION (here, OS):   the engine is built with ZERO tenant packs. `createOsEngineRuntime()` calls the
//                                platform bootstrap contract createCapabilityRuntime({ ..., packs: [] }). The OS
//                                boots knowing NO tenant capability — the bare-OS survival floor (§2.2 step 1:
//                                "the capability-registry returns an empty tenant set").
//   * REGISTRATION (RUNTIME API): pack registration becomes a FUNCTION a tenant calls at runtime —
//                                `registerCapabilityPacks(packs)`. A tenant (rumah-admin = cell #1, PLOS = cell
//                                #2) POSTs its capability manifest + adapter and the OS registers it into the
//                                SAME capability registry the engine already owns (fail-closed on cross-pack
//                                key conflicts, via the engine's registerPacks). The OS never imports tenant
//                                code; the tenant hands DATA (a CapabilityPack), never OS source.
//
// The goals route (POST /v1/goals) routes against the selectors DERIVED from whatever is registered. On a bare
// OS that set is EMPTY → every goal fail-closes to no-match (422), never a crash — the deleted-tenant
// degradation the invariant requires (§2.2 step 5). Registering a pack rebuilds the goals route so the newly
// registered capability becomes selectable with zero engine change.

import {
  createCapabilityRuntime,
  registerPacks,
  deregisterPacks,
  type CapabilityPack,
  type CapabilityRuntime,
} from "./engine/capability-pack.js";
import { createGoalsRoute } from "./engine/goals-route.js";
import type { EngineContext } from "./engine/engine.js";
import type { SelectableCapability } from "./engine/capability-selector.js";
import { WORKFLOW_SCOPES, type HumanPrincipalPort, type Principal } from "./engine/human-principal.js";
import type { ScopeGuard } from "./engine/workflow-route.js";
import { workflowRun, workflowStep, outbox, workflowApprovalAudit } from "./engine/schema.js";
import { db } from "./db/client.js";
import type { Hono } from "hono";

// ── The OS EngineContext: the platform db client + the ENGINE's OWN table objects (no tenant tables). ──
// The engine declares the SHAPE (EngineTables); the OS supplies its OWN drizzle client + the engine's shipped
// table objects (schema.ts). No outcomeArrived race hook is wired in M1 (that predicate is a tenant-domain
// concern — a delivery-correlation callback — and belongs to the tenant adapter, registered in M3).
export const osEngineContext: EngineContext & {
  tables: EngineContext["tables"] & { workflowApprovalAudit: typeof workflowApprovalAudit };
} = {
  db: db as unknown as EngineContext["db"],
  tables: { workflowRun, workflowStep, outbox, workflowApprovalAudit },
};

// ── M1 dev ports (auth + human gate). ──────────────────────────────────────────────────────────────
// The engine declares the PORTS; the app supplies the IMPLs. rumah-admin supplies HS256/JWT verification +
// scope minting. The OS's real auth impl (asymmetric JWKS, I2/G-B3) is EARNED-ON-PROOF at P6 and lands in
// M2/M3 — NOT pre-empted here (PLATFORM-HOME-EXTRACTION.md §3.3). For the M1 bare-boot proof the OS ships a
// DEV ScopeGuard that grants the required engine scope to a runtime principal, so the surfaces mount and the
// bare-OS battery can drive the runtime. Clearly labelled DEV: it is replaced, never shipped to prod.
const DEV_RUNTIME_PRINCIPAL: Principal = { sub: "os-runtime", role: "system", scopes: [WORKFLOW_SCOPES.runtime, WORKFLOW_SCOPES.observe] };

export const devScopeGuard: ScopeGuard = (_requiredScope: string) => async (c, next) => {
  // DEV: inject the OS runtime principal carrying the engine scopes. Real token verification is M2/M3.
  c.set("principal", DEV_RUNTIME_PRINCIPAL);
  await next();
};

export const devHumanPrincipal: HumanPrincipalPort = {
  // DEV: the human gate is NOT exercised on a bare OS (no approvals in M1). A real verified-human impl
  // (the app's token verifier) is supplied by the operator plane in M2/M3. This dev impl refuses by default
  // (fail-closed: it sets NO principal and does not call next unless a human scope is genuinely present),
  // so it can never masquerade as a real human gate.
  requireHuman: (_requiredScope?: string) => async (_c, _next) => {
    // Intentionally fail-closed: a bare OS has no human-gate resolver wired.
    return _c.json({ error: { code: "no_human_gate", message: "the bare OS has no verified-human resolver wired (M2/M3)" } }, 501);
  },
};

// ── The OS runtime handle. Holds the engine + a CURRENT goals route (rebuilt on registration). ──────
export interface OsEngineRuntime {
  runtime: CapabilityRuntime;
  /** the engine's exactly-once tick (SKIP-LOCKED). Driven by the heartbeat. */
  tick: CapabilityRuntime["tick"];
  /** the enqueue boundary. */
  enqueue: CapabilityRuntime["enqueue"];
  /** the workflow route (engine-scoped). */
  workflowRoute: Hono<{ Variables: { principal: Principal } }>;
  /** the approvals route (human-gated). */
  approvalsRoute: Hono<{ Variables: { principal: Principal } }>;
  /** THE RUNTIME REGISTRATION API — a tenant calls this to register its capabilities/adapter with the OS.
   *  Fail-closed on cross-pack key conflicts (the engine's registerPacks throws). Rebuilds the goals route so
   *  the newly registered capability is selectable. Returns the resulting registry snapshot. */
  registerCapabilityPacks(packs: CapabilityPack[]): { registeredPackIds: string[]; enqueueKeys: string[]; selectors: SelectableCapability[] };
  /** THE RUNTIME DEREGISTRATION API — remove the given packs from the OS registry (E-PH M3a). Rebuilds the goals
   *  route so the removed capabilities are no longer selectable. Proves tenant removal doesn't break the OS: the
   *  OS keeps serving with the remaining packs (I-PI survival). Returns the resulting registry snapshot. */
  deregisterCapabilityPacks(packIds: string[]): { registeredPackIds: string[]; enqueueKeys: string[]; selectors: SelectableCapability[] };
  /** the currently registered selectable capabilities (EMPTY on a bare OS). */
  selectors(): SelectableCapability[];
  /** the derived enqueue allow-list (EMPTY on a bare OS). */
  enqueueKeys(): string[];
  /** the registered pack ids (EMPTY on a bare OS — the "zero tenant packs" observable). */
  registeredPackIds(): string[];
  /** dispatch a request to the CURRENT goals route (POST /v1/goals). The server delegates here so post-boot
   *  registration affects routing without re-mounting a running server. */
  goalsFetch(req: Request): Promise<Response>;
}

/** Construct the OS engine runtime with ZERO tenant packs. This is the bare-OS engine (the flip). */
export function createOsEngineRuntime(opts?: {
  context?: typeof osEngineContext;
  humanPrincipal?: HumanPrincipalPort;
  auth?: ScopeGuard;
}): OsEngineRuntime {
  const context = opts?.context ?? osEngineContext;
  const humanPrincipal = opts?.humanPrincipal ?? devHumanPrincipal;
  const auth = opts?.auth ?? devScopeGuard;

  // THE FLIP: the single platform bootstrap call — but with packs: [] (ZERO tenant packs).
  const runtime = createCapabilityRuntime({ context, humanPrincipal, auth, packs: [] });

  // Mutable current registry snapshot + goals route (rebuilt on registration).
  const registeredIds: string[] = [];
  let currentSelectors: SelectableCapability[] = [...runtime.selectors]; // [] on a bare OS
  let currentEnqueueKeys: string[] = [...runtime.enqueueKeys]; // [] on a bare OS
  let currentGoalsRoute = runtime.goalsRoute;

  function rebuildGoalsRoute() {
    currentGoalsRoute = createGoalsRoute({
      registry: currentSelectors,
      enqueue: runtime.enqueue,
      auth,
    });
  }

  return {
    runtime,
    tick: runtime.tick,
    enqueue: runtime.enqueue,
    workflowRoute: runtime.workflowRoute,
    approvalsRoute: runtime.approvalsRoute,
    registerCapabilityPacks(packs: CapabilityPack[]) {
      // Register into the engine's OWN capability registry (fail-closed on cross-pack conflicts).
      const { enqueueKeys, selectors } = registerPacks(packs);
      for (const p of packs) if (!registeredIds.includes(p.id)) registeredIds.push(p.id);
      currentEnqueueKeys = enqueueKeys;
      currentSelectors = selectors;
      rebuildGoalsRoute();
      return { registeredPackIds: [...registeredIds], enqueueKeys: [...enqueueKeys], selectors: [...selectors] };
    },
    deregisterCapabilityPacks(packIds: string[]) {
      // Remove from the engine's OWN capability registry, then drop them from the local snapshot + rebuild routing.
      const { enqueueKeys, selectors } = deregisterPacks(packIds);
      const drop = new Set(packIds);
      for (let i = registeredIds.length - 1; i >= 0; i--) if (drop.has(registeredIds[i]!)) registeredIds.splice(i, 1);
      currentEnqueueKeys = enqueueKeys;
      currentSelectors = selectors;
      rebuildGoalsRoute();
      return { registeredPackIds: [...registeredIds], enqueueKeys: [...enqueueKeys], selectors: [...selectors] };
    },
    selectors: () => [...currentSelectors],
    enqueueKeys: () => [...currentEnqueueKeys],
    registeredPackIds: () => [...registeredIds],
    goalsFetch: (req: Request) => Promise.resolve(currentGoalsRoute.fetch(req)),
  };
}
