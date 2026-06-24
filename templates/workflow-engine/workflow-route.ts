// Workflow Engine — the /workflow/* route FACTORY (enqueue / tick / runs read). PORTABILIZED.
// Extracted from the app's inline route handlers. createWorkflowRoute({ db, tables, engine, auth })
// injects the app's Drizzle client + run/step table objects + an Engine instance + an injected auth
// checker. The engine imports ZERO app infra and is gated by the engine's OWN workflow scopes —
// NOT the app's domain scopes (the app maps its requireAuth to these).
//
// ENQUEUE: create a run (queued) + materialize its steps. Idempotent on idempotencyKey.
// TICK: the heartbeat — an idempotent, concurrency-safe (SKIP LOCKED) advance loop. ?max= caps ticks/call.
// READ: a run's current state + its steps (FACTS only — PII-free projection).
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { WORKFLOW_SCOPES, type Principal } from "./human-principal.js";
import type { DbLike, EngineTables, Engine } from "./engine.js";
import type { MiddlewareHandler } from "hono";

// the app supplies an auth-middleware FACTORY taking the required engine scope. The engine never imports
// the app's auth; the app maps its own verifier/scope-grants onto these three engine scopes.
export type ScopeGuard = (requiredScope: string) => MiddlewareHandler<{ Variables: { principal: Principal } }>;

export interface WorkflowRouteContext {
  db: DbLike;
  tables: EngineTables;
  engine: Engine;
  auth: ScopeGuard;
  // the workflow definition keys this app accepts on enqueue (the app owns its definition content; the
  // route validates against this allow-list). Defaults to accepting any non-empty key if omitted.
  enqueueKeys?: readonly string[];
}

const bad = (c: any, message: string) => c.json({ error: { code: "bad_request", message } }, 400);

// The pg error code may be on the error directly OR nested under `.cause` (a query-layer wrapper, e.g.
// DrizzleQueryError sets its own `.code` undefined and carries the driver code on `.cause`). Walk the cause
// chain so a duplicate degrades to 409 conflict, never a bare 500. Mirrors goals-route.ts's pgCode().
// NOTE: with the engine's idempotent enqueue, a duplicate (definitionKey, idempotencyKey) now returns the
// EXISTING run (created:false → 200) and never reaches here; this 409 path remains for any OTHER
// unique-violation the boundary might surface (honest envelope, not a 500).
function pgCode(e: unknown): string | undefined {
  let cur: unknown = e;
  for (let depth = 0; depth < 8 && cur !== null && typeof cur === "object"; depth++) {
    const code = (cur as { code?: string }).code;
    if (code) return code;
    const next = (cur as { cause?: unknown }).cause;
    if (next === cur) break;
    cur = next;
  }
  return undefined;
}
function pgError(c: any, e: unknown) {
  if (pgCode(e) === "23505") return c.json({ error: { code: "conflict", message: "duplicate" } }, 409);
  return c.json({ error: { code: "internal", message: e instanceof Error ? e.message : String(e) } }, 500);
}

