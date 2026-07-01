// Human-response gate completer — POST /approvals (Slice 1). PORTABILIZED as a router FACTORY.
// The GENERALIZED completer for the human-response source. It resolves a BLOCKED workflow step by
// awaiting_event_id and advances it blocked->done, with the run blocked->executing, IN ONE TRANSACTION.
//
// OWNERSHIP BOUNDARY: createApprovalsRoute({ db, tables, humanPrincipal }) injects the app's Drizzle client
// + its run/step/outbox/approval-audit table objects + its HumanPrincipalPort impl. The engine imports ZERO
// concrete app infra (no app db client, no app schema, no app auth module) — it declares the shape, the app
// supplies it.
//
// SECURITY (the human gate is load-bearing — NOT presence-only theater):
//   S1: a VERIFIED HUMAN principal (humanPrincipal.requireHuman: real session JWT + the gate scope; a
//       service/agent token is rejected by construction). Bound to run+step+actionId. SINGLE-USE (the
//       action_id UNIQUE index CAS-consumes it). An APPEND-ONLY durable audit row is written in the SAME
//       transaction as the advance — FAIL-CLOSED: if the audit insert fails, the txn rolls back, gate stays shut.
//   S2: per-source match — the step's await_source MUST be 'human-response' (a callback may only resolve a step
//       awaiting its own source). A step awaiting any other source is 404 to this human endpoint.
//   S3: irreversible => human only — this endpoint IS the human (T5) verifier; the engine left the
//       irreversible gate step blocked (no-spawn discipline) and only this human path resolves it.
//
// CORRELATION / RACE (R1): the match is on awaiting_event_id FIRST, state='blocked' SECOND (CAS). The
// UNIQUE partial index on awaiting_event_id makes the match unambiguous; the action_id UNIQUE index makes a
// duplicate callback an idempotent no-op. A blocked step holds NO lease, so crash-while-blocked is trivially
// resumable. Callback-before-block: the gate sets awaiting_event_id BEFORE it is reachable as a callback (the
// engine emits the request event + sets the key + blocks in ONE txn), so a callback can never beat the key.
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { ApprovalCallbackV1, ApprovalCallbackResponseV1 } from "./contracts/approvals-v1.js";
import { assertLegalStepTransition, assertLegalRunTransition } from "./state-machine.js";
import { WORKFLOW_SCOPES, type HumanPrincipalPort, type Principal } from "./human-principal.js";
import type { DbLike, EngineTables } from "./engine.js";

export interface ApprovalsRouteContext {
  db: DbLike;
  tables: EngineTables & { workflowApprovalAudit: any };
  humanPrincipal: HumanPrincipalPort;
  // the scope the human gate requires (default: workflow:admin — gate-resolution is a management action).
  requiredScope?: string;
}

