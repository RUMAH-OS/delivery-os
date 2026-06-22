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

function pgError(c: any, e: unknown) {
  const code = (e as { code?: string }).code;
  if (code === "23505") return c.json({ error: { code: "conflict", message: "duplicate" } }, 409);
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
    return c.json({ data: {
      id: run.id, definitionKey: run.definitionKey, state: run.state, attempt: run.attempt,
      wasInterrupted: run.wasInterrupted, blockedReason: run.blockedReason, terminalAt: run.terminalAt,
      steps: steps.map((s: any) => ({ seq: s.seq, state: s.state, stepType: s.stepType, owner: s.owner, handler: s.handler, effect: s.effect, attempt: s.attempt, maxAttempts: s.maxAttempts, nextRetryAt: s.nextRetryAt })),
    } });
  });

  return route;
}
