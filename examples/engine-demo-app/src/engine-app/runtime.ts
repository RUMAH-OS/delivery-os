// The demo app's Workflow Engine INSTANCE — the port adapters + the ONE capability-runtime bootstrap.
// This is the EXACT shape of Admin's src/engine-admin/engine-instance.ts, proving a 2nd app installs via the
// IDENTICAL platform contract: its OWN EngineContext (db + tables) + its OWN HumanPrincipalPort + its OWN auth
// ScopeGuard + its OWN CapabilityPack[], composed by the SINGLE uniform call createCapabilityRuntime.
//
// The app holds NO engine source — it imports ONLY the vendored engine barrel (.claude/os/engine/index.js).

import { db } from "./db.js";
import { workflowRun, workflowStep, outbox, workflowApprovalAudit } from "./tables.js";
import { auth, humanPrincipalPort } from "./ports.js";
import {
  createCapabilityRuntime,
  type EngineContext,
  type CapabilityPack,
} from "../../.claude/os/engine/index.js";
import { DEMO_PING_PACK } from "../demo-pack/demo-ping.js";

// The EngineContext adapter: the app's db client + its run/step/outbox/approval-audit table objects. The engine
// declares the SHAPE (EngineTables); the app passes its OWN Drizzle tables. (No outcomeArrived hook: the demo
// has no await-callback step, so the engine's safe default — always block — is never reached.)
export const engineContext: EngineContext & {
  tables: EngineContext["tables"] & { workflowApprovalAudit: typeof workflowApprovalAudit };
} = {
  db: db as unknown as EngineContext["db"],
  tables: { workflowRun, workflowStep, outbox, workflowApprovalAudit },
};

// The app's installed capability packs — the single declared list (the demo has exactly one).
export const demoPacks: CapabilityPack[] = [DEMO_PING_PACK];

// The ONE bootstrap call: compose the app's ports + packs into a ready runtime via the platform contract.
const runtime = createCapabilityRuntime({
  context: engineContext,
  humanPrincipal: humanPrincipalPort,
  auth,
  packs: demoPacks,
});

export const engine = runtime.engine;
export const enqueue = runtime.enqueue;
export const tick = runtime.tick;
export const workflowRoute = runtime.workflowRoute;
export const approvalsRoute = runtime.approvalsRoute;
export const enqueueKeys = runtime.enqueueKeys;
