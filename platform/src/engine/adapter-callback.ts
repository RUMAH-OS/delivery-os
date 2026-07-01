// =============================================================================
// The cross-process ADAPTER-CALLBACK executor (E-PH M3a). PLATFORM-INDEPENDENCE (I-PI).
// =============================================================================
// The OS runs a tenant capability it does NOT contain the code for by CALLING BACK to the tenant. When the
// engine steps a PROXIED handler (synthesized by src/capability-registration.ts), that proxy delegates here:
// this module HTTP-POSTs the (serializable) step context to the tenant's adapterCallbackUrl and awaits a
// HandlerResult JSON. It imports ZERO tenant module — the ONLY coupling is an HTTP request whose body is DATA.
//
// FAIL-CLOSED: transport failures (network/timeout/5xx/429) get a bounded, backed-off retry; on exhaustion this
// returns a TRANSIENT { ok:false } so the step lands on the engine's EXISTING retry/terminal path (no new goal
// transition invented, no fabricated ok:true). A tenant's own well-formed { ok:false } is passed through verbatim.
//
// DESIGN: platform/docs/DESIGN-m3a-capability-callback.md §3/§4/§5/§6.

import type { HandlerResult, StepContext } from "./handlers.js";

// ── The serializable subset of a StepContext the OS sends over the wire. The tx handle + the emit closure are
// OS-internal and are NEVER serialized (a proxied handler is emit-free — §3 of the design note). ──
export interface SerializableStepContext {
  runId: string;
  seq: number;
  attempt: number;
  checkpoint: Record<string, unknown> | null;
  input: Record<string, unknown>;
}

export function toSerializableStepContext(ctx: StepContext): SerializableStepContext {
  return { runId: ctx.runId, seq: ctx.seq, attempt: ctx.attempt, checkpoint: ctx.checkpoint ?? null, input: ctx.input };
}

// ── The callback request body (OS → tenant). PII-free-by-convention: the engine carries stepContext opaquely;
// WHAT is inside input/checkpoint is the tenant's own domain data it round-trips to itself. ──
export interface AdapterCallbackRequest {
  tenantId: string;
  packId: string;
  handlerKey: string;
  idempotencyKey: string; // "<runId>:<seq>" — the engine step identity (design §5); the tenant MUST dedupe on it.
  stepContext: SerializableStepContext;
}

// ── The executor's options. `token` (the per-registration shared secret) is presented as a Bearer so the
// tenant can authenticate the OS. Timeout + retry defaults are conservative and overridable (for tests). ──
export interface AdapterCallbackOptions {
  adapterCallbackUrl: string;
  token: string;
  tenantId: string;
  packId: string;
  handlerKey: string;
  ctx: StepContext;
  timeoutMs?: number; // per-attempt timeout (default 10s)
  maxAttempts?: number; // total transport attempts (default 3)
  baseBackoffMs?: number; // first retry backoff (default 250ms; capped exponential)
  // Injectable fetch (default: the global fetch). Present ONLY so a test can drive it without a real socket;
  // production always uses the platform's global fetch. It is NEVER a tenant module.
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 5_000;

// Typed error taxonomy (observability; the executor converts these into a transient HandlerResult, never throws).
export type AdapterCallbackErrorKind =
  | "network" // fetch rejected (DNS/connection refused/reset) — a dead or unreachable tenant
  | "timeout" // the per-attempt AbortController fired
  | "http_5xx" // the tenant returned a 5xx (its own server error)
  | "http_429" // the tenant rate-limited us
  | "http_4xx" // a non-429 4xx — a CONTRACT error (bad token / bad request): NOT retried
  | "bad_body"; // the tenant returned a non-parseable or malformed HandlerResult

export class AdapterCallbackError extends Error {
  constructor(
    readonly kind: AdapterCallbackErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AdapterCallbackError";
  }
  /** transport-class errors are worth retrying; a 4xx contract error and a bad body are not. */
  get retryable(): boolean {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "http_5xx" || this.kind === "http_429";
  }
}

// ── executeViaCallback — the single entrypoint a synthesized proxy handler calls. Returns a HandlerResult the
// engine can act on directly. NEVER throws (a throw would surface as an untyped engine failure); every failure
// path returns a typed { ok:false } HandlerResult. ──
export async function executeViaCallback(opts: AdapterCallbackOptions): Promise<HandlerResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseBackoffMs = opts.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const doFetch = opts.fetchImpl ?? fetch;

