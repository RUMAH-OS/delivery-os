// The demo app's OWN agent CapabilityPack — the FIRST off-prod proof of the engine's agent → verify → record
// chain (C2). It is declared against the SAME app-agnostic contract (CapabilityPack) as demo-ping; the only new
// surface it exercises is the await-callback `agent-result` source + the agent runner (a SIMULATED executor).
//
// THE CHAIN this pack drives (the act→verify shape, extended with an agent in the middle):
//   seq 0  demo-agent.request       (effect: emit-only)    — the ACT step. Emits `agent.task_requested` (the
//                                                            work announcement) + stages the task spec. This is
//                                                            the act that asks for an agent to do the work.
//   seq 1  demo-agent.await-result  (effect: await-callback,— the AGENT-RESULT step. Its handler honors the
//          awaitSource:'agent-result', agent:{skill})        await-callback handler CONTRACT: it emits the
//                                                            dispatch REQUEST event + returns the correlation
//                                                            key (awaitEventId). The engine (engine.ts:300-301
//                                                            runAwaitCallbackStep) then BLOCKS this step on the
//                                                            'agent-result' source. The engine ONLY emits + blocks
//                                                            — it NEVER runs the executor (G9). The agent runner
//                                                            (agent-runner.ts) claims this blocked step via
//                                                            SKIP-LOCKED, runs the resolved agent's executor, and
//                                                            completes it via the SAME completer (awaitSource
//                                                            'agent-result'), recording the resolved `agent_id`
//                                                            + the agent's result onto THIS step.
//   seq 2  demo-agent.verify        (handler engine.verify) — the VERIFY step. A T1 verifier reads the agent's
//                                                            RECORDED result (seq-1's result row + resolved
//                                                            agent_id) and returns pass when the agent produced a
//                                                            well-formed result attributed to the resolved agent.
//                                                            stopCondition (verdict-equals pass) -> loop stops ->
//                                                            run completes.
//
// G9 OWNERSHIP BOUNDARY: the engine materializes the agent requirement at plan time (engine.ts:169-182), emits
// the request, and blocks. The RUNNER — never the engine — runs the executor. This pack declares WHICH agent the
// step needs (agent:{ skill:"demo-skill" }); the runtime supplies the matching agent + its SIMULATED executor.

import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { CapabilityPack } from "../../.claude/os/engine/index.js";
import { workflowStep } from "../engine-app/tables.js";

// the 0-indexed seq of the agent-result await-callback step (the step the runner resolves + records agent_id on).
// The verifier reads THIS step's recorded result to confirm the agent → verify → record chain closed.
export const AGENT_RESULT_SEQ = 1 as const;

// the skill the agent-result step REQUIRES (materialized onto the step's agent_requirement at plan time). The
// runtime registers exactly one agent that serves this skill; selectAgentFor resolves it deterministically.
export const DEMO_AGENT_SKILL = "demo-skill" as const;

// the stable identity of the agent that serves DEMO_AGENT_SKILL (recorded onto the step's resolved agent_id by
// the runner). The verifier asserts the recorded agent_id matches — proving the RESOLUTION was recorded, not faked.
export const DEMO_AGENT_ID = "demo-agent" as const;

// a PII-free marker the simulated executor stamps onto its result — the verifier confirms it survived the
// runner's record path (executor result -> completer -> step.result). A real executor would stamp a real artifact ref.
export const DEMO_AGENT_RESULT_MARKER = "demo-agent-sim" as const;

