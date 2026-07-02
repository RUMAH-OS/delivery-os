// =============================================================================
// The OS runtime HTTP surface (Hono). The bare-OS API + the /v1 front door.
// =============================================================================
// Serves the OS's own control surface: liveness (/v1/health, /v1/heartbeat), the capability registry read
// (/v1/capabilities — the "zero tenant packs" observable), the goal front door (POST /v1/goals — fail-closed
// no-match on a bare OS), and the engine's own workflow/approvals routes. This is the OS running as a service
// that a tenant CONSUMES — the OS imports zero tenant code (PLATFORM-HOME-EXTRACTION.md §3.1 host model).
import { Hono } from "hono";
import type { Principal } from "./engine/human-principal.js";
import type { ScopeGuard } from "./engine/workflow-route.js";
import type { OsEngineRuntime } from "./engine-runtime.js";
import { devScopeGuard } from "./engine-runtime.js";
import { stampHeartbeat, readHeartbeat, NODE_ID } from "./heartbeat.js";
import { CapabilityConflictError } from "./engine/capability-pack.js";
import { EVENTS_SCOPES, drainEvents } from "./events/event-store.js";
import {
  RegistrationRequestSchema,
  registerTenantManifest,
  deregisterTenant,
  InMemoryCapabilityRegistrationStore,
  type CapabilityRegistrationStore,
  type AdapterExecOptions,
} from "./capability-registration.js";

export const OS_VERSION = "delivery-os-platform/M1";

// The HTTP capability-registration surface (E-PH M3a) is wired with a durable store + adapter-callback tunables.
// Boot injects the Postgres store (durability) + the real global fetch; tests inject an in-memory store + a fast
// exec profile. Default: in-memory store (a bare OS with no durable registrations, e.g. the M1 battery).
export interface ServerDeps {
  registrationStore?: CapabilityRegistrationStore;
  adapterExec?: AdapterExecOptions;
  // The auth ScopeGuard the /v1/events drain is gated by (events:read). SAME mechanism the engine's workflow/goals
  // routes use — the app maps its verifier/scope-grants onto the engine scope; the OS never invents a new auth
  // scheme here. Defaults to the M1 devScopeGuard (a real verifying guard is injected at M2/M3, exactly like the
  // engine routes' dev→real progression). A test injects a strict guard to prove fail-closed 401/403.
  auth?: ScopeGuard;
}

