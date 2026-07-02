// =============================================================================
// THE PLATFORM EVENT-STREAM battery (ECR-0006) — the OS side of the founder-action → Slack loop.
// =============================================================================
// Proves, against a LOCAL throwaway Postgres (DATABASE_URL — the same harness as bare-os.test.ts):
//   (a) appendEvent assigns a monotonic seq; drainEvents pages in TOTAL ORDER, strictly PAST the supplied cursor,
//       with NO event seen twice across successive drains; the `type` filter + hasMore/nextCursor/count are correct.
//   (b) the enforce-flip onFounderAction sink APPENDS a well-formed `founder_action` event (drainable), and a
//       persistence failure is FAIL-SOFT — it never throws out of the sink (a store fault can't crash the sweep).
//   (c) GET /v1/events is scope-gated (events:read): a missing/invalid token → 401, an insufficient scope → 403,
//       a valid events:read token → 200 with the frozen EventEnvelopeV1 { data, meta } response the Slack
//       EventsClient (deliveryos-control-surface/src/core/events-client.ts) validates field-for-field.
//
// Requires a local Postgres via DATABASE_URL (README bare-OS quickstart). Author≠verifier: this is the AUTHOR
// battery; an independent VERIFY records the neutral run.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { databaseUrl } from "../src/env.js";
import { migrateUp } from "../src/db/migrate-core.js";
import { sql } from "../src/db/client.js";
import { appendEvent, drainEvents } from "../src/events/event-store.js";
import { makeFounderActionSink } from "../src/reasoning/boot-organs.js";
import { createServer } from "../src/server.js";
import { createOsEngineRuntime } from "../src/engine-runtime.js";
import type { Principal } from "../src/engine/human-principal.js";
import type { ScopeGuard } from "../src/engine/workflow-route.js";
import type { FounderActionDraft } from "../src/reasoning/goal-driver.js";

beforeAll(async () => {
  const mig = postgres(databaseUrl(), { max: 1 });
  await migrateUp(mig); // idempotent — applies 0057 on a DB not yet at it
  await mig.end();
}, 60_000);

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe("event-store — append + total-ordered, strictly-past-cursor drain (no dupes)", () => {
  const TYPE = `test_evt_${randomUUID().slice(0, 8)}`; // isolate this test's stream from all other rows
  const ids: string[] = [];

  beforeAll(async () => {
    for (let i = 1; i <= 5; i++) {
      ids.push(await appendEvent({ type: TYPE, aggregate: { type: "test", id: `agg-${i}` }, payload: { i } }));
    }
    expect(new Set(ids).size).toBe(5); // appendEvent assigned 5 distinct ids
  });

  it("drains the whole stream in seq order with a well-formed EventEnvelopeV1 shape", async () => {
    const page = await drainEvents({ since: null, limit: 100, type: TYPE });
    expect(page.count).toBe(5);
    expect(page.hasMore).toBe(false);
    expect(page.events.map((e) => e.id)).toEqual(ids); // total order = insertion (seq) order
    for (let i = 0; i < 5; i++) {
      const e = page.events[i]!;
      expect(typeof e.id).toBe("string");
      expect(e.type).toBe(TYPE);
      expect(e.version).toBe(1);
      expect(Number.isNaN(Date.parse(e.occurredAt))).toBe(false); // ISO-8601
      expect(e.aggregate).toEqual({ type: "test", id: `agg-${i + 1}` });
      expect(e.payload).toEqual({ i: i + 1 });
    }
  });

  it("paginates strictly PAST the cursor — every event exactly once, never twice", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let hasMore = true;
    let pages = 0;
    while (hasMore) {
      const page: Awaited<ReturnType<typeof drainEvents>> = await drainEvents({ since: cursor, limit: 2, type: TYPE });
      pages++;
      for (const e of page.events) seen.push(e.id);
      cursor = page.nextCursor;
      hasMore = page.hasMore;
      expect(pages).toBeLessThan(10); // guard against a non-advancing cursor loop
    }
    expect(pages).toBe(3); // 2 + 2 + 1
    expect(seen).toEqual(ids); // in order, and — critically — NO id appears twice
    expect(new Set(seen).size).toBe(5);

    // A drain PAST the last event is an empty, terminal page (nextCursor null, hasMore false).
    const tail = await drainEvents({ since: cursor, limit: 2, type: TYPE });
    expect(tail.count).toBe(0);
    expect(tail.hasMore).toBe(false);
    expect(tail.nextCursor).toBeNull();
  });

  it("hasMore + nextCursor are correct on a bounded first page", async () => {
    const page = await drainEvents({ since: null, limit: 2, type: TYPE });
    expect(page.count).toBe(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(String(Number(page.nextCursor))); // a numeric seq string
    expect(page.events.map((e) => e.id)).toEqual(ids.slice(0, 2));
  });

  it("the `type` filter is server-side — a different type is never drained", async () => {
    const other = `test_other_${randomUUID().slice(0, 8)}`;
    await appendEvent({ type: other, aggregate: { type: "test", id: "x" }, payload: null });
    const mine = await drainEvents({ since: null, limit: 100, type: TYPE });
    expect(mine.count).toBe(5);
    expect(mine.events.every((e) => e.type === TYPE)).toBe(true);
    const theirs = await drainEvents({ since: null, limit: 100, type: other });
    expect(theirs.count).toBe(1);
    expect(theirs.events[0]!.payload).toBeNull(); // a null payload round-trips as null
  });

  it("`since` absent ⇒ drains from the start of the (filtered) stream", async () => {
    const page = await drainEvents({ since: undefined, limit: 1, type: TYPE });
    expect(page.events[0]!.id).toBe(ids[0]);
  });
});

