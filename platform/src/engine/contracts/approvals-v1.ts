// Human-response gate — v1 ingest contract (Slice 1, §11 2026-06-22 S1/S4). The human-gate completer's
// inbound body. The UNIFORM callback contract (EXECUTION-MODEL §3) specialised to the human-response source.
// Validated .strict() so unknown keys 400 (no drift). PII-FREE (S4): refs + a coded decision only — NO free
// text rationale (free-text rationale stays in the consuming app / the UI; never crosses this seam).
import { z } from "zod";

export const ApprovalCallbackV1 = z
  .object({
    // the correlation key = the workflow_step.awaiting_event_id the gate set when it blocked (R1).
    awaitingEventId: z.string().uuid(),
    // run + step binding (S1): the callback must name the exact run+step it resolves. Defence-in-depth on top
    // of awaitingEventId (which already pins both) — a mismatch is rejected.
    runId: z.string().uuid(),
    seq: z.number().int().nonnegative(),
    // the single-use action/candidate id (S1): the specific decision being consumed. Bound + CAS-consumed.
    actionId: z.string().min(1).max(200),
    // the human verdict. PII-FREE coded enum (S4) — no free-text reason field exists on this contract.
    decision: z.enum(["approve", "reject"]),
  })
  .strict();

export const ApprovalCallbackResponseV1 = z
  .object({
    data: z
      .object({
        runId: z.string().uuid(),
        seq: z.number().int().nonnegative(),
        // resolved = the gate advanced this call; idempotent = a prior identical call already resolved it.
        status: z.enum(["resolved", "idempotent"]),
        // the resulting run state after the advance (executing/blocked/...): a FACT, not a ranking.
        runState: z.string(),
      })
      .strict(),
  })
  .strict();

export type ApprovalCallbackV1 = z.infer<typeof ApprovalCallbackV1>;
export type ApprovalCallbackResponseV1 = z.infer<typeof ApprovalCallbackResponseV1>;
