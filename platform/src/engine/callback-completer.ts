// Workflow Engine — the GENERIC system-callback completer (v1 cross-system primitive).
// The app calls completeAwaitingStep() from INSIDE its own domain-callback transaction (e.g. the delivery
// ingest). It resolves a BLOCKED workflow step whose awaiting_event_id === eventId AND await_source ===
// 'system-callback', advancing it blocked->done + the run blocked->executing, CAS-guarded, in the CALLER's
// txn. It is IDEMPOTENT by construction: already-advanced (no longer blocked) or no-match (eventId unknown)
// is a NO-OP — it never throws, never double-advances. The blocked->executing resume is then picked up by
// the next engine tick (the following step runs and consumes this step's recorded outcome).
//
// OWNERSHIP BOUNDARY: this is GENERIC engine mechanism. It knows NOTHING of delivery/invoice/any domain — it
// matches on the opaque correlation key (eventId) + the await_source enum value, and records the app's opaque
// `outcome` object onto the step's result. The app supplies its EngineTables (run/step) + the txn handle.
//
// SHARED SHAPE with the human-response completer (approvals-route.ts): both find a blocked step by
// awaiting_event_id, CAS-advance blocked->done + run blocked->executing, in ONE txn. The human path ADDS the
// verified-principal gate + the single-use append-only audit + the reject branch (an irreversible human
// decision); this system path is the unattended sibling for a 'system-callback' source. The two are kept
// SEPARATE per S2 least-privilege (a system callback may NEVER resolve a human-response gate, and vice
// versa) — the source match here (await_source === 'system-callback') enforces that boundary by construction.

import { and, eq } from "drizzle-orm";
import { assertLegalRunTransition, assertLegalStepTransition } from "./state-machine.js";
import type { EngineTables, TxLike } from "./engine.js";

export type CompleteAwaitingResult =
  | { kind: "advanced"; runId: string; seq: number } // the step was blocked -> now done; run -> executing
  | { kind: "noop"; reason: "no_match" | "not_blocked" | "source_mismatch" }; // idempotent / nothing to do

export interface CompleteAwaitingArgs {
  eventId: string; // the correlation key the inbound callback carried (the request event id, awaiting_event_id)
  outcome?: Record<string, unknown>; // OPAQUE app outcome recorded onto the step result (PII-free refs only)
  awaitSource?: string; // the source this completer is authorized for (default: 'system-callback', S2)
}

// Advance the blocked step awaiting `eventId`. MUST be called inside the caller's transaction so the advance
// commits ATOMICALLY with whatever the app wrote in the same txn (e.g. the idempotent delivery insert) — the
// callback's record + the workflow resume are one unit (R1). Returns a coded result; NEVER throws on a
// missing/already-resolved step (idempotent no-op).
export async function completeAwaitingStep(
  tx: TxLike,
  tables: Pick<EngineTables, "workflowRun" | "workflowStep">,
  args: CompleteAwaitingArgs,
): Promise<CompleteAwaitingResult> {
  const { workflowRun, workflowStep } = tables;
  const source = args.awaitSource ?? "system-callback";

  // match the step by the UNIQUE correlation key first (awaiting_event_id). The 0002 UNIQUE partial index
  // makes this match unambiguous; a duplicate callback can hit AT MOST one row.
  const [step] = await tx
    .select({ id: workflowStep.id, runId: workflowStep.runId, seq: workflowStep.seq, state: workflowStep.state, awaitSource: workflowStep.awaitSource })
    .from(workflowStep)
    .where(eq(workflowStep.awaitingEventId, args.eventId))
    .limit(1);

  // no blocked step awaits this eventId. Either the eventId is unknown, OR a prior callback already advanced
  // it (which CLEARED awaiting_event_id). Both are idempotent no-ops — the duplicate-callback safety floor.
  if (!step) return { kind: "noop", reason: "no_match" };
  // S2 least-privilege: this completer may ONLY resolve its own source. A human-response gate is NEVER
  // resolvable here (it must go through the verified-human approvals path).
  if (step.awaitSource !== source) return { kind: "noop", reason: "source_mismatch" };
  // already advanced under us (a concurrent callback won) — idempotent no-op (no double Step-2).
  if (step.state !== "blocked") return { kind: "noop", reason: "not_blocked" };

  // CAS advance: blocked -> done ONLY if still blocked (guards the duplicate/concurrent callback). Clears the
  // correlation key so a later callback for the same eventId finds nothing (no re-open).
  assertLegalStepTransition("blocked", "done");
  const wrote = await tx
    .update(workflowStep)
    .set({
      state: "done",
      result: { resolvedBy: source, ...(args.outcome ?? {}) },
      awaitingEventId: null,
      updatedAt: new Date(),
    })
    .where(and(eq(workflowStep.id, step.id), eq(workflowStep.state, "blocked"))) // CAS: still blocked
    .returning({ id: workflowStep.id });
  if (wrote.length === 0) return { kind: "noop", reason: "not_blocked" }; // lost the CAS race — idempotent

  // resume the run: blocked -> executing (the next engine tick advances the following step). Same-state runs
  // (already executing because another of its steps advanced) are tolerated — only flip if still blocked.
  const [run] = await tx.select({ state: workflowRun.state }).from(workflowRun).where(eq(workflowRun.id, step.runId)).limit(1);
  if (run && run.state === "blocked") {
    assertLegalRunTransition("blocked", "executing");
    await tx.update(workflowRun).set({ state: "executing", blockedReason: null, updatedAt: new Date() }).where(eq(workflowRun.id, step.runId));
  }

  return { kind: "advanced", runId: step.runId, seq: step.seq };
}