export function createServer(os: OsEngineRuntime, deps: ServerDeps = {}): Hono<{ Variables: { principal: Principal } }> {
  const app = new Hono<{ Variables: { principal: Principal } }>();
  const registrationStore = deps.registrationStore ?? new InMemoryCapabilityRegistrationStore();
  const adapterExec = deps.adapterExec;
  const auth = deps.auth ?? devScopeGuard;

  // ── liveness ──────────────────────────────────────────────────────────────────────────────────────
  // Health = the bare-OS survival observable: is the OS up, and is it running with ZERO tenant packs?
  app.get("/v1/health", (c) =>
    c.json({
      ok: true,
      os: OS_VERSION,
      nodeId: NODE_ID,
      registeredPacks: os.registeredPackIds(),
      tenantPackCount: os.registeredPackIds().length,
      zeroTenants: os.registeredPackIds().length === 0,
    }),
  );

  // /v1/heartbeat — stamp + report liveness (the dead-man-switch read side). A beat is idempotent.
  app.get("/v1/heartbeat", async (c) => {
    const beatAt = await stampHeartbeat();
    const last = await readHeartbeat();
    return c.json({ nodeId: NODE_ID, beatAt, lastBeatAt: last, armed: last !== null });
  });

  // ── the capability registry (read) — the OS-owned registry that RUNS tenant capabilities. On a bare OS
  // this is EMPTY (zero tenant packs). A tenant populates it via the in-process registration API
  // (os.registerCapabilityPacks); the HTTP adapter-callback registration (a tenant POSTs a manifest + adapter
  // URL) is the M3 consume-flip surface — declared 501 here so M1 never over-claims it. ──
  app.get("/v1/capabilities", (c) =>
    c.json({
      registeredPackIds: os.registeredPackIds(),
      enqueueKeys: os.enqueueKeys(),
      selectors: os.selectors().map((s) => s.definitionKey),
      empty: os.registeredPackIds().length === 0,
    }),
  );
  // ── POST /v1/capabilities — the M3a consume-flip surface. A tenant POSTs a manifest of DATA (definitions +
  // selectors + the handler keys it services) + an adapter callback URL. The OS validates (zod, fail-closed),
  // synthesizes a PROXY handler per handler key (a closure that calls the tenant back over HTTP — the OS imports
  // ZERO tenant code), registers them through the same in-process seam (fail-closed on cross-pack conflict), and
  // persists the manifest so it survives a restart. Returns the resulting registry snapshot + the callback token
  // the tenant must authenticate. ──
  app.post("/v1/capabilities", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: { code: "bad_request", message: "body must be JSON" } }, 400);
    }
    const parsed = RegistrationRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "invalid_manifest", message: "manifest failed validation", issues: parsed.error.issues } }, 400);
    }
    try {
      const snap = await registerTenantManifest(os, registrationStore, parsed.data, adapterExec);
      return c.json(
        {
          registeredPackIds: snap.registeredPackIds,
          enqueueKeys: snap.enqueueKeys,
          selectors: snap.selectors.map((s) => s.definitionKey),
          token: snap.token,
        },
        200,
      );
    } catch (e) {
      // FAIL-CLOSED: a cross-pack key conflict is a 409 (never a silent overwrite); nothing was persisted.
      if (e instanceof CapabilityConflictError) {
        return c.json({ error: { code: "capability_conflict", message: e.message } }, 409);
      }
      return c.json({ error: { code: "registration_failed", message: e instanceof Error ? e.message : String(e) } }, 500);
    }
  });

  // ── DELETE /v1/capabilities/:tenantId — deregister a tenant. Its packs leave the registry (goals route
  // rebuilt, proxy handlers unwired), its stored manifest is forgotten, and OTHER tenants keep serving. Proves a
  // tenant is REMOVABLE without breaking the OS (I-PI survival). Idempotent: an unknown tenant is a clean no-op. ──
  app.delete("/v1/capabilities/:tenantId", async (c) => {
    const tenantId = c.req.param("tenantId");
    try {
      const snap = await deregisterTenant(os, registrationStore, tenantId);
      return c.json(
        {
          tenantId,
          deregisteredPackIds: snap.deregisteredPackIds,
          registeredPackIds: snap.registeredPackIds,
          enqueueKeys: snap.enqueueKeys,
          selectors: snap.selectors.map((s) => s.definitionKey),
        },
        200,
      );
    } catch (e) {
      return c.json({ error: { code: "deregistration_failed", message: e instanceof Error ? e.message : String(e) } }, 500);
    }
  });

  // ── the GOAL front door (POST /v1/goals) — delegates to the CURRENT goals route (rebuilt on registration).
  // On a bare OS the selector registry is empty → every goal fail-closes to 422 no-match, never a crash. ──
  app.post("/v1/goals", async (c) => {
    const url = new URL(c.req.url);
    url.pathname = "/goals"; // the sub-route matches "/goals"
    const bodyText = await c.req.text();
    const req = new Request(url.toString(), { method: "POST", headers: c.req.raw.headers, body: bodyText });
    const res = await os.goalsFetch(req);
    return res;
  });

  // ── GET /v1/events — the durable event-stream DRAIN (ECR-0006), the OS side of the founder-action → Slack loop.
  // Scope-gated on events:read through the SAME ScopeGuard mechanism the workflow/goals routes use (fail-closed on
  // a bad/absent token via the injected guard — the OS invents no new auth scheme). Pages the append-only
  // platform_event stream in TOTAL ORDER, strictly PAST the supplied `since` cursor, so no event is drained twice.
  // Response is the frozen EventEnvelopeV1 list the Slack adapter's EventsClient validates field-for-field:
  //   { data: [ { id, type, version, occurredAt, aggregate:{type,id}, payload } ],
  //     meta: { version:"v1", count, nextCursor: string|null, hasMore } }
  // Query: since=<seq cursor> (absent/null ⇒ from the start), limit=<n> (default 100, clamped 1..500), type=<t>. ──
  app.get("/v1/events", auth(EVENTS_SCOPES.read), async (c) => {
    // `since` — an opaque cursor (a monotonic seq as a string). Absent/empty ⇒ drain from the start. A malformed
    // cursor is a 400 (fail-closed, never a silent full re-drain).
    const sinceRaw = c.req.query("since");
    let since: string | null = null;
    if (sinceRaw !== undefined && sinceRaw !== "" && sinceRaw !== "null") {
      if (!/^\d+$/.test(sinceRaw)) {
        return c.json({ error: { code: "bad_cursor", message: "since must be a non-negative integer cursor" } }, 400);
      }
      since = sinceRaw;
    }
    // `limit` — page size, default 100, clamped to 1..500 (the EventsClient's declared server clamp).
    const limitRaw = c.req.query("limit");
    let limit = 100;
    if (limitRaw !== undefined && limitRaw !== "") {
      const n = Number(limitRaw);
      if (!Number.isFinite(n) || n <= 0) {
        return c.json({ error: { code: "bad_request", message: "limit must be a positive number" } }, 400);
      }
      limit = Math.min(Math.trunc(n), 500);
    }
    const type = c.req.query("type") || undefined; // optional server-side type filter

    const page = await drainEvents({ since, limit, type });
    return c.json({
      data: page.events,
      meta: { version: "v1", count: page.count, nextCursor: page.nextCursor, hasMore: page.hasMore },
    });
  });

  // ── the engine's own routes (built with zero packs; mounted for completeness). ──
  app.route("/v1/workflow", os.workflowRoute);
  app.route("/v1/approvals", os.approvalsRoute);

  return app;
}
