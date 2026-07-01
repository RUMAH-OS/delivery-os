// Workflow Engine — the /goals route FACTORY (the GOAL ENTRYPOINT). PORTABILIZED, GENERIC.
// POST /goals accepts a GOAL (intent / text / payload — NOT a hand-picked definitionKey), routes it through
// submitGoal (selectCapability → enqueue), and returns the selection result honestly:
//   - selected  → 201 { kind:'enqueued', runId, definitionKey }  (a run was created)
//   - no-match  → 422 { kind:'no-match' }                          (NO run — fail-closed)
//   - ambiguous → 422 { kind:'ambiguous', candidates:[...] }      (NO run — fail-closed, never picks)
//
// This is the surface Slack (and any caller) calls to START work from intent. The READ side (observe the run
// that resulted) reuses the existing GET /workflow/runs/:id — no new read is invented here.
//
// OWNERSHIP BOUNDARY: createGoalsRoute({ registry, enqueue, auth }) injects the app's selectable-capability
// registry + the engine's enqueue + an injected auth checker. The engine imports ZERO app infra; the route is
// gated by an engine scope (default workflow:runtime — submitting a goal drives execution). The app maps its
// own requireAuth onto the engine's ScopeGuard exactly like the workflow route.
import { Hono } from "hono";
import { z } from "zod";
import { WORKFLOW_SCOPES, type Principal } from "./human-principal.js";
import type { ScopeGuard } from "./workflow-route.js";
import { submitGoal, type SelectableCapability, type Goal } from "./capability-selector.js";

export interface GoalsRouteContext {
  // the selectable capabilities (definitionKey + declared selector). The engine derives this from registered
  // packs (createCapabilityRuntime supplies it); a lower-level caller may pass its own list.
  registry: SelectableCapability[];
  // the engine's enqueue (the SAME boundary the workflow route uses). submitGoal calls it only on a selection.
  enqueue: (definitionKey: string, input: Record<string, unknown>, idempotencyKey: string) => Promise<{ runId: string; created: boolean }>;
  // the app's auth-middleware FACTORY (maps the app's scope-grants onto the engine scope). Same shape as the
  // workflow route's ScopeGuard.
  auth: ScopeGuard;
  // OPTIONAL: the engine scope this entrypoint requires. Defaults to workflow:runtime (submitting a goal drives
  // execution). An app may pass a dedicated scope (e.g. goals:submit) it mints onto its goal-submitting callers.
  requiredScope?: string;
}

const bad = (c: any, message: string) => c.json({ error: { code: "bad_request", message } }, 400);

// Mirror the workflow route's honest pg error envelope: a unique-violation (e.g. a duplicate idempotency key
// the enqueue boundary surfaced rather than de-duplicated) degrades to 409 conflict, never a bare 500. The pg
// error code may be on the error directly OR nested under `.cause` (a query-layer wrapper, e.g. DrizzleQueryError),
// so we check both — a 23505 is a duplicate either way.
function pgCode(e: unknown): string | undefined {
  const direct = (e as { code?: string }).code;
  if (direct) return direct;
  const cause = (e as { cause?: { code?: string } }).cause;
  return cause?.code;
}
function pgError(c: any, e: unknown) {
  if (pgCode(e) === "23505") return c.json({ error: { code: "conflict", message: "duplicate" } }, 409);
  return c.json({ error: { code: "internal", message: e instanceof Error ? e.message : String(e) } }, 500);
}

export function createGoalsRoute(ctx: GoalsRouteContext): Hono<{ Variables: { principal: Principal } }> {
  const requiredScope = ctx.requiredScope ?? WORKFLOW_SCOPES.runtime;
  const route = new Hono<{ Variables: { principal: Principal } }>();

  // The goal body: intent (a normalized intent-label), text (free-text), payload (structured inputs). All
  // OPTIONAL individually, but the body must carry at least one of them (an empty goal can never match).
  const GoalInput = z
    .object({
      intent: z.string().min(1).optional(),
      text: z.string().min(1).optional(),
      payload: z.record(z.unknown()).optional(),
      // OPTIONAL stable idempotency key for the resulting run (a retried submit returns the SAME run).
      idempotencyKey: z.string().min(1).max(200).optional(),
    })
    .refine((g) => g.intent !== undefined || g.text !== undefined || g.payload !== undefined, {
      message: "a goal must carry at least one of: intent, text, payload",
    });

  // POST /goals — gated on the engine scope. select → (selected) enqueue, else honest no-match/ambiguous (no run).
  route.post("/goals", ctx.auth(requiredScope), async (c) => {
    const parsed = GoalInput.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return bad(c, parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; "));

    const { idempotencyKey, ...goal } = parsed.data;
    let result;
    try {
      result = await submitGoal(
        { registry: ctx.registry, enqueue: ctx.enqueue, idempotencyKey },
        goal as Goal,
      );
    } catch (e) {
      // selectCapability is pure (cannot throw on a valid body); a throw here is the enqueue boundary (DB) —
      // surface it as the workflow route's honest envelope (409 on a unique-violation), never a bare 500.
      return pgError(c, e);
    }

    if (result.kind === "enqueued") {
      return c.json(
        { data: { kind: "enqueued", runId: result.runId, definitionKey: result.definitionKey } },
        result.created ? 201 : 200,
      );
    }
    // FAIL-CLOSED: no-match / ambiguous → 422 (the goal was understood but NOT routed to a run). The candidates
    // (on ambiguous) are surfaced so the caller can disambiguate; no run was created in either case.
    return c.json({ data: result }, 422);
  });

  return route;
}
