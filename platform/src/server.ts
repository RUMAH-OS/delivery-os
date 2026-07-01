// =============================================================================
// The OS runtime HTTP surface (Hono). The bare-OS API + the /v1 front door.
// =============================================================================
// Serves the OS's own control surface: liveness (/v1/health, /v1/heartbeat), the capability registry read
// (/v1/capabilities — the "zero tenant packs" observable), the goal front door (POST /v1/goals — fail-closed
// no-match on a bare OS), and the engine's own workflow/approvals routes. This is the OS running as a service
// that a tenant CONSUMES — the OS imports zero tenant code (PLATFORM-HOME-EXTRACTION.md §3.1 host model).
import { Hono } from "hono";
import type { Principal } from "./engine/human-principal.js";
import type { OsEngineRuntime } from "./engine-runtime.js";
import { stampHeartbeat, readHeartbeat, NODE_ID } from "./heartbeat.js";

export const OS_VERSION = "delivery-os-platform/M1";

export function createServer(os: OsEngineRuntime): Hono<{ Variables: { principal: Principal } }> {
  const app = new Hono<{ Variables: { principal: Principal } }>();

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
  app.post("/v1/capabilities", (c) =>
    c.json(
      {
        error: {
          code: "not_implemented",
          message:
            "runtime capability registration over HTTP (a tenant POSTs its manifest + adapter callback URL) is the M3 consume-flip surface. In M1 the registration API is the in-process os.registerCapabilityPacks() seam.",
        },
      },
      501,
    ),
  );

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

  // ── the engine's own routes (built with zero packs; mounted for completeness). ──
  app.route("/v1/workflow", os.workflowRoute);
  app.route("/v1/approvals", os.approvalsRoute);

  return app;
}