export function createApprovalsRoute(ctx: ApprovalsRouteContext): Hono<{ Variables: { principal: Principal } }> {
  const { db } = ctx;
  const { workflowStep, workflowRun, workflowApprovalAudit, outbox } = ctx.tables;
  const requiredScope = ctx.requiredScope ?? WORKFLOW_SCOPES.admin;

  const approvalsApi = new Hono<{ Variables: { principal: Principal } }>();
  // S1/S2: the human-principal gate is the ONLY auth on this completer.
  approvalsApi.use("/approvals", ctx.humanPrincipal.requireHuman(requiredScope));

  // G5 — PENDING-APPROVALS LISTING (the founder approvals inbox). A step BLOCKED awaiting 'human-response' IS
  // a pending approval; before this there was no way to enumerate them (only workflow.gate.resolved on exit).
  // PII-free: returns ID/coded refs only (runId, seq, awaitingEventId, stepType, owner, updatedAt) — the caller
  // resolves detail via GET /workflow/runs/:id (which now carries the verdict, G4). Gated by the same human
  // principal as POST /approvals (the inbox is a management view).
  approvalsApi.get("/approvals", async (c) => {
    const pending = await db
      .select({
        runId: workflowStep.runId, seq: workflowStep.seq, awaitingEventId: workflowStep.awaitingEventId,
        stepType: workflowStep.stepType, owner: workflowStep.owner, updatedAt: workflowStep.updatedAt,
      })
      .from(workflowStep)
      .where(and(eq(workflowStep.state, "blocked"), eq(workflowStep.awaitSource, "human-response")));
    return c.json({ data: { pending, count: pending.length } });
  });

  approvalsApi.post("/approvals", async (c) => {
    const parsed = ApprovalCallbackV1.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) {
      return c.json({ error: { code: "bad_request", message: "invalid approval callback", issues: parsed.error.issues } }, 400);
    }
    const body = parsed.data;
    const principal = c.get("principal");

    try {
      const result = await db.transaction(async (tx) => {
        // ── S1 single-use idempotency (FIRST): if this actionId was already consumed, this is a duplicate
        // callback. Return idempotent WITHOUT re-resolving (the prior call did the work + cleared the key). ──
        const [prior] = await tx
          .select({ runId: workflowApprovalAudit.runId, stepSeq: workflowApprovalAudit.stepSeq })
          .from(workflowApprovalAudit)
          .where(eq(workflowApprovalAudit.actionId, body.actionId))
          .limit(1);
        if (prior) {
          const [run] = await tx.select({ state: workflowRun.state }).from(workflowRun).where(eq(workflowRun.id, prior.runId)).limit(1);
          return { kind: "idempotent" as const, runId: prior.runId, seq: prior.stepSeq, runState: run?.state ?? "unknown" };
        }

        // ── match the blocked step by awaiting_event_id FIRST (R1), then validate run/step/source binding. ──
        const [step] = await tx
          .select({ id: workflowStep.id, runId: workflowStep.runId, seq: workflowStep.seq, state: workflowStep.state, awaitSource: workflowStep.awaitSource, awaitingEventId: workflowStep.awaitingEventId })
          .from(workflowStep)
          .where(eq(workflowStep.awaitingEventId, body.awaitingEventId))
          .limit(1);

        if (!step) return { kind: "not_found" as const };
        // S1 binding: the callback's run+step MUST match the step the awaiting_event_id points at.
        if (step.runId !== body.runId || step.seq !== body.seq) return { kind: "binding_mismatch" as const };
        // S2 source match: only a human-response gate may be resolved by this human endpoint.
        if (step.awaitSource !== "human-response") return { kind: "source_mismatch" as const, source: step.awaitSource };

        // ── S1 single-use + fail-CLOSED audit: write the append-only audit row FIRST, in THIS txn. The
        // action_id UNIQUE index makes a replay raise 23505 -> idempotent no-op. If this insert fails for
        // ANY reason, the transaction rolls back and the gate does NOT open (the advance below never commits). ──
        await tx.insert(workflowApprovalAudit).values({
          runId: step.runId, stepSeq: step.seq, awaitingEventId: body.awaitingEventId, actionId: body.actionId,
          decision: body.decision, actorSub: principal.sub, actorEmail: principal.email ?? null, actorRole: principal.role,
        });

        // ── CAS advance: ONLY if the step is still blocked (someone else may have resolved it first). ──
        if (step.state !== "blocked") {
          throw new CasLost();
        }

        if (body.decision === "approve") {
          // blocked -> done (the COMPLETER's cross-process advance, D2); run blocked -> executing (R1).
          assertLegalStepTransition("blocked", "done");
          const wrote = await tx.update(workflowStep)
            .set({ state: "done", result: { resolvedBy: "human-response", decision: "approve", actionId: body.actionId }, awaitingEventId: null, updatedAt: new Date() })
            .where(and(eq(workflowStep.id, step.id), eq(workflowStep.state, "blocked"))) // CAS: state still blocked
            .returning({ id: workflowStep.id });
          if (wrote.length === 0) throw new CasLost();
          assertLegalRunTransition("blocked", "executing");
          await tx.update(workflowRun).set({ state: "executing", blockedReason: null, updatedAt: new Date() }).where(eq(workflowRun.id, step.runId));
          await tx.insert(outbox).values({ type: "workflow.gate.resolved", aggregateType: "workflow_run", aggregateId: step.runId, payload: { runId: step.runId, seq: step.seq, decision: "approve", source: "human-response" } });
        } else {
          // reject: blocked -> failed (the await escalated to terminal failure); run blocked -> failed.
          assertLegalStepTransition("blocked", "failed");
          const wrote = await tx.update(workflowStep)
            .set({ state: "failed", error: { resolvedBy: "human-response", decision: "reject", actionId: body.actionId }, awaitingEventId: null, updatedAt: new Date() })
            .where(and(eq(workflowStep.id, step.id), eq(workflowStep.state, "blocked")))
            .returning({ id: workflowStep.id });
          if (wrote.length === 0) throw new CasLost();
          assertLegalRunTransition("blocked", "failed");
          await tx.update(workflowRun).set({ state: "failed", blockedReason: "rejected by human gate", terminalAt: new Date(), updatedAt: new Date() }).where(eq(workflowRun.id, step.runId));
          await tx.insert(outbox).values({ type: "workflow.gate.resolved", aggregateType: "workflow_run", aggregateId: step.runId, payload: { runId: step.runId, seq: step.seq, decision: "reject", source: "human-response" } });
        }

        const [run] = await tx.select({ state: workflowRun.state }).from(workflowRun).where(eq(workflowRun.id, step.runId)).limit(1);
        return { kind: "resolved" as const, runId: step.runId, seq: step.seq, runState: run!.state };
      });

      if (result.kind === "not_found") return c.json({ error: { code: "not_found", message: "no blocked step awaits this awaitingEventId" } }, 404);
      if (result.kind === "binding_mismatch") return c.json({ error: { code: "bad_request", message: "runId/seq do not match the awaiting step (binding mismatch)" } }, 400);
      if (result.kind === "source_mismatch") return c.json({ error: { code: "not_found", message: `step await_source is '${result.source}', not human-response (per-source match)` } }, 404);
      if (result.kind === "idempotent") {
        const out = ApprovalCallbackResponseV1.parse({ data: { runId: result.runId, seq: result.seq, status: "idempotent", runState: result.runState } });
        return c.json(out, 200);
      }

      const out = ApprovalCallbackResponseV1.parse({ data: { runId: result.runId, seq: result.seq, status: "resolved", runState: result.runState } });
      return c.json(out, 200);
    } catch (e) {
      // ── S1 single-use idempotency: a replayed actionId raises 23505 on the UNIQUE index. The whole txn
      // rolled back (including any advance) — the FIRST call's advance already committed; this is a safe no-op. ──
      const code = (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") {
        const [existing] = await db.select({ runId: workflowApprovalAudit.runId, stepSeq: workflowApprovalAudit.stepSeq })
          .from(workflowApprovalAudit).where(eq(workflowApprovalAudit.actionId, (await safeBody(c)).actionId ?? "")).limit(1);
        if (existing) {
          const [run] = await db.select({ state: workflowRun.state }).from(workflowRun).where(eq(workflowRun.id, existing.runId)).limit(1);
          const out = ApprovalCallbackResponseV1.parse({ data: { runId: existing.runId, seq: existing.stepSeq, status: "idempotent", runState: run?.state ?? "unknown" } });
          return c.json(out, 200);
        }
        return c.json({ data: { status: "idempotent" } }, 200);
      }
      if (e instanceof CasLost) {
        return c.json({ error: { code: "conflict", message: "step is no longer blocked (already resolved)" } }, 409);
      }
      throw e;
    }
  });

  return approvalsApi;
}

// a sentinel to roll back the txn when the CAS advance loses (the step left `blocked` under us).
class CasLost extends Error {}

// re-read the request body defensively for the idempotent branch (Hono caches the parsed json). PII-free.
async function safeBody(c: { req: { json: () => Promise<unknown> } }): Promise<{ actionId?: string }> {
  try {
    const b = (await c.req.json()) as { actionId?: string };
    return { actionId: b?.actionId };
  } catch {
    return {};
  }
}