export const DEMO_AGENT_PACK: CapabilityPack = {
  id: "demo-agent",

  definitions: [
    {
      key: "demo-agent",
      description:
        "C2 off-prod proof: an ACT requests an agent task, the engine BLOCKS on the agent-result, the runner runs " +
        "a SIMULATED executor + records the resolved agent_id, then a T1 verifier confirms the recorded result. Green.",
      steps: [
        // seq 0 — the ACT step (emit-only). Announces the work via `agent.task_requested` + stages the task spec
        // from the run's per-run input. (The actual dispatch REQUEST the runner fulfills is emitted by seq 1, the
        // await-callback step, because the engine fuses emit-request + block into the one await-callback step.)
        {
          stepType: "demo.agent-request",
          owner: "engine-demo-app",
          effect: "emit-only",
          maxAttempts: 1,
          handler: "demo-agent.request",
        },
        // seq 1 — the AGENT-RESULT step (await-callback). Its handler emits the dispatch request + returns the
        // correlation key; the engine blocks it on the 'agent-result' source. `agent:{ skill }` is materialized
        // onto agent_requirement (engine.ts:169-182) so the runner resolves it to exactly one agent (fail-closed).
        {
          stepType: "demo.agent-await-result",
          owner: "engine-demo-app",
          effect: "await-callback",
          awaitSource: "agent-result",
          agent: { skill: DEMO_AGENT_SKILL },
          maxAttempts: 2, // the runner's per-step executor cap (adversarial: a failing executor trips it -> run failed)
          handler: "demo-agent.await-result",
        },
        // seq 2 — the VERIFY step. Reads the agent's RECORDED result (seq-1's result + resolved agent_id) and
        // confirms the chain closed. retryBackToSeq points at the agent-result step (the candidate carries its
        // runId); on a clean pass the loop stops immediately and the run completes. No gateSeq: a T1 verifier is
        // gating-exempt and the proof passes first try, so the conditional cap-trip human gate is never reached.
        {
          stepType: "demo.agent-verify",
          owner: "engine-demo-app",
          effect: "emit-only",
          maxAttempts: 1,
          handler: "engine.verify",
          verifierId: "demo.agent-result-verifier",
          stopCondition: { kind: "verdict-equals", value: "pass" },
          retryBackToSeq: AGENT_RESULT_SEQ,
        },
      ],
    },
  ],

  handlers: [
    {
      // seq 0 act handler (emit-only): announces the agent task + stages the task spec the agent will serve.
      key: "demo-agent.request",
      run: async (ctx) => {
        const task = { goal: "produce-demo-artifact", forRun: ctx.runId };
        await ctx.emit("agent.task_requested", { runId: ctx.runId, seq: ctx.seq, skill: DEMO_AGENT_SKILL, task });
        return { ok: true, result: { requested: true }, checkpoint: { requested: true, task } };
      },
    },
    {
      // seq 1 await-callback handler (the agent-result CONTRACT): emit the dispatch REQUEST in-txn + return the
      // correlation key (awaitEventId). `ctx.emit` returns void, so the handler MINTS its own correlation uuid
      // (the awaiting_event_id the runner/completer match on) and carries it in the request payload. The engine
      // then sets it on the blocking step + transitions the step/run to blocked. The runner resolves the block.
      key: "demo-agent.await-result",
      run: async (ctx) => {
        const correlationId = randomUUID(); // the awaiting_event_id (S2 'agent-result' correlation key)
        const task = (ctx.checkpoint as { task?: unknown })?.task ?? { goal: "produce-demo-artifact" };
        await ctx.emit("agent.task.dispatched", {
          runId: ctx.runId,
          seq: ctx.seq,
          correlationId,
          skill: DEMO_AGENT_SKILL,
          task,
        });
        return {
          ok: true,
          // result/checkpoint are what the runner claims as the OPAQUE task descriptor (claimAgentTask reads
          // result ?? checkpoint). checkpoint.runId lets the verifier re-find THIS step's recorded result by run.
          result: { dispatched: true, task },
          checkpoint: { runId: ctx.runId, awaiting: true, task },
          awaitEventId: correlationId,
        };
      },
    },
  ],

  verifiers: [
    {
      // T1 deterministic verifier over the agent's RECORDED result. The engine passes the agent-result step's
      // block-time checkpoint as the opaque `candidate` (it carries runId). The verifier re-reads THAT step's
      // committed result + resolved agent_id (written by the runner via the completer) and confirms: the agent
      // produced a well-formed result AND the resolved agent_id was recorded. This is "verify over the agent's
      // recorded result" — the verdict gates the loop to completion.
      id: "demo.agent-result-verifier",
      verify: async (input) => {
        const runId = (input.candidate as { runId?: string }).runId;
        if (!runId) return { verdict: "fail", reasons: ["no_run_ref_in_candidate"] };

        // the verifier owns its read of the recorded result (tx is the engine's txn handle). It scopes by runId +
        // the agent-result seq, so concurrent runs never cross-contaminate (each verifies its OWN agent result).
        const tx = input.tx as { select: (cols: unknown) => any };
        const rows: Array<{ result: Record<string, unknown> | null; agentId: string | null }> = await tx
          .select({ result: workflowStep.result, agentId: workflowStep.agentId })
          .from(workflowStep)
          .where(and(eq(workflowStep.runId, runId), eq(workflowStep.seq, AGENT_RESULT_SEQ)))
          .limit(1);

        const row = rows[0];
        if (!row) return { verdict: "fail", reasons: ["agent_result_step_missing"] };

        const result = row.result ?? null;
        const producedMarker = result && (result as { producedBy?: unknown }).producedBy === DEMO_AGENT_RESULT_MARKER;
        const agentRecorded = row.agentId === DEMO_AGENT_ID;

        if (producedMarker && agentRecorded) {
          return { verdict: "pass", reasons: ["agent_result_recorded", "agent_id_resolved"] };
        }
        return {
          verdict: "fail",
          reasons: [
            ...(producedMarker ? [] : ["agent_result_marker_missing"]),
            ...(agentRecorded ? [] : ["agent_id_not_recorded"]),
          ],
        };
      },
    },
  ],
};