export function createWorkflowRoute(ctx: WorkflowRouteContext): Hono<{ Variables: { principal: Principal } }> {
  const { engine, db, auth } = ctx;
  const { workflowRun, workflowStep } = ctx.tables;

  const route = new Hono<{ Variables: { principal: Principal } }>();

  // ENQUEUE — gated on workflow:runtime (drive execution). Body validation: a known definition key + an
  // opaque input object + an idempotency key. The engine owns durability; the app owns definition content.
  const EnqueueInput = z.object({
    definitionKey: ctx.enqueueKeys && ctx.enqueueKeys.length
      ? z.enum([...(ctx.enqueueKeys as [string, ...string[]])])
      : z.string().min(1),
    input: z.record(z.unknown()),
    idempotencyKey: z.string().min(1).max(200),
  });
  route.post("/workflow/enqueue", auth(WORKFLOW_SCOPES.runtime), async (c) => {
    const parsed = EnqueueInput.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return bad(c, parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; "));
    try {
      const r = await engine.enqueue(parsed.data.definitionKey, parsed.data.input, parsed.data.idempotencyKey);
      return c.json({ data: { runId: r.runId }, ...(r.created ? {} : { meta: { idempotent: true } }) }, r.created ? 201 : 200);
    } catch (e) {
      return pgError(c, e);
    }
  });

  // HEARTBEAT TICK — gated on workflow:runtime. Idempotent + concurrency-safe (SKIP LOCKED) + repeatable.
  // ?max= caps ticks per call (default 50, 1..200) to stay within a serverless wall-clock.
  route.post("/workflow/tick", auth(WORKFLOW_SCOPES.runtime), async (c) => {
    const max = Math.min(Math.max(Number(c.req.query("max") ?? 50) || 50, 1), 200);
    const advanced: { runId?: string; from?: string; to?: string; detail?: string }[] = [];
    try {
      for (let i = 0; i < max; i++) {
        const r = await engine.tick();
        if (!r.advanced) break;
        advanced.push({ runId: r.runId, from: r.from, to: r.to, detail: r.detail });
      }
    } catch (e) {
      return pgError(c, e);
    }
    return c.json({ data: { ticks: advanced.length, advanced }, meta: { max } });
  });

  // READ — gated on workflow:observe. A run's current state + its steps (FACTS only; PII-free projection).
  route.get("/workflow/runs/:id", auth(WORKFLOW_SCOPES.observe), async (c) => {
    const id = c.req.param("id");
    const [run] = await db.select().from(workflowRun).where(eq(workflowRun.id, id)).limit(1);
    if (!run) return c.json({ error: { code: "not_found", message: "run not found" } }, 404);
    const steps = await db.select().from(workflowStep).where(eq(workflowStep.runId, id)).orderBy(workflowStep.seq);
    // G4 — surface the engine.verify verdict on the read projection so a founder surface can show pass/reasons
    // WITHOUT reading steps directly. The stored verdict is PII-free by construction (coded reasons only, S4).
    // Top-level `verify` = the FIRST verify step by seq (steps are seq-ordered above). Today's definitions
    // carry exactly one engine.verify step; a multi-verify definition would surface the first here — per-step
    // `verdict` below still carries every verify step, so no verdict is lost. `verify: null` = not yet verified.
    const verifyStep = steps.find((s: any) => s.handler === "engine.verify");
    const vv = (verifyStep?.verdict ?? null) as null | {
      verdict?: string; reasons?: string[]; rung?: string; verifierId?: string;
      gateEligible?: boolean; gateReason?: string;
    };
    return c.json({ data: {
      id: run.id, definitionKey: run.definitionKey, state: run.state, attempt: run.attempt,
      wasInterrupted: run.wasInterrupted, blockedReason: run.blockedReason, terminalAt: run.terminalAt,
      // G4 — top-level verdict summary (null until the verify step has run). PII-free coded fields only.
      verify: vv ? {
        verdict: vv.verdict ?? null, reasons: vv.reasons ?? [], rung: vv.rung ?? null,
        verifierId: vv.verifierId ?? null, gateEligible: vv.gateEligible ?? null, gateReason: vv.gateReason ?? null,
      } : null,
      // G4 — per-step verdict projected as a CODED SUBSET (verdict/reasons/rung), never the raw stored jsonb:
      // keeps the observe surface PII-free BY CONSTRUCTION (omits suggestedImprovement/advisory/score, whose
      // PII-freeness is only a verifier convention). QA advisory on the first G4 pass.
      steps: steps.map((s: any) => ({ seq: s.seq, state: s.state, stepType: s.stepType, owner: s.owner, handler: s.handler, effect: s.effect, attempt: s.attempt, maxAttempts: s.maxAttempts, nextRetryAt: s.nextRetryAt,
        verdict: s.verdict ? { verdict: s.verdict.verdict ?? null, reasons: s.verdict.reasons ?? [], rung: s.verdict.rung ?? null } : null })),
    } });
  });

  return route;
}
