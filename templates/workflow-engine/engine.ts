// Durable Execution Engine — the runner (Slice 0). PORTABILIZED: zero app-infra imports.
// §11 DECISION-REVIEW-2026-06-18-execution-engine.md. Honest about serverless (ECR-0005): NO long-running
// worker. The engine is a stateless, idempotent TICK + a DB-resident lease. All liveness lives in
// workflow_run/workflow_step rows; a tick leases ONE ready step (SELECT ... FOR UPDATE SKIP LOCKED, C1 —
// NO pgmq), advances ONE transition, writes a checkpoint, emits the engine event to the outbox, and
// commits ALL of that in ONE db.transaction (transactional outbox). A heartbeat (a scheduled POST, NOT
// pg_cron — not installed) calls the tick on a schedule; it is also invokable on-demand after enqueue.
//
// OWNERSHIP BOUNDARY: the engine declares the SHAPE of the infra it needs (EngineContext = a db/tx handle
// + the run/step/outbox Drizzle table objects) and the app INJECTS its own. The engine imports ZERO concrete
// app infra — no app db singleton, no app schema module. createEngine(ctx) returns the runner fns.
//
// C1 CAS: every state write-back is gated on `WHERE lease_token = mine`; a mismatch means I lost my lease
// (a slow process resumed after my lease expired) and the write is discarded — prevents double-execute.
// C2: ONE backend (SKIP LOCKED) behind a thin enqueue() boundary. NO queue adapter, NO BullMQ.
// C6: only emit-only/idempotent steps run unattended; an irreversible step leaves the run BLOCKED.

import { and, eq, sql as dsql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDefinition, type WorkflowDefinition, type StopCondition } from "./definitions.js";
import {
  assertLegalRunTransition,
  assertLegalStepTransition,
  isAwaitCallback,
  isUnattendedSafe,
  type RunState,
  type StepEffect,
} from "./state-machine.js";
import { runHandler, type StepContext } from "./handlers.js";
import {
  getVerifier, getVerifierRung, gateDecision,
  type Verdict, type VerifierInput, type VerifierRung, type GateDecision,
} from "./verifiers.js";

const LEASE_SECONDS = 30; // visibility-timeout lease window; a dead process's lease expires after this.

// ── EngineContext — the injected infra port (the ONLY coupling, made explicit). ───────────────────
// The app supplies its own Drizzle client + its run/step/outbox table objects. The engine declares the
// SHAPE; it never imports a concrete db or schema. Tables are kept loose (any-typed Drizzle table objects)
// so the engine does not own the schema package — the app owns the instance + the column-level types.
export interface EngineTables {
  workflowRun: any;
  workflowStep: any;
  outbox: any;
}

// A minimal db handle: the engine needs `.transaction`, `.select`, `.insert`, `.update`, `.execute`. Kept
// loose (the app passes a real drizzle-orm postgres-js client). The tx handle is derived from it.
export interface DbLike {
  transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
  execute: (...args: any[]) => any;
}

export interface EngineContext {
  db: DbLike;
  tables: EngineTables;
  // OPTIONAL domain-injected hook for the callback-before-block race (R1/N1). The engine is DOMAIN-FREE: it
  // does not know the app's callback-outcome table (e.g. a delivery log). For an await-callback step, the
  // engine asks the app — via this hook, IN the same txn, AFTER the request is emitted — whether the
  // correlated outcome ALREADY arrived. If it returns true, the engine advances the step directly instead of
  // blocking (record-then-advance-if-waiting). If the hook is absent, the engine always blocks (and relies on
  // the completer to advance later) — the safe default. The hook receives ONLY an opaque event id.
  outcomeArrived?: (tx: TxLike, eventId: string) => Promise<boolean>;
}

// The Drizzle transaction handle type (kept loose — the engine threads whatever the app's db hands it).
export type TxLike = any;

export interface TickReport {
  advanced: boolean; // did this tick change anything?
  runId?: string;
  from?: RunState;
  to?: RunState;
  detail?: string;
}

export interface Engine {
  enqueue(definitionKey: string, input: Record<string, unknown>, idempotencyKey: string): Promise<{ runId: string; created: boolean }>;
  tick(now?: Date): Promise<TickReport>;
}

