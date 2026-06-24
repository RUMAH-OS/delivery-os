// THE C2 OFF-PROD PROOF run script — the FIRST end-to-end demonstration of the engine's agent → verify → record
// chain in a genuinely SEPARATE app, with a SIMULATED executor. It drives ONE workflow (`demo-agent`) through the
// INSTALLED engine + the agent runner, GREEN, and then proves two FAIL-CLOSED adversarial cases.
//
// G9 (the ownership boundary under test): the ENGINE only EMITS the agent task + BLOCKS the step. The RUNNER —
// never the engine — claims the blocked agent-result step (SKIP-LOCKED), runs the agent's executor, and completes
// it (recording the resolved agent_id). The verify step then independently checks the agent's RECORDED result.
//
// HAPPY PATH:    migrate -> enqueue('demo-agent') -> tick until seq-1 BLOCKS on agent-result ->
//                agentRunner.runOnce() (claim + simulated executor + complete) -> tick runs engine.verify ->
//                ASSERT GREEN: run completed, seq-1 agent_id recorded, verify verdict pass, outbox agent.completed.
// ADVERSARIAL 1: a FAILING executor past the step cap -> run terminal `failed` (NEVER falsely completed).
// ADVERSARIAL 2: an agent-result requirement with NO matching agent -> `unrouted` terminal (fail-closed).
//
// Imports ONLY the app's own code + the vendored engine. ZERO rumah-admin imports.

import { eq, asc } from "drizzle-orm";
import { db, sql } from "./src/engine-app/db.js";
import { workflowRun, workflowStep, outbox } from "./src/engine-app/tables.js";
import { enqueue, tick, enqueueKeys, agentRunner, engineContext } from "./src/engine-app/runtime.js";
import {
  createAgentRunner,
  type AgentExecutor,
  type AgentRunnerHandle,
  type RunOnceReport,
} from "./.claude/os/engine/index.js";
import { DEMO_AGENT_ID, DEMO_AGENT_SKILL, AGENT_RESULT_SEQ } from "./src/demo-pack/demo-agent.js";
import { migrate } from "./scripts/migrate.js";

function line() { console.log("─".repeat(78)); }

type RunRow = { state: string };

async function runState(runId: string): Promise<string | undefined> {
  const [run] = await db.select({ state: workflowRun.state }).from(workflowRun).where(eq(workflowRun.id, runId)).limit(1);
  return (run as RunRow | undefined)?.state;
}

// drive tick()s until the run reaches one of `targetStates`, or no tick advances + the run is terminal. Prints
// each advancing transition. Returns the final run state.
async function tickUntil(runId: string, targetStates: string[], label: string, max = 30): Promise<string | undefined> {
  for (let i = 0; i < max; i++) {
    const state = await runState(runId);
    if (state && targetStates.includes(state)) return state;
    const r = await tick();
    if (r.advanced) console.log(`    [${label}] tick ${i}: ${r.from ?? "-"} -> ${r.to ?? "-"}  (${r.detail ?? ""})`);
    const after = await runState(runId);
    if (after && ["completed", "failed", "recovered"].includes(after) && !r.advanced) return after;
    if (!r.advanced && (!after || !targetStates.includes(after))) {
      // no progress and not at a target: one more probe, then give up (prevents a silent infinite loop).
      const probe = await tick();
      if (!probe.advanced) return after;
    }
  }
  return await runState(runId);
}

type StepRow = { seq: number; handler: string; state: string; result: Record<string, unknown> | null; verdict: Record<string, unknown> | null; agentId: string | null; checkpoint: Record<string, unknown> | null };

async function stepRows(runId: string): Promise<StepRow[]> {
  const rows = await db
    .select({ seq: workflowStep.seq, handler: workflowStep.handler, state: workflowStep.state, result: workflowStep.result, verdict: workflowStep.verdict, agentId: workflowStep.agentId, checkpoint: workflowStep.checkpoint })
    .from(workflowStep).where(eq(workflowStep.runId, runId)).orderBy(asc(workflowStep.seq));
  return rows as unknown as StepRow[];
}

async function outboxTypes(runId: string): Promise<string[]> {
  const events = await db.select({ type: outbox.type }).from(outbox).where(eq(outbox.aggregateId, runId)).orderBy(asc(outbox.createdAt));
  return events.map((e) => (e as { type: string }).type);
}

function assert(label: string, ok: boolean, got?: string): boolean {
  console.log(`ASSERT ${label.padEnd(46)} -> ${ok ? "PASS" : "FAIL"}${got !== undefined ? ` (got '${got}')` : ""}`);
  return ok;
}

