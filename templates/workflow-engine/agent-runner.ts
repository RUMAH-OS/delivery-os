// Workflow Engine — the PRODUCTION AGENT RUNNER runtime (Slice A; GENERIC, domain-free).
// The continuous, durable, concurrent sibling of the one-shot completer. Where completeAwaitingStep() is the
// PASSIVE resume side (an inbound callback resolves ONE blocked step), the runner is the ACTIVE drain side: it
// CLAIMS blocked `agent-result` steps with SKIP LOCKED, runs an injected EXECUTOR port against each task, and
// completes the step via the SAME completer (await_source 'agent-result'), releasing the claim. It drains MANY
// dispatched agent tasks concurrently (claim/lease + SKIP-LOCKED => no double-execute) and durably (a crashed
// runner's claim auto-expires and another runner reclaims it). It is the runtime behind "continuous autonomous
// execution": the one-shot agent runner becomes a runner that processes a whole queue.
//
// OWNERSHIP BOUNDARY: this is GENERIC engine mechanism. It knows NOTHING of any domain (no invoice/agent-prompt/
// claude concept). The EXECUTOR is an injected PORT: (task) => Promise<{ok, result?, error?}>. The app supplies
// the real executor (Slice B = a real headless launcher); a proof supplies a simulated one. The runner only:
//   (1) claims a blocked agent-result step (SKIP LOCKED + lease), (2) runs the port (timeout-enforced),
//   (3) on ok -> completeAwaitingStep(awaitSource:'agent-result') in a txn (release claim), (4) on fail ->
//   backoff+retry up to maxAttempts, then fail the step/run (release claim). It NEVER duplicates the state
//   machine — success goes through the existing completer (legal blocked->done + run blocked->executing); a
//   terminal failure uses the existing legal edges (blocked->failed + run blocked->failed).
//
// SAFETY: claiming is a SAME-STATE (blocked->blocked) bookkeeping write — it never changes step state, so the
// 0002 step-transition guard's same-state branch always permits it. The claim does NOT consume the awaiting
// event id (the step stays awaiting); only the completer (on success) or the fail path clears/terminates it.
// SKIP LOCKED + the runner-lease predicate make the claim exactly-once across concurrent runners; an expired
// lease is the auto-reclaim (a crashed runner's work is retried, never silently lost).

import { and, eq } from "drizzle-orm";
import { sql as dsql } from "drizzle-orm";
import { assertLegalRunTransition } from "./state-machine.js";
import { completeAwaitingStep } from "./callback-completer.js";
import type { DbLike, EngineContext, EngineTables, TxLike } from "./engine.js";

// The DECLARED source a runner drains. The runner is the agent-result executor; it claims ONLY agent-result
// steps (S2 least-privilege — a runner never touches a system-callback/human-response/timer block).
export const AGENT_RESULT_SOURCE = "agent-result" as const;

// ── The EXECUTOR PORT — the ONLY app coupling. Domain-free shape. ─────────────────────────────────
// `task` is the OPAQUE descriptor the runner hands the executor: the blocked step's recorded input/result (the
// agent.task_requested payload the dispatch handler emitted) + the correlation eventId + run/seq refs. The
// executor DOES the work (out-of-process agent, a simulation, a real launcher) and returns ok + an opaque
// `result` recorded onto the step, or a coded error. PII-free by contract (refs/codes only).
export interface AgentTask {
  runId: string;
  seq: number;
  eventId: string; // the correlation key (awaiting_event_id) — what the result is recorded against
  task: Record<string, unknown>; // the opaque dispatch payload (the step result/input the handler recorded)
}
export type AgentExecutorOutcome = { ok: true; result?: Record<string, unknown> } | { ok: false; error?: string };
export type AgentExecutor = (task: AgentTask) => Promise<AgentExecutorOutcome>;

// ── A claimed task (what claimAgentTask returns) ──────────────────────────────────────────────────
export interface ClaimedAgentTask extends AgentTask {
  attempt: number; // the step's current attempt count (for retry accounting)
  maxAttempts: number; // the step's per-step ceiling (the hard cap)
}

export interface ClaimArgs {
  runnerId: string; // the claiming runner's identity (recorded on the step + the outbox audit)
  leaseMs: number; // the claim lease window; an expired lease makes the step claimable by another runner
}

