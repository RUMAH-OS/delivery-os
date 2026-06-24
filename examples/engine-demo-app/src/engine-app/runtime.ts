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
  createAgentRunner,
  type EngineContext,
  type CapabilityPack,
  type AgentExecutor,
  type AgentRunnerHandle,
} from "../../.claude/os/engine/index.js";
import { DEMO_PING_PACK } from "../demo-pack/demo-ping.js";
import { DEMO_AGENT_PACK, DEMO_AGENT_ID, DEMO_AGENT_SKILL, DEMO_AGENT_RESULT_MARKER } from "../demo-pack/demo-agent.js";

// The EngineContext adapter: the app's db client + its run/step/outbox/approval-audit table objects. The engine
// declares the SHAPE (EngineTables); the app passes its OWN Drizzle tables.
//
// outcomeArrived (the callback-before-block race hook, R1/N1): the demo has NO app-side outcome store — an
// `agent-result` block is resolved by the AGENT RUNNER, never by a racing app callback. So the hook always
// reports "not yet arrived" (return false), i.e. the engine ALWAYS blocks the agent-result step and waits for
// the runner to resolve it. This is functionally the engine's safe default (an absent hook always blocks); it
// is wired explicitly so the seam is demonstrably present (and a real app could plug its own outcome table in).
export const engineContext: EngineContext & {
  tables: EngineContext["tables"] & { workflowApprovalAudit: typeof workflowApprovalAudit };
} = {
  db: db as unknown as EngineContext["db"],
  tables: { workflowRun, workflowStep, outbox, workflowApprovalAudit },
  outcomeArrived: async () => false, // no app-side outcome store — the runner resolves agent-result blocks.
};

// The app's installed capability packs — the single declared list (demo-ping + the new demo-agent chain).
export const demoPacks: CapabilityPack[] = [DEMO_PING_PACK, DEMO_AGENT_PACK];

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

// ── the AGENT RUNNER (C2 off-prod proof) — the ACTIVE drain side that runs agents. ────────────────────────
// G9: the engine only EMITS the agent task + BLOCKS the step. The RUNNER claims the blocked agent-result step
// (SKIP-LOCKED), resolves its requirement to exactly one registered agent, runs THAT agent's executor, and
// completes the step (recording the resolved agent_id). The engine NEVER runs the executor.
//
// THE SIMULATED EXECUTOR (C2 scope): a deterministic in-process stand-in for a real out-of-process agent. It
// returns ok + a PII-free result stamped with DEMO_AGENT_RESULT_MARKER (the verifier confirms it survived the
// record path). A `claude -p` port is OUT of scope — this is the simulated proof only.
export const simulatedAgentExecutor: AgentExecutor = async (task) => {
  return {
    ok: true,
    result: { producedBy: DEMO_AGENT_RESULT_MARKER, value: "ok", echo: task.task },
  };
};

// the runner the demo drives directly (runOnce). One agent (demo-agent) serving DEMO_AGENT_SKILL; the
// agent-result step's `agent:{ skill }` requirement resolves to it deterministically (selectAgentFor).
export const agentRunner: AgentRunnerHandle = createAgentRunner({
  context: engineContext,
  agents: [{ id: DEMO_AGENT_ID, skills: [DEMO_AGENT_SKILL], executor: simulatedAgentExecutor }],
  runnerId: "demo-runner",
});
