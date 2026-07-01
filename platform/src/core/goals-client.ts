// GOALS API CLIENT — a thin HTTP client over the Delivery OS goal surface (hosted in rumah-admin).
// THE PLATFORM BOUNDARY: this file (and this whole project) imports NOTHING from rumah-admin/PLOS source.
// It speaks HTTP to two endpoints, gated by a bearer token:
//   - POST {GOALS_API_URL}/v1/goals             (scope workflow:runtime — submit a goal, front of the chain)
//   - GET  {GOALS_API_URL}/v1/workflow/runs/:id (scope workflow:observe — read the run's current state)
//
// HONEST FAILURE: the goal route is fail-closed. A goal that routes to a run -> 201/200 {kind:'enqueued',...};
// a goal that matched nothing -> 422 {kind:'no-match'}; a goal that matched >1 capability -> 422
// {kind:'ambiguous',candidates}. We surface those AS-IS. A 4xx/5xx we did not model -> a typed error result,
// never a silent success.

import { z } from "zod";

// ── Config (env-driven; the shell passes these through; the proof injects a base URL directly). ──
export interface GoalsClientConfig {
  baseUrl: string; // e.g. https://rumah-admin.vercel.app  (or http://127.0.0.1:8788 in the proof)
  token: string; // a bearer token carrying workflow:runtime + workflow:observe
  fetchImpl?: typeof fetch; // injectable for tests; defaults to global fetch
}

// ── The goal a caller submits (intent / text / payload — NOT a hand-picked definitionKey). ──
export interface Goal {
  intent?: string;
  text?: string;
  payload?: Record<string, unknown>;
  // a stable idempotency key (the Slack command/event id) so a Slack retry does not double-run.
  idempotencyKey?: string;
}

// ── submitGoal result — mirrors the goal route's tagged union, plus a transport-error variant. ──
export type SubmitResult =
  | { kind: "enqueued"; runId: string; definitionKey: string; created: boolean }
  | { kind: "no-match" }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "error"; status: number; message: string };

// ── A run + its steps, as the read route projects it (PII-free). As of engine G4 the read route now surfaces
// the verifier verdict: a top-level `verify` summary (from the engine.verify step) + a CODED per-step `verdict`
// subset. Both are OPTIONAL here (backward-compatible: a pre-G4 mount omits them, and `verify` is null until the
// verify step runs). When present we show the REAL verdict; when absent we fall back to deriving it from the
// terminal run state (deriveVerdict in handle-goal.ts), honestly labelled. ──
const VerdictSubsetSchema = z.object({
  verdict: z.string().nullable(),
  reasons: z.array(z.string()).optional(),
  rung: z.string().nullable().optional(),
});
const RunStepSchema = z.object({
  seq: z.number(),
  state: z.string(),
  stepType: z.string(),
  owner: z.string().nullable().optional(),
  handler: z.string().nullable().optional(),
  effect: z.string().nullable().optional(),
  attempt: z.number().nullable().optional(),
  maxAttempts: z.number().nullable().optional(),
  nextRetryAt: z.unknown().optional(),
  verdict: VerdictSubsetSchema.nullable().optional(), // G4 per-step coded verdict
});
// G4 top-level verify summary (from the engine.verify step). Null until the verify step has run.
const VerifySummarySchema = z.object({
  verdict: z.string().nullable(),
  reasons: z.array(z.string()).optional(),
  rung: z.string().nullable().optional(),
  verifierId: z.string().nullable().optional(),
  gateEligible: z.boolean().nullable().optional(),
  gateReason: z.string().nullable().optional(),
});
const RunSchema = z.object({
  id: z.string(),
  definitionKey: z.string(),
  state: z.string(),
  attempt: z.number().nullable().optional(),
  wasInterrupted: z.boolean().nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  terminalAt: z.unknown().optional(),
  verify: VerifySummarySchema.nullable().optional(), // G4
  steps: z.array(RunStepSchema),
});
export type VerifySummary = z.infer<typeof VerifySummarySchema>;
export type Run = z.infer<typeof RunSchema>;
export type RunStep = z.infer<typeof RunStepSchema>;

export type AwaitResult =
  | { kind: "terminal"; run: Run }
  | { kind: "timeout"; run: Run | null }
  | { kind: "error"; status: number; message: string };

// terminal run states (no further engine progress without an external event).
const TERMINAL_STATES = new Set(["completed", "failed", "recovered", "cancelled"]);