  const body: AdapterCallbackRequest = {
    tenantId: opts.tenantId,
    packId: opts.packId,
    handlerKey: opts.handlerKey,
    idempotencyKey: `${opts.ctx.runId}:${opts.ctx.seq}`,
    stepContext: toSerializableStepContext(opts.ctx),
  };

  let lastErr: AdapterCallbackError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await callOnce(doFetch, opts.adapterCallbackUrl, opts.token, body, timeoutMs);
      return result; // a well-formed HandlerResult (ok:true OR the tenant's own ok:false) — pass through verbatim.
    } catch (e) {
      const err = e instanceof AdapterCallbackError ? e : new AdapterCallbackError("network", e instanceof Error ? e.message : String(e));
      lastErr = err;
      if (!err.retryable || attempt >= maxAttempts) break; // contract error, bad body, or attempts exhausted.
      await sleep(backoff(attempt, baseBackoffMs));
    }
  }

  // Exhausted / non-retryable transport failure → a TRANSIENT engine failure (fail-closed; engine owns the retry).
  const detail = lastErr ? `${lastErr.kind}: ${lastErr.message}` : "unknown adapter-callback failure";
  return {
    ok: false,
    transient: true,
    error: `adapter-callback to tenant "${opts.tenantId}" pack "${opts.packId}" handler "${opts.handlerKey}" failed (${detail})`,
  };
}

// ── one attempt: POST → status-class → parse HandlerResult. Throws AdapterCallbackError (the loop classifies). ──
async function callOnce(
  doFetch: typeof fetch,
  url: string,
  token: string,
  body: AdapterCallbackRequest,
  timeoutMs: number,
): Promise<HandlerResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) throw new AdapterCallbackError("timeout", `callback timed out after ${timeoutMs}ms`);
    throw new AdapterCallbackError("network", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }

  if (res.status >= 500) throw new AdapterCallbackError("http_5xx", `tenant returned ${res.status}`, res.status);
  if (res.status === 429) throw new AdapterCallbackError("http_429", "tenant returned 429 (rate limited)", res.status);
  if (res.status >= 400) throw new AdapterCallbackError("http_4xx", `tenant returned ${res.status} (contract error — not retried)`, res.status);

  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    throw new AdapterCallbackError("bad_body", `tenant response was not JSON: ${e instanceof Error ? e.message : String(e)}`, res.status);
  }
  const parsed = parseHandlerResult(json);
  if (!parsed) throw new AdapterCallbackError("bad_body", "tenant response was not a valid HandlerResult", res.status);
  return parsed;
}

// ── validate the tenant's response is a genuine HandlerResult (the engine's contract). Fail-closed: a shape we
// do not recognize is a bad_body (never coerced into an ok:true). ──
export function parseHandlerResult(json: unknown): HandlerResult | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  if (o.ok === true) {
    if (typeof o.result !== "object" || o.result === null) return null;
    if (typeof o.checkpoint !== "object" || o.checkpoint === null) return null;
    const out: HandlerResult = {
      ok: true,
      result: o.result as Record<string, unknown>,
      checkpoint: o.checkpoint as Record<string, unknown>,
    };
    if (typeof o.awaitEventId === "string") (out as { awaitEventId?: string }).awaitEventId = o.awaitEventId;
    return out;
  }
  if (o.ok === false) {
    if (typeof o.transient !== "boolean") return null;
    if (typeof o.error !== "string") return null;
    return { ok: false, transient: o.transient, error: o.error };
  }
  return null;
}

function backoff(attempt: number, baseMs: number): number {
  const raw = Math.min(baseMs * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  return Math.round(raw * (0.5 + Math.random() * 0.5)); // jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