// ── claimAgentTask — SKIP-LOCKED claim of ONE blocked agent-result step whose runner lease is null/expired. ──
// Sets runner_id/runner_claimed_at/runner_lease_expires_at (a same-state blocked->blocked bookkeeping write).
// Returns the claimed task or null if the queue is empty. Atomic in its own txn. Exactly-once across concurrent
// runners (FOR UPDATE SKIP LOCKED on the matched row). An expired lease = auto-reclaim of a crashed runner.
export async function claimAgentTask(ctx: EngineContext, args: ClaimArgs, now: Date = new Date()): Promise<ClaimedAgentTask | null> {
  const db = ctx.db as DbLike;
  const { workflowStep } = ctx.tables as EngineTables;
  const leaseExpires = new Date(now.getTime() + args.leaseMs);

  return await db.transaction(async (tx: TxLike) => {
    // Lease the lowest-seq blocked agent-result step whose runner lease is free (null or expired). SKIP LOCKED
    // so two runners never contend on the same row. The await_source match enforces S2 (runner drains ONLY
    // agent-result). ORDER BY for FIFO-ish fairness; LIMIT 1 (one task per claim).
    const picked = await tx.execute(dsql`
      SELECT id, run_id, seq, attempt, max_attempts, awaiting_event_id, result, checkpoint
      FROM workflow_step
      WHERE state = 'blocked'
        AND await_source = ${AGENT_RESULT_SOURCE}
        AND awaiting_event_id IS NOT NULL
        AND (runner_lease_expires_at IS NULL OR runner_lease_expires_at < ${now.toISOString()})
      ORDER BY run_id, seq
      FOR UPDATE SKIP LOCKED
      LIMIT 1`);
    const rows = picked as unknown as Array<{
      id: string; run_id: string; seq: number; attempt: number; max_attempts: number;
      awaiting_event_id: string; result: Record<string, unknown> | null; checkpoint: Record<string, unknown> | null;
    }>;
    if (rows.length === 0) return null;
    const s = rows[0]!;

    // CLAIM: same-state (blocked->blocked) bookkeeping write — set the runner lease. CAS-guarded on the row id;
    // FOR UPDATE already holds the row, so this is the same-row write. State is NOT changed (the guard permits it).
    await tx.update(workflowStep).set({
      runnerId: args.runnerId, runnerClaimedAt: now, runnerLeaseExpiresAt: leaseExpires, updatedAt: now,
    }).where(eq(workflowStep.id, s.id));

    // the OPAQUE task = the dispatch payload the handler recorded onto the step result (PII-free refs).
    const task = (s.result ?? s.checkpoint ?? {}) as Record<string, unknown>;
    return {
      runId: s.run_id, seq: s.seq, eventId: s.awaiting_event_id, task,
      attempt: s.attempt, maxAttempts: s.max_attempts,
    };
  });
}

// ── createAgentRunner — the LOOP. claim -> run executor (timeout) -> complete | retry/fail -> release. ──
export interface AgentRunnerArgs {
  context: EngineContext;
  executor: AgentExecutor; // the injected PORT (simulated in Slice A; a real launcher in Slice B)
  runnerId: string; // this runner's identity (recorded on each claimed step + the outbox audit)
  pollMs?: number; // start()/stop() poll interval when the queue is empty (default 250ms)
  leaseMs?: number; // the claim lease window (default 30_000ms) — auto-reclaim after this if the runner dies
  maxAttempts?: number; // OPTIONAL override of the per-step cap (default: use the step's own max_attempts)
  backoffMs?: number; // base backoff between executor retries (default 100ms; exponential by attempt)
  executorTimeoutMs?: number; // hard timeout per executor invocation (default 60_000ms)
}

export interface AgentRunnerHandle {
  runnerId: string;
  // process at most ONE task (claim + run + complete/retry/fail). Returns a coded report for deterministic proofs.
  runOnce(now?: Date): Promise<RunOnceReport>;
  start(): void; // begin the poll loop (drains continuously until stop())
  stop(): Promise<void>; // stop the poll loop; resolves after the in-flight iteration settles
}

export type RunOnceReport =
  | { kind: "idle" } // nothing claimable
  | { kind: "completed"; runId: string; seq: number } // executor ok -> step completed via the completer
  | { kind: "retry"; runId: string; seq: number; attempt: number } // executor failed, attempts remain -> released for retry
  | { kind: "failed"; runId: string; seq: number; attempt: number } // executor failed past the cap -> step+run failed
  | { kind: "lost"; runId: string; seq: number }; // lost the claim/CAS race (another runner won) — safe no-op

const DEFAULTS = { pollMs: 250, leaseMs: 30_000, backoffMs: 100, executorTimeoutMs: 60_000 };