export class GoalsClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly doFetch: typeof fetch;

  constructor(cfg: GoalsClientConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.token = cfg.token;
    this.doFetch = cfg.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    return { "content-type": "application/json", authorization: `Bearer ${this.token}` };
  }

  // POST /v1/goals — submit a goal. Returns the honest selection result (enqueued | no-match | ambiguous | error).
  async submitGoal(goal: Goal): Promise<SubmitResult> {
    let res: Response;
    try {
      res = await this.doFetch(`${this.baseUrl}/v1/goals`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(goal),
      });
    } catch (e) {
      return { kind: "error", status: 0, message: `network error: ${e instanceof Error ? e.message : String(e)}` };
    }

    const body = await res.json().catch(() => null as unknown);
    const data = (body as { data?: unknown } | null)?.data;

    // 201 (created) or 200 (idempotent hit) -> enqueued. 422 -> no-match / ambiguous (fail-closed, NO run).
    if (res.status === 201 || res.status === 200) {
      const d = data as { kind?: string; runId?: string; definitionKey?: string } | undefined;
      if (d?.kind === "enqueued" && typeof d.runId === "string" && typeof d.definitionKey === "string") {
        return { kind: "enqueued", runId: d.runId, definitionKey: d.definitionKey, created: res.status === 201 };
      }
      return { kind: "error", status: res.status, message: `unexpected enqueue body: ${JSON.stringify(body)}` };
    }
    if (res.status === 422) {
      const d = data as { kind?: string; candidates?: unknown } | undefined;
      if (d?.kind === "no-match") return { kind: "no-match" };
      if (d?.kind === "ambiguous") {
        const candidates = Array.isArray(d.candidates) ? d.candidates.map(String) : [];
        return { kind: "ambiguous", candidates };
      }
      return { kind: "error", status: 422, message: `unexpected 422 body: ${JSON.stringify(body)}` };
    }
    // any other status (400 bad goal, 401/403 auth, 409 conflict, 5xx) -> honest typed error.
    const msg =
      (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    return { kind: "error", status: res.status, message: msg };
  }

  // GET /v1/workflow/runs/:id — read a run's current state once.
  async getRun(runId: string): Promise<{ kind: "ok"; run: Run } | { kind: "error"; status: number; message: string }> {
    let res: Response;
    try {
      res = await this.doFetch(`${this.baseUrl}/v1/workflow/runs/${encodeURIComponent(runId)}`, {
        method: "GET",
        headers: this.headers(),
      });
    } catch (e) {
      return { kind: "error", status: 0, message: `network error: ${e instanceof Error ? e.message : String(e)}` };
    }
    const body = await res.json().catch(() => null as unknown);
    if (res.status !== 200) {
      const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
      return { kind: "error", status: res.status, message: msg };
    }
    const parsed = RunSchema.safeParse((body as { data?: unknown } | null)?.data);
    if (!parsed.success) return { kind: "error", status: 200, message: `unexpected run body: ${parsed.error.message}` };
    return { kind: "ok", run: parsed.data };
  }

  // Poll GET /v1/workflow/runs/:id until the run reaches a terminal state (or we time out). The engine drains
  // runs out-of-band (the agent-runner + the tick loop in rumah-admin); we only OBSERVE here.
  //
  // TRANSIENT-TOLERANT: a long-running poll WILL hit the occasional transport blip (a dropped keep-alive socket,
  // a connection reset). Those surface as status 0 (network error). A robust poller does NOT abandon the whole
  // observation because of one blip — it retries up to `maxTransientErrors` CONSECUTIVE blips before giving up.
  // A DEFINITIVE HTTP error (4xx/5xx — auth, not-found, server fault) is NOT transient and aborts immediately.
  async awaitRun(
    runId: string,
    opts?: { timeoutMs?: number; pollMs?: number; maxTransientErrors?: number },
  ): Promise<AwaitResult> {
    const timeoutMs = opts?.timeoutMs ?? 240_000;
    const pollMs = opts?.pollMs ?? 1_000;
    const maxTransient = opts?.maxTransientErrors ?? 10;
    const deadline = Date.now() + timeoutMs;
    let last: Run | null = null;
    let consecutiveTransient = 0;
    while (Date.now() < deadline) {
      const r = await this.getRun(runId);
      if (r.kind === "error") {
        // status 0 == network/transport blip -> transient. Anything else (4xx/5xx) is definitive -> abort.
        if (r.status === 0 && consecutiveTransient < maxTransient) {
          consecutiveTransient++;
          await new Promise((res) => setTimeout(res, pollMs));
          continue;
        }
        return { kind: "error", status: r.status, message: r.message };
      }
      consecutiveTransient = 0;
      last = r.run;
      if (TERMINAL_STATES.has(r.run.state)) return { kind: "terminal", run: r.run };
      await new Promise((res) => setTimeout(res, pollMs));
    }
    return { kind: "timeout", run: last };
  }
}

export { TERMINAL_STATES };
