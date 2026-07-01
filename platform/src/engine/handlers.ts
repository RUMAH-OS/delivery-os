// Durable Execution Engine — step handler MECHANISM (Slice 0; GENERIC).
// A handler is the registered executor for a step. It is EMIT-ONLY or IDEMPOTENT (C6): a crash mid-handler
// is safe to re-run from the checkpoint. The engine resolves a step's `handler` key to a registered function
// and runs it; the handler emits engine events to the SAME transaction as the state write (transactional
// outbox) via ctx.emit, and writes a checkpoint.
//
// OWNERSHIP BOUNDARY: this module is GENERIC mechanism only — the StepContext / HandlerResult contract +
// an empty registry + register/run functions. It carries ZERO domain knowledge: it does NOT import any
// domain code. Per-project handlers live in an APP-owned module that calls registerHandler() at startup.
//
// A handler returns either {ok:true, result, checkpoint} or {ok:false, transient, error}. A transient
// failure with attempts remaining triggers auto-retry-with-backoff in the engine; the run then lands in
// `recovered` (criterion #5).

type TxLike = unknown; // the Drizzle tx handle (kept loose; the engine passes the real one).

export interface StepContext {
  tx: TxLike;
  runId: string;
  seq: number;
  attempt: number;
  checkpoint: Record<string, unknown> | null;
  // The run's enqueue input — the SAME object passed to enqueue(definitionKey, input, idem), defaulting to {}
  // if the run had null input. This is per-RUN data (constant across all steps of a run), distinct from the
  // per-step checkpoint. It lets a handler read the operational parameters the run was started with (e.g. the
  // specific email a dunning run must act on) instead of closing over a build-time default. Read-only: a
  // handler MUST NOT mutate it. The engine carries it OPAQUELY (it never reads inside it — ownership boundary).
  readonly input: Record<string, unknown>;
  emit: (type: string, payload: Record<string, unknown>) => Promise<void>;
}

// An await-callback handler (a step whose effect is "await-callback") additionally returns `awaitEventId`:
// the correlation key (the id of the REQUEST event it emitted in-txn) that the inbound system callback will
// carry back. The engine sets it on the blocking step (awaiting_event_id) so the completer can match. A
// non-await handler omits it (undefined). PII-free: it is an opaque event id, never domain data.
export type HandlerResult =
  | { ok: true; result: Record<string, unknown>; checkpoint: Record<string, unknown>; awaitEventId?: string }
  | { ok: false; transient: boolean; error: string };

export type Handler = (ctx: StepContext) => Promise<HandlerResult>;

// ── handler registry + dispatch — GENERIC + EMPTY. Per-project handlers register INTO it at startup. ──
const HANDLERS: Record<string, Handler> = {};

export function registerHandler(key: string, fn: Handler): void {
  HANDLERS[key] = fn;
}

// Remove a handler (E-PH M3a deregistration). Used when a tenant deregisters — its proxy handlers are unwired so
// a stale step resolves to `unknown handler` (a clean terminal step failure) rather than calling a dead tenant.
export function unregisterHandler(key: string): void {
  delete HANDLERS[key];
}

export async function runHandler(handler: string, ctx: StepContext): Promise<HandlerResult> {
  const fn = HANDLERS[handler];
  if (!fn) return { ok: false, transient: false, error: `unknown handler ${handler}` };
  return await fn(ctx);
}
