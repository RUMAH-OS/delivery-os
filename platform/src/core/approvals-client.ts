// APPROVALS API CLIENT — a thin HTTP client over the Delivery OS human-gate surface (the founder approvals
// inbox). PLATFORM BOUNDARY: imports NOTHING from rumah-admin/PLOS source — HTTP only, two endpoints:
//   - GET  {baseUrl}/v1/approvals            (G5 listing; gated by the VERIFIED-HUMAN principal) — listPending()
//   - POST {baseUrl}/v1/approvals            (resolve a blocked human gate; verified-human only)  — resolve()
//
// AUTH (load-bearing): both endpoints require a verified-HUMAN JWT carrying workflow:admin. The engine REJECTS
// machine roles by construction (human-principal.ts), so this client MUST be given a human operator token —
// NEVER the worker's service token. Keep it separate from GoalsClient's service token.
//
// HONEST FAILURE: every non-2xx is surfaced as a typed { kind:'error', status, message } — never a silent ok.

import { z } from "zod";

export interface ApprovalsClientConfig {
  baseUrl: string; // same mount as the engine, e.g. https://<engine-mount>.example (or .../api for a consumer)
  humanToken: string; // a VERIFIED-HUMAN JWT with workflow:admin — NOT the service token
  fetchImpl?: typeof fetch; // injectable for tests; defaults to global fetch
}

// One pending approval, as G5's listing projects it (IDs/coded refs only — PII-free).
const PendingApprovalSchema = z.object({
  runId: z.string(),
  seq: z.number(),
  awaitingEventId: z.string().nullable(),
  stepType: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  updatedAt: z.unknown().optional(),
});
export type PendingApproval = z.infer<typeof PendingApprovalSchema>;

const PendingListSchema = z.object({
  pending: z.array(PendingApprovalSchema),
  count: z.number(),
});

export type Decision = "approve" | "reject";

export type ListResult =
  | { kind: "ok"; pending: PendingApproval[]; count: number }
  | { kind: "error"; status: number; message: string };

export type ResolveResult =
  | { kind: "resolved"; runId: string; seq: number; runState: string }
  | { kind: "idempotent"; runId: string; seq: number; runState: string } // a replayed actionId — safe no-op
  | { kind: "conflict"; message: string } // the step is no longer blocked (already resolved) — 409
  | { kind: "not-found"; message: string } // no blocked step awaits this awaitingEventId — 404
  | { kind: "error"; status: number; message: string };

export class ApprovalsClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly doFetch: typeof fetch;

  constructor(cfg: ApprovalsClientConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.token = cfg.humanToken;
    this.doFetch = cfg.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    return { "content-type": "application/json", authorization: `Bearer ${this.token}` };
  }

  // GET /v1/approvals — the founder inbox: every run blocked awaiting a human decision (G5). PII-free.
  async listPending(): Promise<ListResult> {
    let res: Response;
    try {
      res = await this.doFetch(`${this.baseUrl}/v1/approvals`, { method: "GET", headers: this.headers() });
    } catch (e) {
      return { kind: "error", status: 0, message: `network error: ${e instanceof Error ? e.message : String(e)}` };
    }
    const body = await res.json().catch(() => null as unknown);
    if (res.status !== 200) {
      const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
      return { kind: "error", status: res.status, message: msg };
    }
    const parsed = PendingListSchema.safeParse((body as { data?: unknown } | null)?.data);
    if (!parsed.success) return { kind: "error", status: 200, message: `unexpected approvals body: ${parsed.error.message}` };
    return { kind: "ok", pending: parsed.data.pending, count: parsed.data.count };
  }

  // POST /v1/approvals — resolve a blocked human gate. `actionId` is the SINGLE-USE idempotency key (e.g. the
  // Slack interaction id) so a double-click / Slack retry is a safe no-op, not a double-resolve.
  async resolve(args: {
    runId: string;
    seq: number;
    awaitingEventId: string;
    actionId: string;
    decision: Decision;
  }): Promise<ResolveResult> {
    let res: Response;
    try {
      res = await this.doFetch(`${this.baseUrl}/v1/approvals`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(args),
      });
    } catch (e) {
      return { kind: "error", status: 0, message: `network error: ${e instanceof Error ? e.message : String(e)}` };
    }
    const body = await res.json().catch(() => null as unknown);
    const data = (body as { data?: unknown } | null)?.data as
      | { runId?: string; seq?: number; status?: string; runState?: string }
      | undefined;

    if (res.status === 200) {
      const status = data?.status;
      const runId = typeof data?.runId === "string" ? data.runId : args.runId;
      const seq = typeof data?.seq === "number" ? data.seq : args.seq;
      const runState = typeof data?.runState === "string" ? data.runState : "unknown";
      if (status === "idempotent") return { kind: "idempotent", runId, seq, runState };
      if (status === "resolved") return { kind: "resolved", runId, seq, runState };
      return { kind: "error", status: 200, message: `unexpected resolve body: ${JSON.stringify(body)}` };
    }
    if (res.status === 409) return { kind: "conflict", message: "step is no longer blocked (already resolved)" };
    if (res.status === 404) return { kind: "not-found", message: "no blocked step awaits this approval" };
    const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    return { kind: "error", status: res.status, message: msg };
  }
}