// ── CASE 1 — HAPPY PATH: agent → verify → record, GREEN. ──────────────────────────────────────────────────
async function happyPath(): Promise<boolean> {
  line();
  console.log("CASE 1 — HAPPY PATH: engine emits + blocks; the runner runs the agent; verify confirms the record.");
  line();

  const { runId } = await enqueue("demo-agent", { who: "c2-proof" }, "demo-agent-c2-happy-001");
  console.log(`    enqueue('demo-agent') runId=${runId}`);

  // (a) drive ticks until the agent-result step BLOCKS (run -> blocked). The engine emits the task + blocks here.
  console.log("\n[a] tick until seq-1 BLOCKS on agent-result (the engine emits + blocks — it does NOT run the agent):");
  const blockedState = await tickUntil(runId, ["blocked"], "drive");
  if (!assert("run reached 'blocked' (engine emitted+blocked)", blockedState === "blocked", blockedState)) return false;

  // (b) the RUNNER (not the engine) claims the blocked agent-result step + runs the SIMULATED executor + records.
  console.log("\n[b] agentRunner.runOnce() — claim (SKIP-LOCKED) + run the agent's executor + complete + record agent_id:");
  const report = await agentRunner.runOnce();
  console.log(`    runOnce -> ${JSON.stringify(report)}`);
  const ranAgent = report.kind === "completed" && report.agentId === DEMO_AGENT_ID;
  if (!assert("runner completed seq-1 via agent 'demo-agent'", ranAgent, report.kind)) return false;

  // (c) tick runs engine.verify over the agent's recorded result -> stop condition met -> run completes.
  console.log("\n[c] tick runs engine.verify over the agent's RECORDED result -> loop stop -> run completes:");
  const finalState = await tickUntil(runId, ["completed"], "verify");

  // (d) EVIDENCE + GREEN assertions.
  line();
  console.log("EVIDENCE (happy path)");
  const steps = await stepRows(runId);
  for (const s of steps) console.log("  ", JSON.stringify(s));
  const types = await outboxTypes(runId);
  console.log("  outbox:", JSON.stringify(types));
  line();

  const verifyStep = steps.find((s) => s.handler === "engine.verify");
  const verdict = (verifyStep?.verdict as { verdict?: string } | null)?.verdict;
  const agentStep = steps.find((s) => s.seq === AGENT_RESULT_SEQ);

  const a1 = assert("run.state === 'completed'", finalState === "completed", finalState);
  const a2 = assert("seq-1 resolved agent_id === 'demo-agent'", agentStep?.agentId === DEMO_AGENT_ID, agentStep?.agentId ?? "null");
  const a3 = assert("verify verdict === 'pass'", verdict === "pass", verdict);
  const a4 = assert("outbox has 'workflow.agent.completed'", types.includes("workflow.agent.completed"));
  const a5 = assert("outbox has 'agent.task_requested'", types.includes("agent.task_requested"));
  return a1 && a2 && a3 && a4 && a5;
}

// ── CASE 2 — ADVERSARIAL: a FAILING executor past the step cap -> run terminal `failed` (never falsely completed). ─
async function failingExecutor(): Promise<boolean> {
  line();
  console.log("CASE 2 — ADVERSARIAL: the agent's executor FAILS past the step cap -> run terminal 'failed' (NOT completed).");
  line();

  const failingExec: AgentExecutor = async () => ({ ok: false, error: "simulated_executor_failure" });
  const failingRunner: AgentRunnerHandle = createAgentRunner({
    context: engineContext,
    agents: [{ id: DEMO_AGENT_ID, skills: [DEMO_AGENT_SKILL], executor: failingExec }],
    runnerId: "demo-runner-failing",
  });

  const { runId } = await enqueue("demo-agent", { who: "c2-proof" }, "demo-agent-c2-fail-001");
  console.log(`    enqueue('demo-agent') runId=${runId}`);
  const blockedState = await tickUntil(runId, ["blocked"], "drive");
  if (!assert("run reached 'blocked'", blockedState === "blocked", blockedState)) return false;

  console.log("\n    drive failingRunner.runOnce() until the executor cap trips:");
  let last: RunOnceReport = { kind: "idle" };
  for (let i = 0; i < 6; i++) {
    last = await failingRunner.runOnce();
    console.log(`    runOnce ${i} -> ${JSON.stringify(last)}`);
    if (last.kind === "failed" || last.kind === "idle" || last.kind === "unrouted") break;
  }

  const finalState = await runState(runId);
  const steps = await stepRows(runId);
  line();
  for (const s of steps) console.log("  ", JSON.stringify(s));
  console.log("  outbox:", JSON.stringify(await outboxTypes(runId)));
  line();

  const a1 = assert("runner reported 'failed' (cap tripped)", last.kind === "failed", last.kind);
  const a2 = assert("run.state === 'failed' (terminal)", finalState === "failed", finalState);
  const a3 = assert("run.state !== 'completed' (never falsely completed)", finalState !== "completed", finalState);
  const a4 = assert("outbox has 'workflow.run.failed'", (await outboxTypes(runId)).includes("workflow.run.failed"));
  return a1 && a2 && a3 && a4;
}