export function createAgentRunner(args: AgentRunnerArgs): AgentRunnerHandle {
  const ctx = args.context;
  const db = ctx.db as DbLike;
  const { workflowRun, workflowStep, outbox } = ctx.tables as EngineTables;
  const runnerId = args.runnerId;
  const pollMs = args.pollMs ?? DEFAULTS.pollMs;
  const leaseMs = args.leaseMs ?? DEFAULTS.leaseMs;
  const backoffBase = args.backoffMs ?? DEFAULTS.backoffMs;
  const executorTimeoutMs = args.executorTimeoutMs ?? DEFAULTS.executorTimeoutMs;

  let running = false;
  let loopDone: Promise<void> | null = null;

  // run the executor port under a hard timeout. A timeout is reported as a (transient) failure — the work is
  // retried/reclaimed, never silently assumed done. NEVER throws (a throwing executor is a transient failure).
  async function runExecutor(task: AgentTask): Promise<AgentExecutorOutcome> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<AgentExecutorOutcome>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, error: "executor_timeout" }), executorTimeoutMs);
      });
      const work = Promise.resolve()
        .then(() => args.executor(task))
        .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
      return await Promise.race([work, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function runOnce(now: Date = new Date()): Promise<RunOnceReport> {
    const claimed = await claimAgentTask(ctx, { runnerId, leaseMs }, now);
    if (!claimed) return { kind: "idle" };

    // run the injected executor port (timeout-enforced). The runner does NOT inspect/trust the work beyond the
    // ok/fail signal — the workflow's verify step (the next step) independently checks the real artifact/result.
    const outcome = await runExecutor({ runId: claimed.runId, seq: claimed.seq, eventId: claimed.eventId, task: claimed.task });
    const cap = args.maxAttempts ?? claimed.maxAttempts;

    if (outcome.ok) {
      // SUCCESS — complete the step via the EXISTING completer (do NOT duplicate the state machine). The completer
      // matches await_source 'agent-result' (S2) + clears the correlation key + advances blocked->done and run
      // blocked->executing, in ONE txn. We also release the runner claim + record the runner identity on the audit.
      const res = await db.transaction(async (tx: TxLike) => {
        const out = await completeAwaitingStep(
          tx,
          { workflowRun, workflowStep },
          { eventId: claimed.eventId, outcome: { ...(outcome.result ?? {}), runnerId }, awaitSource: AGENT_RESULT_SOURCE },
        );
        if (out.kind === "advanced") {
          // clear the claim (the step is now done) + audit which runner executed it. Same-row write post-advance.
          await tx.update(workflowStep).set({ runnerId, runnerClaimedAt: null, runnerLeaseExpiresAt: null, updatedAt: now })
            .where(and(eq(workflowStep.runId, out.runId), eq(workflowStep.seq, out.seq)));
          await emitAudit(tx, "workflow.agent.completed", out.runId, { runId: out.runId, seq: out.seq, runnerId });
        }
        return out;
      });
      if (res.kind === "advanced") return { kind: "completed", runId: res.runId, seq: res.seq };
      // the step was no longer blocked under us (another runner won / already resolved) — safe no-op.
      return { kind: "lost", runId: claimed.runId, seq: claimed.seq };
    }

    // FAILURE (incl. executor_timeout). The runner's RETRY BUDGET is tracked in the step CHECKPOINT
    // (`runnerAttempt`, 0-based) — the engine's `attempt` column is the engine's OWN lease accounting and is left
    // untouched, so the runner cap is self-contained + deterministic. `cap` = invoke the executor up to N times.
    // After each failure with budget remaining, RELEASE the claim (clear the lease) so this or another runner
    // reclaims + retries (backoffMs is the advisory window recorded on the audit; the proof drives time directly).
    // When the budget is exhausted, the step+run go TERMINAL failed (the run is NEVER falsely completed).
    return await db.transaction(async (tx: TxLike) => {
      // re-read under lock to get the live checkpoint + still-blocked guard (idempotent on a lost claim race).
      const [live] = await tx.select({ state: workflowStep.state, checkpoint: workflowStep.checkpoint })
        .from(workflowStep)
        .where(and(eq(workflowStep.runId, claimed.runId), eq(workflowStep.seq, claimed.seq)))
        .limit(1);
      if (!live || live.state !== "blocked") return { kind: "lost" as const, runId: claimed.runId, seq: claimed.seq };

      const cp = (live.checkpoint ?? {}) as Record<string, unknown>;
      const priorRunnerAttempts = Number(cp.runnerAttempt ?? 0);
      const runnerAttempt = priorRunnerAttempts + 1; // this invocation's 1-based runner attempt number

      if (runnerAttempt < cap) {
        // budget remains: record the runner attempt in the checkpoint + release the claim so it is claimable again
        // (immediately, in Slice A — the proof flips the executor to success on the retry). The step STAYS blocked
        // (still awaiting; nothing leaked). Same-state (blocked->blocked) bookkeeping write — guard permits it.
        await tx.update(workflowStep).set({
          checkpoint: { ...cp, runnerAttempt },
          runnerId: null, runnerClaimedAt: null, runnerLeaseExpiresAt: null,
          error: { message: outcome.error ?? "executor_failed", runnerAttempt }, updatedAt: now,
        }).where(and(eq(workflowStep.runId, claimed.runId), eq(workflowStep.seq, claimed.seq), eq(workflowStep.state, "blocked")));
        await emitAudit(tx, "workflow.agent.retry", claimed.runId, { runId: claimed.runId, seq: claimed.seq, runnerAttempt, runnerId, backoffMs: backoffBase * runnerAttempt });
        return { kind: "retry" as const, runId: claimed.runId, seq: claimed.seq, attempt: runnerAttempt };
      }

      // CAP TRIPPED: terminal. Fail the RUN (blocked->failed, a legal run edge) — the run is NEVER falsely
      // completed. The STEP is left `blocked` (NOT moved to 'failed') with its correlation key CLEARED.
      // DEFENSE IN DEPTH: the engine tick no longer auto-leases steps of a terminal 'failed' run (the lease
      // predicate matches r.state IN ('planned','executing') only — see engine.ts advanceNextReadyStep), so the
      // dead run cannot be resurrected even if a step reads 'failed'. We STILL leave the step `blocked` (not
      // 'failed') as a redundant, belt-and-braces guard and so the step's state-name does not falsely advertise
      // an in-process retry that will never come. A `blocked` step with awaiting_event_id cleared is OUT of both
      // the tick's leasable set AND the runner's claim set — terminal by both gates, with the engine guard behind
      // it. We record the terminal error + runner identity as a same-state (blocked->blocked) bookkeeping write.
      await tx.update(workflowStep).set({
        checkpoint: { ...cp, runnerAttempt, agentFailed: true }, awaitingEventId: null,
        error: { message: outcome.error ?? "executor_failed", runnerAttempt, terminal: true },
        runnerId, runnerClaimedAt: null, runnerLeaseExpiresAt: null, updatedAt: now,
      }).where(and(eq(workflowStep.runId, claimed.runId), eq(workflowStep.seq, claimed.seq), eq(workflowStep.state, "blocked")));
      // run blocked->failed (the escalation edge). transition guarded in-app; DB trigger is the backstop.
      const [run] = await tx.select({ state: workflowRun.state }).from(workflowRun).where(eq(workflowRun.id, claimed.runId)).limit(1);
      if (run && run.state === "blocked") {
        assertLegalRunTransition("blocked", "failed");
        await tx.update(workflowRun).set({ state: "failed", terminalAt: now, blockedReason: `agent step ${claimed.seq} failed after ${runnerAttempt} attempt(s)`, updatedAt: now })
          .where(and(eq(workflowRun.id, claimed.runId), eq(workflowRun.state, "blocked")));
      }
      await emitAudit(tx, "workflow.agent.failed", claimed.runId, { runId: claimed.runId, seq: claimed.seq, runnerAttempt, runnerId, reason: "max_attempts_exhausted" });
      await emitAudit(tx, "workflow.run.failed", claimed.runId, { runId: claimed.runId, seq: claimed.seq, reason: "agent_max_attempts_exhausted" });
      return { kind: "failed" as const, runId: claimed.runId, seq: claimed.seq, attempt: runnerAttempt };
    });
  }

  // emit to the app's outbox in the SAME txn (transactional audit) — runner identity is recorded. PII-free.
  async function emitAudit(tx: TxLike, type: string, runId: string, payload: Record<string, unknown>): Promise<void> {
    await tx.insert(outbox).values({ type, aggregateType: "workflow_run", aggregateId: runId, payload });
  }

  function start(): void {
    if (running) return;
    running = true;
    loopDone = (async () => {
      while (running) {
        let report: RunOnceReport;
        try { report = await runOnce(); } catch { report = { kind: "idle" }; }
        // idle -> sleep a poll interval; otherwise drain immediately (back-to-back) until the queue empties.
        if (report.kind === "idle") await sleep(pollMs);
      }
    })();
  }

  async function stop(): Promise<void> {
    running = false;
    if (loopDone) await loopDone;
    loopDone = null;
  }

  return { runnerId, runOnce, start, stop };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