describe("founder-action sink — persists a drainable founder_action event, fail-soft on error", () => {
  function draft(goalId: string): FounderActionDraft {
    return {
      goalId,
      kind: "PREFLIGHT_HALT",
      reason: "not_reachable",
      summary: "the goal was not shown reachable on the available evidence",
      blockers: [{ claim: "no upstream service", source: `goal_contract:${goalId}` }],
      traceStages: ["classify", "reachability", "narrate"],
    };
  }

  it("appends a well-formed founder_action event (the enforce-flip sink)", async () => {
    const goalId = `g-${randomUUID()}`;
    await makeFounderActionSink()(draft(goalId));

    const rows = await sql<{ type: string; aggregate_type: string; aggregate_id: string; payload: any }[]>`
      SELECT type, aggregate_type, aggregate_id, payload
      FROM platform_event WHERE aggregate_id = ${goalId} AND type = 'founder_action'`;
    expect(rows.length).toBe(1);
    const r = rows[0]!;
    expect(r.type).toBe("founder_action");
    expect(r.aggregate_type).toBe("goal");
    expect(r.aggregate_id).toBe(goalId);
    expect(r.payload.kind).toBe("PREFLIGHT_HALT");
    expect(r.payload.reason).toBe("not_reachable");
    expect(r.payload.summary).toContain("not shown reachable");
    expect(r.payload.blockers).toEqual([{ claim: "no upstream service", source: `goal_contract:${goalId}` }]);
    expect(r.payload.trace).toEqual(["classify", "reachability", "narrate"]);

    // …and it is DRAINABLE through the same seam the Slack adapter consumes.
    const drained = await drainEvents({ since: null, limit: 500, type: "founder_action" });
    expect(drained.events.some((e) => e.aggregate.id === goalId)).toBe(true);
  });

  it("is FAIL-SOFT on a persistence error — the sink never throws (the sweep can't crash on a store fault)", async () => {
    const goalId = `g-${randomUUID()}`;
    const throwingAppend = (async () => {
      throw new Error("boom: durable store unavailable");
    }) as typeof appendEvent;
    // Resolves (does not reject) even though the append threw — the error is logged + swallowed.
    await expect(makeFounderActionSink(throwingAppend)(draft(goalId))).resolves.toBeUndefined();
    // And nothing was persisted for this goal (the throwing append wrote nothing).
    const rows = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM platform_event WHERE aggregate_id = ${goalId}`;
    expect(rows[0]!.n).toBe(0);
  });
});

describe("GET /v1/events — scope-gated (events:read) drain, fail-closed on a bad/absent token", () => {
  // A STRICT ScopeGuard standing in for the operator's real verifier (M2/M3) — the SAME ScopeGuard port the
  // engine's workflow/goals routes use, given a concrete impl: a Bearer token decodes to a Principal, and the
  // route's required scope is enforced by plain scope inclusion (a read drain is a SERVICE scope, not a human
  // gate — role 'admin' bypasses). This proves the route is fail-closed via the injected guard; it invents no
  // new auth scheme.
  const strictAuth: ScopeGuard = (requiredScope) => async (c, next) => {
    const authz = c.req.header("authorization") ?? "";
    const m = /^Bearer\s+(.+)$/i.exec(authz);
    if (!m) return c.json({ error: { code: "unauthorized", message: "missing bearer token" } }, 401);
    let principal: Principal | null = null;
    try {
      principal = JSON.parse(Buffer.from(m[1]!, "base64").toString("utf8")) as Principal;
    } catch {
      principal = null;
    }
    if (!principal || !Array.isArray(principal.scopes) || typeof principal.role !== "string") {
      return c.json({ error: { code: "unauthorized", message: "invalid token" } }, 401);
    }
    if (principal.role !== "admin" && !principal.scopes.includes(requiredScope)) {
      return c.json({ error: { code: "forbidden", message: "missing scope" } }, 403);
    }
    c.set("principal", principal);
    await next();
  };
  const tokenFor = (p: Principal): string => Buffer.from(JSON.stringify(p)).toString("base64");
  const READ_TOKEN = tokenFor({ sub: "slack-adapter", role: "service", scopes: ["events:read"] });
  const WRONG_SCOPE = tokenFor({ sub: "slack-adapter", role: "service", scopes: ["workflow:runtime"] });

  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const os = createOsEngineRuntime();
    app = createServer(os, { auth: strictAuth });
    await appendEvent({ type: `route_${randomUUID().slice(0, 8)}`, aggregate: { type: "test", id: "r1" }, payload: { ok: true } });
  });

  it("rejects a MISSING token with 401", async () => {
    const res = await app.fetch(new Request("http://os/v1/events"));
    expect(res.status).toBe(401);
  });

  it("rejects an INVALID token with 401", async () => {
    const res = await app.fetch(new Request("http://os/v1/events", { headers: { authorization: "Bearer !!!not-a-token" } }));
    expect(res.status).toBe(401);
  });

  it("rejects a token WITHOUT events:read with 403", async () => {
    const res = await app.fetch(new Request("http://os/v1/events", { headers: { authorization: `Bearer ${WRONG_SCOPE}` } }));
    expect(res.status).toBe(403);
  });

  it("accepts a valid events:read token → 200 with the frozen EventEnvelopeV1 { data, meta } shape", async () => {
    const res = await app.fetch(new Request("http://os/v1/events?limit=100", { headers: { authorization: `Bearer ${READ_TOKEN}` } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // meta — field-for-field with events-client.ts EventListMetaSchema
    expect(body.meta.version).toBe("v1");
    expect(typeof body.meta.count).toBe("number");
    expect(typeof body.meta.hasMore).toBe("boolean");
    expect(body.meta.nextCursor === null || typeof body.meta.nextCursor === "string").toBe(true);
    // data — an array of EventEnvelopeV1
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(body.meta.count);
    for (const e of body.data) {
      expect(typeof e.id).toBe("string");
      expect(typeof e.type).toBe("string");
      expect(typeof e.version).toBe("number");
      expect(typeof e.occurredAt).toBe("string");
      expect(typeof e.aggregate.type).toBe("string");
      expect(typeof e.aggregate.id).toBe("string");
      expect(e.payload === null || typeof e.payload === "object").toBe(true);
    }
  });

  it("rejects a malformed cursor with 400 (never a silent full re-drain)", async () => {
    const res = await app.fetch(new Request("http://os/v1/events?since=not-a-seq", { headers: { authorization: `Bearer ${READ_TOKEN}` } }));
    expect(res.status).toBe(400);
  });
});