// ── createEngine — the factory. Binds the injected EngineContext, returns the runner surface. ─────
export function createEngine(ctx: EngineContext): Engine {
  const { db } = ctx;
  const { workflowRun, workflowStep, outbox } = ctx.tables;
  const outcomeArrived = ctx.outcomeArrived; // OPTIONAL race hook (callback-before-block); undefined = always block.

  // ── enqueue() — the thin boundary (C2). Creates a run (queued) + materializes its steps. ──────────
  // Idempotent on (definition_key, idempotency_key): a re-enqueue with the same key returns the existing
  // run (no duplicate). All in one transaction. Returns the run id.
  async function enqueue(
    definitionKey: string,
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<{ runId: string; created: boolean }> {
    const def = getDefinition(definitionKey);
    if (!def) throw new Error(`unknown workflow definition: ${definitionKey}`);
    try {
      const runId = await db.transaction(async (tx) => {
        const [run] = await tx.insert(workflowRun).values({
          definitionKey, input, idempotencyKey, state: "queued",
        }).returning();
        await tx.insert(outbox).values({
          type: "workflow.run.queued", aggregateType: "workflow_run", aggregateId: run!.id,
          payload: { runId: run!.id, definitionKey },
        });
        return run!.id;
      });
      return { runId, created: true };
    } catch (e) {
      if (isUniqueViolation(e)) {
        const [existing] = await db.select({ id: workflowRun.id }).from(workflowRun)
          .where(and(eq(workflowRun.definitionKey, definitionKey), eq(workflowRun.idempotencyKey, idempotencyKey)))
          .limit(1);
        if (existing) return { runId: existing.id, created: false };
      }
      throw e;
    }
  }

  // ── tick() — stateless, idempotent. Advances ONE transition for ONE run, then exits. ──────────────
  // Returns a small report so the heartbeat/caller can see what happened. Loop the tick (or schedule it)
  // to drive a run to a terminal state. Idempotent on (run_id, seq, attempt): re-running a tick that
  // already committed a transition is a safe no-op (the lease/state moved on; CAS discards stale writes).
  async function tick(now: Date = new Date()): Promise<TickReport> {
    // ── Phase 1: PLAN a queued run (queued -> planned), materializing its steps. ──────────────────
    const planned = await planNextQueuedRun(now);
    if (planned.advanced) return planned;

    // ── Phase 2: lease + advance ONE ready step of a planned/executing/blocked-recovering run. ────
    return await advanceNextReadyStep(now);
  }

  // queued -> planned: lease a queued run via SKIP LOCKED, materialize its steps, emit the event. Atomic.
  async function planNextQueuedRun(now: Date): Promise<TickReport> {
    return await db.transaction(async (tx) => {
      const picked = await tx.execute(dsql`
        SELECT id, definition_key FROM workflow_run
        WHERE state = 'queued'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1`);
      const rows = picked as unknown as Array<{ id: string; definition_key: string }>;
      if (rows.length === 0) return { advanced: false };
      const run = rows[0]!;
      const def = getDefinition(run.definition_key);
      if (!def) {
        // planning failed, non-retryable: queued -> failed (a legal edge).
        assertLegalRunTransition("queued", "failed");
        await tx.update(workflowRun).set({ state: "failed", terminalAt: now, updatedAt: now, blockedReason: `unknown definition ${run.definition_key}` }).where(eq(workflowRun.id, run.id));
        await emitTx(tx, "workflow.run.failed", run.id, { runId: run.id, reason: "unknown_definition" });
        return { advanced: true, runId: run.id, from: "queued", to: "failed", detail: "unknown definition" };
      }
      // materialize the ordered steps (dispatch-route plan shape — no new DSL, C7).
      for (let seq = 0; seq < def.steps.length; seq++) {
        const s = def.steps[seq]!;
        await tx.insert(workflowStep).values({
          runId: run.id, seq, state: "ready", stepType: s.stepType, owner: s.owner,
          skill: s.skill ?? null, ku: s.ku ?? null, handler: s.handler, effect: s.effect, maxAttempts: s.maxAttempts,
          // Slice 1: persist the declarative loop predicate (D4). A human-response gate step records its source
          // so the completer's per-source match (S2) is a DB fact, not an app inference.
          stopCondition: (s.stopCondition ?? null) as Record<string, unknown> | null,
          // await_source materialization (S2): a human-response gate records 'human-response'; an await-callback
          // step records its DECLARED source (default 'system-callback') so the engine's block + the completer's
          // per-source match agree by construction. Any other step records NULL (in-process).
          awaitSource:
            s.effect === "irreversible" && s.handler === "engine.human-gate"
              ? "human-response"
              : isAwaitCallback(s.effect)
                ? (s.awaitSource ?? "system-callback")
                : null,
          // MULTI-AGENT (Slice 1): materialize the step's agent REQUIREMENT ({id?, skill?}) so the runner can
          // resolve it (selectAgentFor) WITHOUT loading the definition — the runner stays self-contained + the
          // requirement is a DB fact the per-agent report can read. Only meaningful on agent-result steps; NULL
          // elsewhere (an in-process step runs the engine handler, not an agent executor).
          agentRequirement:
            (isAwaitCallback(s.effect) && (s.awaitSource ?? "system-callback") === "agent-result" && s.agent)
              ? (s.agent as Record<string, unknown>)
              : null,
        });
      }
      assertLegalRunTransition("queued", "planned");
      await tx.update(workflowRun).set({ state: "planned", updatedAt: now }).where(eq(workflowRun.id, run.id));
      await emitTx(tx, "workflow.run.planned", run.id, { runId: run.id, stepCount: def.steps.length });
      return { advanced: true, runId: run.id, from: "queued", to: "planned", detail: `materialized ${def.steps.length} steps` };
    });
  }

  // The leasable-step query: a step is leasable when ready, OR leased with an EXPIRED lease (dead process),
  // OR failed and due for retry. SKIP LOCKED so concurrent ticks never contend on the same step.
  //
  // TERMINAL-RUN GUARD (non-resurrection): the predicate matches runs in 'planned' or 'executing' ONLY — it
  // does NOT auto-lease steps of a 'failed' run. A 'failed' run is TERMINAL; the legitimate auto-recovery paths
  // (#4 kill-and-resume, #5 transient-failure-then-retry) all keep the run in 'executing' while a step is
  // 'failed'+nextRetryAt or 'leased'+expired-lease — the run only becomes 'failed' when retries are EXHAUSTED
  // (terminal). Including 'failed' runs here was a silent dead-run-resurrection vector: for an await-callback
  // step it re-ran the dispatch handler (re-emitting the request + a new awaiting_event_id) and transitioned
  // the run failed->blocked. The 'failed'->'executing' run edge remains legal for DELIBERATE operator/manual
  // resume (a distinct, explicit re-lease path), but the unattended tick never auto-resurrects a terminal run.
  async function advanceNextReadyStep(now: Date): Promise<TickReport> {
    const leaseToken = randomUUID();
    const leaseUntil = new Date(now.getTime() + LEASE_SECONDS * 1000);

    return await db.transaction(async (tx) => {
      // Lease the lowest-seq leasable step of a non-terminal, non-blocked run. FOR UPDATE SKIP LOCKED.
      // ORDERING INVARIANT: a step is leasable ONLY if every EARLIER step in its run is already `done`.
      // Without this, a later step could be leased while an earlier step is in backoff/retry — running out
      // of order and consuming a half-built checkpoint. The NOT EXISTS clause enforces strict in-order
      // advancement; combined with FOR UPDATE SKIP LOCKED it stays concurrency-safe.
      const picked = await tx.execute(dsql`
        SELECT s.id, s.run_id, s.seq, s.attempt, s.max_attempts, s.effect, s.handler, s.checkpoint, s.stop_condition, s.await_source, s.state AS step_state, r.state AS run_state, r.was_interrupted
        FROM workflow_step s
        JOIN workflow_run r ON r.id = s.run_id
        WHERE r.state IN ('planned','executing')
          AND s.state IN ('ready','leased','failed')
          AND (s.lease_until IS NULL OR s.lease_until < ${now.toISOString()})
          AND (s.next_retry_at IS NULL OR s.next_retry_at <= ${now.toISOString()})
          AND s.state <> 'done'
          AND NOT EXISTS (
            SELECT 1 FROM workflow_step e
            WHERE e.run_id = s.run_id AND e.seq < s.seq AND e.state <> 'done'
          )
        ORDER BY r.created_at, s.seq
        FOR UPDATE OF s SKIP LOCKED
        LIMIT 1`);
      const rows = picked as unknown as Array<{
        id: string; run_id: string; seq: number; attempt: number; max_attempts: number;
        effect: StepEffect; handler: string; checkpoint: Record<string, unknown> | null;
        stop_condition: StopCondition | null; await_source: string | null;
        step_state: string; run_state: RunState; was_interrupted: boolean;
      }>;
      if (rows.length === 0) {
        // nothing leasable: a planned/executing run whose steps are all done -> complete the run.
        return await maybeCompleteRun(tx, now);
      }
      const step = rows[0]!;

      // A leased step whose lease EXPIRED = the previous process died mid-step. Mark the run interrupted
      // so it lands in `recovered`, not `completed` (#4/#5 observable). This is the resume-from-checkpoint.
      const interrupted = step.step_state === "leased";

      // C6: an irreversible step is NEVER run unattended — block the run for a human. The only legal edge
      // into blocked is executing->blocked, so move the run through executing first (planned->executing or the
      // executing self-loop — never from 'failed', which the lease predicate excludes), then executing->blocked.
      // The step itself is left untouched.
      if (!isUnattendedSafe(step.effect)) {
        await transitionRun(tx, step.run_id, "executing", now, interrupted ? { wasInterrupted: true } : {});
        await transitionRun(tx, step.run_id, "blocked", now, { blockedReason: `step ${step.seq} (${step.handler}) is irreversible — human required` });
        await emitTx(tx, "workflow.step.blocked", step.run_id, { runId: step.run_id, seq: step.seq, reason: "irreversible" });
        await emitTx(tx, "workflow.escalated", step.run_id, { runId: step.run_id, seq: step.seq, reason: "irreversible_step_requires_human" });
        return { advanced: true, runId: step.run_id, from: step.run_state, to: "blocked", detail: "irreversible step -> blocked (C6)" };
      }

      // Move the run into executing (legal from planned or the executing self-loop; the lease predicate
      // excludes terminal 'failed' runs, so this never auto-resurrects a dead run).
      await transitionRun(tx, step.run_id, "executing", now, interrupted ? { wasInterrupted: true } : {});

      // CAS-lease the step: claim it ONLY if its lease is still free (token write). Idempotent on
      // (run_id, seq, attempt). Attempts are 1-based: a fresh (ready) step's first run is attempt 1; a
      // retry of a failed step bumps to attempt+1; an expired-lease re-lease (leased) keeps the attempt
      // (the same attempt is being resumed, not a new try).
      const thisAttempt =
        step.step_state === "failed" ? step.attempt + 1
        : step.step_state === "ready" ? step.attempt + 1
        : step.attempt; // leased (resume): same attempt
      const leased = await tx.update(workflowStep).set({
        state: "leased", leaseToken, leaseUntil, attempt: thisAttempt, updatedAt: now,
      }).where(and(
        eq(workflowStep.id, step.id),
        // CAS guard: only lease if the row is still in the state we read (no one else grabbed it).
        eq(workflowStep.state, step.step_state),
      )).returning({ id: workflowStep.id });
      if (leased.length === 0) {
        // lost the race — another tick leased it between our SELECT and UPDATE. Discard (CAS miss).
        return { advanced: false, detail: "CAS miss on lease (concurrent tick won)" };
      }

      // ── VERIFIED-LOOP branch (Slice 1, §10.2) — the engine runs the verify step's loop control. ──
      // The engine: (1) runs the named Verifier capability IN-PROCESS (P2; the engine never embeds verifier
      // logic — it dispatches by id), (2) stores the Verdict on the step (D4), (3) evaluates the declarative
      // stopCondition predicate over that Verdict, and (4) branches (P4): pass -> stop (verify done); fail &
      // act.attempt < cap -> back-edge re-ready the act step (Improve); fail & act.attempt >= cap -> CAP TRIP
      // -> block the human-response gate (S3/C6). attempt/max_attempts on the ACT step is the hard cap (D3).
      if (step.handler === "engine.verify") {
        return await runVerifyStep(tx, step, leaseToken, now);
      }

      // ── AWAIT-CALLBACK branch (v1 cross-system primitive) — emit the request in-txn, then BLOCK on the
      // correlated inbound system callback (distinct from the irreversible human-gate block path). ──────
      // The step is leased (CAS held). Its handler emits the REQUEST event to the outbox in-txn and returns
      // the correlation key (awaitEventId = the request event id the callback will carry back). The engine
      // then EITHER: (a) callback-before-block race (R1/N1) — if the app's optional outcomeArrived hook says
      // the correlated outcome ALREADY landed, advance leased->done directly (no block, no lost work); OR
      // (b) the common case — set await_source='system-callback' + awaiting_event_id, transition
      // leased->blocked + run executing->blocked, and EXIT the tick holding NO lease (crash-while-blocked is
      // trivially resumable). Resume happens via completeAwaitingStep() called from the app's callback txn.
      if (isAwaitCallback(step.effect)) {
        return await runAwaitCallbackStep(tx, step, leaseToken, thisAttempt, now);
      }

      // ── Execute the step handler. Emit-only/idempotent so a crash mid-handler is safe to re-run. ──
      const sctx: StepContext = {
        tx, runId: step.run_id, seq: step.seq, attempt: thisAttempt, checkpoint: step.checkpoint ?? null,
        emit: (type, payload) => emitTx(tx, type, step.run_id, payload),
      };
      let outcome: { ok: true; result: Record<string, unknown>; checkpoint: Record<string, unknown> }
        | { ok: false; transient: boolean; error: string };
      try {
        outcome = await runHandler(step.handler, sctx);
      } catch (e) {
        outcome = { ok: false, transient: true, error: e instanceof Error ? e.message : String(e) };
      }

      if (outcome.ok) {
        // CAS write-back: only commit if I STILL hold the lease (lease_token = mine). Prevents
        // double-execute if a slow predecessor resumed. A mismatch discards the write.
        const wrote = await tx.update(workflowStep).set({
          state: "done", checkpoint: outcome.checkpoint, result: outcome.result, leaseToken: null, leaseUntil: null, updatedAt: now,
        }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken))).returning({ id: workflowStep.id });
        if (wrote.length === 0) {
          return { advanced: false, runId: step.run_id, detail: "CAS miss on write-back (lost lease) — discarded" };
        }
        await emitTx(tx, "workflow.step.completed", step.run_id, { runId: step.run_id, seq: step.seq, handler: step.handler });
        return { advanced: true, runId: step.run_id, from: step.run_state, to: "executing", detail: `step ${step.seq} (${step.handler}) done` };
      }

      // ── Step failed. Transient + attempts remain -> schedule a backoff retry (#5). ────────────────
      if (outcome.transient && thisAttempt < step.max_attempts) {
        const backoffMs = backoff(thisAttempt);
        const retryAt = new Date(now.getTime() + backoffMs);
        const wrote = await tx.update(workflowStep).set({
          state: "failed", nextRetryAt: retryAt, error: { message: outcome.error, attempt: thisAttempt }, leaseToken: null, leaseUntil: null, updatedAt: now,
        }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken))).returning({ id: workflowStep.id });
        if (wrote.length === 0) return { advanced: false, detail: "CAS miss on retry write-back" };
        // run STAYS executing (the STEP is 'failed'+nextRetryAt; the run is NOT moved to terminal 'failed'),
        // so the next tick re-leases this 'failed' step UNDER the still-'executing' run — that is the in-process
        // recovery path (it does NOT depend on leasing under a 'failed' RUN, which is now excluded as terminal).
        // mark interrupted so a later success lands in `recovered`.
        await tx.update(workflowRun).set({ wasInterrupted: true, updatedAt: now }).where(eq(workflowRun.id, step.run_id));
        await emitTx(tx, "workflow.step.failed", step.run_id, { runId: step.run_id, seq: step.seq, attempt: thisAttempt, willRetryAt: retryAt.toISOString() });
        return { advanced: true, runId: step.run_id, detail: `step ${step.seq} failed (attempt ${thisAttempt}/${step.max_attempts}) — retry at ${retryAt.toISOString()}` };
      }

      // ── Retries exhausted / non-retryable -> the run fails (terminal). ────────────────────────────
      await tx.update(workflowStep).set({
        state: "failed", error: { message: outcome.error, attempt: thisAttempt, terminal: true }, leaseToken: null, leaseUntil: null, updatedAt: now,
      }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken)));
      await transitionRun(tx, step.run_id, "failed", now, { blockedReason: null });
      await emitTx(tx, "workflow.run.failed", step.run_id, { runId: step.run_id, seq: step.seq, reason: "retries_exhausted" });
      return { advanced: true, runId: step.run_id, from: step.run_state, to: "failed", detail: `step ${step.seq} exhausted retries -> run failed` };
    });
  }

  // ── The verified-loop control (Slice 1). Runs the verifier, evaluates the predicate, branches. ────
  // Called with the verify step ALREADY leased (CAS held). It is engine surface — the ONLY engine pieces are
  // the attempt-bound check + the pure stopCondition predicate (§10.2 "two fields + a back-edge"). The verdict
  // CONTENT comes entirely from the Verifier capability (§10.5: a verifier is a capability, not engine).
  async function runVerifyStep(tx: TxLike, step: LeasedStep, leaseToken: string, now: Date): Promise<TickReport> {
    // resolve the definition step (verifierId / retryBackToSeq / gateSeq are definition config, not DB state).
    const [run] = await tx.select({ definitionKey: workflowRun.definitionKey })
      .from(workflowRun).where(eq(workflowRun.id, step.run_id)).limit(1);
    const def = run ? getDefinition(run.definitionKey) : undefined;
    const defStep = def?.steps[step.seq];
    if (!def || !defStep || !defStep.verifierId || defStep.retryBackToSeq === undefined) {
      return await failVerifyStep(tx, step, leaseToken, now, "verify step misconfigured (no verifierId/retryBackToSeq)");
    }
    const verifier = getVerifier(defStep.verifierId);
    if (!verifier) return await failVerifyStep(tx, step, leaseToken, now, `unknown verifier ${defStep.verifierId}`);
    const rung: VerifierRung = getVerifierRung(defStep.verifierId) ?? "T1";

    // ── ADVISE-vs-GATE (the safety crux, ku-verifier-must-be-evaluated): is the GATING verifier eligible to
    // drive this run to completion? T1/T5 are exempt; a T2-T4 JUDGMENT verifier is eligible ONLY if it has a
    // recorded passing calibration (eval-the-evaluator). An un-calibrated T2-T4 verifier is ADVISE-ONLY. ──
    const gate: GateDecision = gateDecision(defStep.verifierId);

    // the candidate the act step prepared: read it from the act step's checkpoint (PII-free refs). The engine
    // treats this checkpoint as an OPAQUE candidate — it does NOT read its keys. A domain verifier destructures
    // whatever it needs on its OWN side; the engine carries ZERO domain knowledge (ownership boundary).
    const [actStep] = await tx.select({ checkpoint: workflowStep.checkpoint, attempt: workflowStep.attempt, maxAttempts: workflowStep.maxAttempts, state: workflowStep.state })
      .from(workflowStep).where(and(eq(workflowStep.runId, step.run_id), eq(workflowStep.seq, defStep.retryBackToSeq))).limit(1);
    const cp = (actStep?.checkpoint ?? {}) as Record<string, unknown>;

    // ── (1) run the GATING Verifier capability IN-PROCESS (the engine dispatches by id, never embeds logic). ──
    // The candidate is the opaque checkpoint; attempt is the act step's attempt (for a verifier's proof hook).
    const input: VerifierInput = { tx, candidate: cp, attempt: actStep?.attempt ?? 0 };
    let verdict: Verdict;
    try {
      verdict = await verifier(input);
    } catch (e) {
      return await failVerifyStep(tx, step, leaseToken, now, `verifier threw: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── (1b) run OPTIONAL ADVISORY verifiers ALONGSIDE the gating one (run + record, NEVER gate). A not-yet-
    // calibrated judge can shadow/advise safely here — its verdict is recorded but can never affect the loop. ──
    const advisory: Array<{ verifierId: string; rung: VerifierRung; verdict: Verdict }> = [];
    for (const advId of defStep.advisoryVerifierIds ?? []) {
      const advFn = getVerifier(advId);
      if (!advFn) continue; // an unknown advisory verifier is simply skipped (it never gates; nothing to fail-close).
      const advRung = getVerifierRung(advId) ?? "T1";
      let advVerdict: Verdict;
      try { advVerdict = await advFn({ tx, candidate: cp, attempt: actStep?.attempt ?? 0 }); }
      catch (e) { advVerdict = { verdict: "fail", reasons: ["advisory_verifier_threw"] }; void e; }
      advisory.push({ verifierId: advId, rung: advRung, verdict: advVerdict });
      await emitTx(tx, "workflow.verify.advisory", step.run_id, { runId: step.run_id, seq: step.seq, verifierId: advId, rung: advRung, verdict: advVerdict.verdict, reasons: advVerdict.reasons });
    }

    // ── (2) store the Verdict on the verify step (D4) + emit it (observable rung; PII-free coded reasons, S4). ──
    // The stored verdict carries the RUNG + the gate decision + any ADVISORY verdicts (recorded DISTINCTLY from
    // the gating verdict — an advisory verdict never drives the loop). Reuses the existing jsonb verdict column.
    const storedVerdict = {
      ...verdict,
      verifierId: defStep.verifierId, rung,
      gateEligible: gate.eligible, gateReason: gate.reason,
      advisory: advisory.map((a) => ({ verifierId: a.verifierId, rung: a.rung, verdict: a.verdict.verdict, reasons: a.verdict.reasons, advisoryOnly: true })),
    };
    await tx.update(workflowStep).set({ verdict: storedVerdict, updatedAt: now })
      .where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken)));
    await emitTx(tx, "workflow.verify.completed", step.run_id, { runId: step.run_id, seq: step.seq, rung, gateEligible: gate.eligible, verdict: verdict.verdict, reasons: verdict.reasons });

    // ── ADVISE-ONLY FAIL-CLOSED: the gating verifier is a T2-T4 JUDGMENT verifier that is NOT calibrated. Its
    // verdict MUST NOT drive the loop — an un-calibrated judgment can NEVER cause a run to reach `completed`.
    // FAIL-CLOSED CHOICE = ESCALATE-TO-HUMAN: the engine records the advisory verdict and BLOCKS on the human
    // gate (the run NEVER auto-completes/auto-fails on an un-calibrated judgment; a human owns the call). This
    // is preferred over reject-at-registration because it lets the same definition run safely while a judge is
    // still being calibrated (it shadows + escalates instead of refusing to load). The gateSeq human gate is
    // REQUIRED for a non-exempt gating verifier (else there is no fail-closed landing).
    if (!gate.eligible) {
      if (defStep.gateSeq === undefined) {
        return await failVerifyStep(tx, step, leaseToken, now, `gating verifier ${defStep.verifierId} (${rung}) is not calibrated and no human gate configured (fail-closed)`);
      }
      // the verify step completes its job (it ran + advised); the run escalates to the human gate (NOT completed).
      await tx.update(workflowStep).set({
        state: "done", result: { verdict: verdict.verdict, reasons: verdict.reasons, rung, adviseOnly: true, escalated: true }, leaseToken: null, leaseUntil: null, updatedAt: now,
      }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken)));
      await emitTx(tx, "workflow.verify.advise_only", step.run_id, { runId: step.run_id, seq: step.seq, verifierId: defStep.verifierId, rung, reason: gate.reason });
      await blockHumanGate(tx, step.run_id, defStep.gateSeq, { verdict: "needs_improvement", reasons: [...verdict.reasons, "uncalibrated_verifier_escalated"] }, now);
      return { advanced: true, runId: step.run_id, from: step.run_state, to: "blocked", detail: `gating verifier ${rung} not calibrated -> ADVISE-ONLY -> escalated to human gate seq ${defStep.gateSeq} (fail-closed; never auto-completes)` };
    }

    // ── (3) evaluate the declarative stopCondition predicate over the Verdict (PURE; engine-evaluated, D4). ──
    // Reached ONLY when the gating verifier IS gate-eligible (T1/T5 exempt, or a calibrated T2-T4).
    const met = evaluateStopCondition(step.stop_condition, verdict);

    if (met) {
      // STOP: the loop's objective stop condition is satisfied. The verify step completes AND the cap-trip human
      // gate (gateSeq) is SKIPPED — it is a CONDITIONAL escalation step reached ONLY on cap-trip, never on a
      // clean pass. Skipping it (ready->done) lets the run complete without blocking on the irreversible gate.
      const wrote = await tx.update(workflowStep).set({
        state: "done", result: { verdict: verdict.verdict, reasons: verdict.reasons }, leaseToken: null, leaseUntil: null, updatedAt: now,
      }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken))).returning({ id: workflowStep.id });
      if (wrote.length === 0) return { advanced: false, detail: "CAS miss on verify write-back (lost lease)" };
      if (defStep.gateSeq !== undefined) {
        const [gate] = await tx.select({ state: workflowStep.state }).from(workflowStep)
          .where(and(eq(workflowStep.runId, step.run_id), eq(workflowStep.seq, defStep.gateSeq))).limit(1);
        if (gate && gate.state === "ready") {
          assertLegalStepTransition("ready", "done"); // SKIP the conditional gate (clean stop never escalates)
          await tx.update(workflowStep).set({ state: "done", result: { skipped: true, reason: "loop_stopped_clean" }, updatedAt: now })
            .where(and(eq(workflowStep.runId, step.run_id), eq(workflowStep.seq, defStep.gateSeq)));
        }
      }
      await emitTx(tx, "workflow.loop.stopped", step.run_id, { runId: step.run_id, seq: step.seq, reason: "stop_condition_met" });
      return { advanced: true, runId: step.run_id, from: step.run_state, to: "executing", detail: `verify pass -> loop stop (seq ${step.seq}); gate skipped` };
    }

    // ── predicate NOT met -> the bound decides Improve (back-edge) vs CAP TRIP (human gate). ──
    const actAttempt = actStep?.attempt ?? 0;
    const actCap = actStep?.maxAttempts ?? step.max_attempts;
    const capTripped = actAttempt >= actCap;

    if (!capTripped) {
      // IMPROVE: the loop back-edge. Reset BOTH the verify step (done of its judging) and the ACT step to
      // `ready` so the next tick re-leases the act step — a fresh ready->leased lease bumps its attempt (D3),
      // honoring the hard cap. The done->ready re-open IS the loop back-edge: it is whitelisted in BOTH the app
      // validator (LEGAL_STEP_EDGES) and the DB step trigger (0002). assertLegalStepTransition guards it.
      assertLegalStepTransition("leased", "ready"); // the verify step is leased; reset it to ready (back-edge)
      await tx.update(workflowStep).set({ state: "ready", verdict: storedVerdict, leaseToken: null, leaseUntil: null, updatedAt: now })
        .where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken)));
      // IMPROVE-FEEDBACK: on a `needs_improvement` verdict, thread the gating verdict's suggestedImprovement +
      // reasons INTO the act step's next execution so the agent/handler re-executes WITH the feedback (not
      // blind). The engine carries it as an OPAQUE `_feedback` envelope on the act step's checkpoint; the domain
      // handler reads it on its own side. A plain `fail` (no improvement guidance) re-opens cleanly (null
      // checkpoint) exactly as before — so the existing T1 fail->retry loop is byte-for-byte unchanged.
      const feedback = verdict.verdict === "needs_improvement"
        ? { attempt: actAttempt, fromVerifier: defStep.verifierId, rung, verdict: verdict.verdict, reasons: verdict.reasons, suggestedImprovement: verdict.suggestedImprovement ?? null }
        : undefined;
      await reopenActStep(tx, step.run_id, defStep.retryBackToSeq, now, feedback);
      await emitTx(tx, "workflow.loop.retry", step.run_id, { runId: step.run_id, seq: step.seq, actSeq: defStep.retryBackToSeq, attempt: actAttempt, maxAttempts: actCap, verdict: verdict.verdict, reasons: verdict.reasons });
      return { advanced: true, runId: step.run_id, from: step.run_state, to: "executing", detail: `verify fail -> back-edge retry act seq ${defStep.retryBackToSeq} (attempt ${actAttempt}/${actCap})` };
    }

    // ── CAP TRIP -> block on the human-response gate (S3 irreversible: only a human may resolve). ──
    // The verify step completes (its job is done — it reached the bound); the gate step is blocked for a human.
    if (defStep.gateSeq === undefined) {
      return await failVerifyStep(tx, step, leaseToken, now, "cap tripped but no human gate configured");
    }
    await tx.update(workflowStep).set({
      state: "done", result: { verdict: verdict.verdict, reasons: verdict.reasons, capTripped: true }, leaseToken: null, leaseUntil: null, updatedAt: now,
    }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken)));
    await blockHumanGate(tx, step.run_id, defStep.gateSeq, verdict, now);
    return { advanced: true, runId: step.run_id, from: step.run_state, to: "blocked", detail: `cap tripped (act attempt ${actAttempt}/${actCap}) -> blocked on human gate seq ${defStep.gateSeq}` };
  }

  // re-open the act step for the loop back-edge: done -> ready (the whitelisted loop back-edge). The engine is a
  // trusted writer; the act step is reset to ready so the next tick re-leases it (bumping its attempt, D3).
  async function reopenActStep(tx: TxLike, runId: string, seq: number, now: Date, feedback?: Record<string, unknown>): Promise<void> {
    // the act step is `done`; re-open it to `ready`. assertLegalStepTransition guards this in the app; the DB
    // step trigger whitelists done->ready (0002). Idempotent: if already ready, the same-state write is a no-op.
    const [s] = await tx.select({ state: workflowStep.state }).from(workflowStep)
      .where(and(eq(workflowStep.runId, runId), eq(workflowStep.seq, seq))).limit(1);
    if (!s) throw new Error(`act step seq ${seq} not found for back-edge`);
    if (s.state !== "ready") assertLegalStepTransition(s.state as "done", "ready"); // done -> ready loop back-edge
    // IMPROVE-FEEDBACK delivery: the act step's checkpoint is reset (a fresh attempt) but carries the OPAQUE
    // `_feedback` envelope from the rejecting verdict (suggestedImprovement + reasons) so the next execution
    // re-runs WITH the feedback. The engine never reads inside `_feedback` — the domain handler does, on its
    // side. Reuses the existing checkpoint jsonb column (no schema change). Absent feedback = a plain re-open.
    const nextCheckpoint = feedback ? { _feedback: feedback } : null;
    await tx.update(workflowStep).set({ state: "ready", checkpoint: nextCheckpoint, result: null, leaseToken: null, leaseUntil: null, updatedAt: now })
      .where(and(eq(workflowStep.runId, runId), eq(workflowStep.seq, seq)));
  }

  // block the human-response gate step: ready -> blocked + set its correlation key (awaiting_event_id) from the
  // emitted request event, transition the RUN executing -> blocked (R1: emit + set key + block in ONE txn).
  async function blockHumanGate(tx: TxLike, runId: string, gateSeq: number, verdict: Verdict, now: Date): Promise<void> {
    // R1: emit the await-request event FIRST so its id is the correlation key; set awaiting_event_id = that id;
    // transition the step ready->blocked; transition the run executing->blocked — all in this one transaction.
    const [evt] = await tx.insert(outbox).values({
      type: "workflow.gate.requested", aggregateType: "workflow_run", aggregateId: runId,
      payload: { runId, seq: gateSeq, source: "human-response", reasons: verdict.reasons },
    }).returning({ id: outbox.id });
    const eventId = evt!.id;
    const [gate] = await tx.select({ state: workflowStep.state }).from(workflowStep)
      .where(and(eq(workflowStep.runId, runId), eq(workflowStep.seq, gateSeq))).limit(1);
    if (!gate) throw new Error(`gate step seq ${gateSeq} not found`);
    assertLegalStepTransition(gate.state as "ready", "blocked");
    await tx.update(workflowStep).set({ state: "blocked", awaitingEventId: eventId, updatedAt: now })
      .where(and(eq(workflowStep.runId, runId), eq(workflowStep.seq, gateSeq)));
    await transitionRun(tx, runId, "blocked", now, { blockedReason: `step ${gateSeq} awaiting human-response (cap tripped; reasons: ${verdict.reasons.join(",")})` });
    await emitTx(tx, "workflow.step.blocked", runId, { runId, seq: gateSeq, source: "human-response", awaitingEventId: eventId });
    await emitTx(tx, "workflow.escalated", runId, { runId, seq: gateSeq, reason: "cap_tripped_requires_human" });
  }

  // a verify-step internal error -> fail the run (terminal). Releases the lease + records the error (PII-free).
  async function failVerifyStep(tx: TxLike, step: LeasedStep, leaseToken: string, now: Date, error: string): Promise<TickReport> {
    await tx.update(workflowStep).set({
      state: "failed", error: { message: error, terminal: true }, leaseToken: null, leaseUntil: null, updatedAt: now,
    }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken)));
    await transitionRun(tx, step.run_id, "failed", now, { blockedReason: null });
    await emitTx(tx, "workflow.run.failed", step.run_id, { runId: step.run_id, seq: step.seq, reason: "verify_error" });
    return { advanced: true, runId: step.run_id, from: step.run_state, to: "failed", detail: `verify error -> run failed: ${error}` };
  }

  // ── The await-callback control (v1 cross-system primitive). Runs the request handler, then blocks (or, on
  // the callback-before-block race, advances directly). Called with the step ALREADY leased (CAS held). ──
  // The ONLY net-new engine surface: emit-request-in-txn -> block-on-correlation-key, reusing the existing
  // leased->blocked + executing->blocked + blocked->done edges. DOMAIN-FREE: the engine never reads the
  // request payload or the outcome — the handler emits, the optional outcomeArrived hook decides the race.
  async function runAwaitCallbackStep(tx: TxLike, step: LeasedStep, leaseToken: string, thisAttempt: number, now: Date): Promise<TickReport> {
    // S2: the block source the step DECLARED (materialized at plan time). The completer that resolves this step
    // MUST match this source (a 'system-callback' post can never resolve an 'agent-result' step, and vice-versa).
    // Default 'system-callback' (the v1 primitive) preserves the prior behaviour for definitions that omit it.
    const awaitSource = step.await_source ?? "system-callback";
    // ── run the handler — it emits the REQUEST event in-txn (transactional outbox) + returns awaitEventId. ──
    const sctx: StepContext = {
      tx, runId: step.run_id, seq: step.seq, attempt: thisAttempt, checkpoint: step.checkpoint ?? null,
      emit: (type, payload) => emitTx(tx, type, step.run_id, payload),
    };
    let outcome: { ok: true; result: Record<string, unknown>; checkpoint: Record<string, unknown>; awaitEventId?: string }
      | { ok: false; transient: boolean; error: string };
    try {
      outcome = await runHandler(step.handler, sctx);
    } catch (e) {
      outcome = { ok: false, transient: true, error: e instanceof Error ? e.message : String(e) };
    }

    // a failing await-request handler is handled exactly like any other step failure (retry/terminal).
    if (!outcome.ok) {
      if (outcome.transient && thisAttempt < step.max_attempts) {
        const retryAt = new Date(now.getTime() + backoff(thisAttempt));
        const wrote = await tx.update(workflowStep).set({
          state: "failed", nextRetryAt: retryAt, error: { message: outcome.error, attempt: thisAttempt }, leaseToken: null, leaseUntil: null, updatedAt: now,
        }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken))).returning({ id: workflowStep.id });
        if (wrote.length === 0) return { advanced: false, detail: "CAS miss on await-request retry write-back" };
        await tx.update(workflowRun).set({ wasInterrupted: true, updatedAt: now }).where(eq(workflowRun.id, step.run_id));
        await emitTx(tx, "workflow.step.failed", step.run_id, { runId: step.run_id, seq: step.seq, attempt: thisAttempt, willRetryAt: retryAt.toISOString() });
        return { advanced: true, runId: step.run_id, detail: `await-request seq ${step.seq} failed (attempt ${thisAttempt}/${step.max_attempts}) — retry` };
      }
      await tx.update(workflowStep).set({
        state: "failed", error: { message: outcome.error, attempt: thisAttempt, terminal: true }, leaseToken: null, leaseUntil: null, updatedAt: now,
      }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken)));
      await transitionRun(tx, step.run_id, "failed", now, { blockedReason: null });
      await emitTx(tx, "workflow.run.failed", step.run_id, { runId: step.run_id, seq: step.seq, reason: "await_request_failed" });
      return { advanced: true, runId: step.run_id, from: step.run_state, to: "failed", detail: `await-request seq ${step.seq} exhausted -> run failed` };
    }

    // the handler MUST have emitted a request and returned its correlation key (awaitEventId). A misconfigured
    // await-callback handler (no key) is a terminal misconfiguration — fail closed (never block on nothing).
    const eventId = outcome.awaitEventId;
    if (!eventId) {
      await tx.update(workflowStep).set({
        state: "failed", error: { message: "await-callback handler returned no awaitEventId", terminal: true }, leaseToken: null, leaseUntil: null, updatedAt: now,
      }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken)));
      await transitionRun(tx, step.run_id, "failed", now, { blockedReason: null });
      await emitTx(tx, "workflow.run.failed", step.run_id, { runId: step.run_id, seq: step.seq, reason: "await_misconfigured" });
      return { advanced: true, runId: step.run_id, from: step.run_state, to: "failed", detail: `await-callback seq ${step.seq} misconfigured (no awaitEventId) -> run failed` };
    }

    // ── (a) CALLBACK-BEFORE-BLOCK race (R1/N1): record-then-advance-if-waiting. If the app's hook reports the
    // correlated outcome ALREADY arrived (a callback raced ahead of the block), advance leased->done DIRECTLY
    // — do NOT block. No lost/double work: the completer that recorded the outcome found no blocked step (no-op),
    // and the engine picks it up here. Same-txn, CAS-guarded on the lease. ──
    let raced = false;
    if (outcomeArrived) {
      try { raced = await outcomeArrived(tx, eventId); } catch { raced = false; }
    }
    if (raced) {
      assertLegalStepTransition("leased", "done");
      const wrote = await tx.update(workflowStep).set({
        state: "done", result: { ...outcome.result, resolvedBy: awaitSource, race: "callback-before-block" }, checkpoint: outcome.checkpoint,
        awaitSource, awaitingEventId: null, leaseToken: null, leaseUntil: null, updatedAt: now,
      }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken))).returning({ id: workflowStep.id });
      if (wrote.length === 0) return { advanced: false, detail: "CAS miss on await race-advance write-back (lost lease)" };
      // run stays executing (the next tick advances the following step). Emit the completion + a coded marker.
      await emitTx(tx, "workflow.step.completed", step.run_id, { runId: step.run_id, seq: step.seq, source: awaitSource, race: true });
      return { advanced: true, runId: step.run_id, from: step.run_state, to: "executing", detail: `await seq ${step.seq} outcome already arrived -> advanced (callback-before-block race handled)` };
    }

    // ── (b) COMMON CASE: emit done already; set the correlation key + block (leased->blocked, run
    // executing->blocked) in THIS txn. The step holds NO lease while blocked (crash-while-blocked is trivial).
    // The request event was emitted by the handler; awaiting_event_id = its id (R1: emit + set key + block atomic). ──
    assertLegalStepTransition("leased", "blocked");
    const wrote = await tx.update(workflowStep).set({
      state: "blocked", awaitSource, awaitingEventId: eventId, checkpoint: outcome.checkpoint,
      result: outcome.result, leaseToken: null, leaseUntil: null, updatedAt: now,
    }).where(and(eq(workflowStep.id, step.id), eq(workflowStep.leaseToken, leaseToken))).returning({ id: workflowStep.id });
    if (wrote.length === 0) return { advanced: false, detail: "CAS miss on await block write-back (lost lease)" };
    await transitionRun(tx, step.run_id, "blocked", now, { blockedReason: `step ${step.seq} (${step.handler}) awaiting ${awaitSource} (eventId ${eventId})` });
    await emitTx(tx, "workflow.step.blocked", step.run_id, { runId: step.run_id, seq: step.seq, source: awaitSource, awaitingEventId: eventId });
    return { advanced: true, runId: step.run_id, from: step.run_state, to: "blocked", detail: `await-callback seq ${step.seq} -> blocked on ${awaitSource} (eventId ${eventId})` };
  }

  // All steps done -> completed, or recovered if the run was ever interrupted/failed (#5 proof state).
  async function maybeCompleteRun(tx: TxLike, now: Date): Promise<TickReport> {
    const picked = await tx.execute(dsql`
      SELECT r.id, r.state, r.was_interrupted
      FROM workflow_run r
      WHERE r.state IN ('planned','executing')
        AND NOT EXISTS (SELECT 1 FROM workflow_step s WHERE s.run_id = r.id AND s.state <> 'done')
        AND EXISTS (SELECT 1 FROM workflow_step s WHERE s.run_id = r.id)
      ORDER BY r.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1`);
    const rows = picked as unknown as Array<{ id: string; state: RunState; was_interrupted: boolean }>;
    if (rows.length === 0) return { advanced: false };
    const run = rows[0]!;
    // A planned run with all steps done but never executed is a no-op edge case; force through executing.
    if (run.state === "planned") {
      await transitionRun(tx, run.id, "executing", now, {});
    }
    const terminal: RunState = run.was_interrupted ? "recovered" : "completed";
    await transitionRun(tx, run.id, terminal, now, { terminalAt: now });
    await emitTx(tx, terminal === "recovered" ? "workflow.run.recovered" : "workflow.run.completed", run.id, { runId: run.id });
    return { advanced: true, runId: run.id, from: "executing", to: terminal, detail: `run ${terminal}` };
  }

  // transitionRun — fail-closed legal-edge check in the APP before the DB trigger backstop fires.
  async function transitionRun(tx: TxLike, runId: string, to: RunState, now: Date, extra: Partial<{ wasInterrupted: boolean; blockedReason: string | null; terminalAt: Date }>): Promise<void> {
    const [cur] = await tx.select({ state: workflowRun.state }).from(workflowRun).where(eq(workflowRun.id, runId)).limit(1);
    if (!cur) throw new Error(`run ${runId} not found`);
    const from = cur.state as RunState;
    if (from === to) {
      // bookkeeping-only update (allowed by the DB trigger's same-state branch).
      if (Object.keys(extra).length > 0) await tx.update(workflowRun).set({ ...extra, updatedAt: now }).where(eq(workflowRun.id, runId));
      return;
    }
    assertLegalRunTransition(from, to); // app fail-closed; DB trigger is the backstop.
    await tx.update(workflowRun).set({ state: to, ...extra, updatedAt: now }).where(eq(workflowRun.id, runId));
  }

  // Transactional outbox emit — same txn as the state write. PII-free.
  async function emitTx(tx: TxLike, type: string, runId: string, payload: Record<string, unknown>): Promise<void> {
    await tx.insert(outbox).values({ type, aggregateType: "workflow_run", aggregateId: runId, payload });
  }

  return { enqueue, tick };
}

// the leased verify step row shape (read from the lease query).
type LeasedStep = {
  id: string; run_id: string; seq: number; attempt: number; max_attempts: number;
  effect: StepEffect; handler: string; checkpoint: Record<string, unknown> | null;
  stop_condition: StopCondition | null; await_source: string | null;
  step_state: string; run_state: RunState; was_interrupted: boolean;
};

// the PURE stopCondition predicate (D4) — the ONLY loop decision the engine itself makes. No DSL.
export function evaluateStopCondition(cond: StopCondition | null, verdict: Verdict): boolean {
  if (!cond) return verdict.verdict === "pass"; // default: stop on pass
  switch (cond.kind) {
    case "verdict-equals":
      return verdict.verdict === cond.value;
    default:
      return false;
  }
}

// Exponential backoff with jitter (ms). attempt is 1-based.
function backoff(attempt: number): number {
  const base = Math.min(1000 * 2 ** (attempt - 1), 30_000);
  return Math.round(base * (0.5 + Math.random() * 0.5));
}

// Unique-violation (pg 23505) detection that is robust to query-layer wrapping. The current Drizzle
// version wraps the underlying pg error in a DrizzleQueryError whose own `.code` is undefined and carries
// the real driver code under `.cause` (`e.cause.code === '23505'`). A top-level-only check therefore MISSES
// the violation and the catch site (e.g. enqueue's idempotent SELECT-and-return) is never reached — the
// error re-throws and a legit idempotent retry surfaces as a bare 500. Walk the `.cause` chain defensively
// (finite depth, cycle-guarded) so the guarantee survives the wrapping. Mirrors goals-route's pgCode().
export function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let depth = 0; depth < 8 && cur !== null && typeof cur === "object"; depth++) {
    if ((cur as { code?: unknown }).code === "23505") return true;
    const next = (cur as { cause?: unknown }).cause;
    if (next === cur) break; // defensive cycle guard
    cur = next;
  }
  return false;
}

export type { WorkflowDefinition };