// ── CASE 3 — ADVERSARIAL: an agent-result requirement with NO matching agent -> `unrouted` terminal (fail-closed). ─
async function unroutedRequirement(): Promise<boolean> {
  line();
  console.log("CASE 3 — ADVERSARIAL: NO registered agent serves the required skill -> 'unrouted' terminal (fail-closed).");
  line();

  // a runner whose ONLY agent serves a DIFFERENT skill — selectAgentFor(skill 'demo-skill') resolves to no-match.
  const okExec: AgentExecutor = async () => ({ ok: true, result: { producedBy: "should-never-run" } });
  const unroutedRunner: AgentRunnerHandle = createAgentRunner({
    context: engineContext,
    agents: [{ id: "misc-agent", skills: ["some-other-skill"], executor: okExec }],
    runnerId: "demo-runner-unrouted",
  });

  const { runId } = await enqueue("demo-agent", { who: "c2-proof" }, "demo-agent-c2-unrouted-001");
  console.log(`    enqueue('demo-agent') runId=${runId}`);
  const blockedState = await tickUntil(runId, ["blocked"], "drive");
  if (!assert("run reached 'blocked'", blockedState === "blocked", blockedState)) return false;

  console.log("\n    unroutedRunner.runOnce() — requirement resolves to NO agent:");
  const report = await unroutedRunner.runOnce();
  console.log(`    runOnce -> ${JSON.stringify(report)}`);

  const finalState = await runState(runId);
  const steps = await stepRows(runId);
  line();
  for (const s of steps) console.log("  ", JSON.stringify(s));
  console.log("  outbox:", JSON.stringify(await outboxTypes(runId)));
  line();

  const agentStep = steps.find((s) => s.seq === AGENT_RESULT_SEQ);
  const unrouted = (agentStep?.checkpoint as { agentUnrouted?: unknown } | null)?.agentUnrouted === true;

  const a1 = assert("runner reported 'unrouted' (no-match)", report.kind === "unrouted", report.kind);
  const a2 = assert("run.state === 'failed' (fail-closed terminal)", finalState === "failed", finalState);
  const a3 = assert("run.state !== 'completed' (no arbitrary agent ran)", finalState !== "completed", finalState);
  const a4 = assert("seq-1 checkpoint marked agentUnrouted", unrouted, String(unrouted));
  return a1 && a2 && a3 && a4;
}

async function main(): Promise<void> {
  line();
  console.log("ENGINE-DEMO-APP — C2 off-prod proof: the engine's agent -> verify -> record chain (SIMULATED executor)");
  line();

  console.log("[0] migrate throwaway DB (app applies the canonical engine DDL incl. 0003/0004 runner+agent_id):");
  await migrate();
  console.log(`    enqueue allow-list DERIVED from registered packs: [${enqueueKeys.join(", ")}]`);
  console.log();

  const happy = await happyPath();
  const failing = await failingExecutor();
  const unrouted = await unroutedRequirement();

  line();
  const green = happy && failing && unrouted;
  console.log(`SUMMARY: happy=${happy ? "GREEN" : "RED"}  failing-executor=${failing ? "GREEN" : "RED"}  unrouted=${unrouted ? "GREEN" : "RED"}`);
  if (green) {
    console.log("RESULT: GREEN — the engine emitted + blocked; the RUNNER ran the agent + recorded; verify confirmed; both adversarial cases failed-closed.");
  } else {
    console.error("RESULT: RED — the agent -> verify -> record chain did not reach the expected end states.");
  }
  line();
  await sql.end();
  process.exit(green ? 0 : 1);
}

main().catch(async (e) => {
  console.error("run-agent-demo: FAILED", e);
  try { await sql.end(); } catch { /* noop */ }
  process.exit(1);
});
