// =============================================================================
// E-PH M3a PROOF — the cross-process adapter-callback seam (DB-FREE).
// =============================================================================
// Proves the platform-independence invariant (I-PI) at M3a scope WITHOUT a live DB or a real tenant:
//   (1) EXECUTION: a FAKE tenant HTTP server (in-process, ephemeral port) exposes an adapter callback. A pack is
//       registered via POST /v1/capabilities (the tenant sends DATA + a callback URL, NOT code). The engine's
//       handler dispatch (runHandler) steps the synthesized PROXY handler → the OS POSTs the step context to the
//       fake tenant → gets a HandlerResult back. The OS executed a capability whose CODE it does not contain.
//   (2) ISOLATION / SURVIVAL: deregistering a tenant (DELETE /v1/capabilities/:id) — and separately KILLING a
//       tenant's server — leaves the OS serving /v1/health and OTHER tenants' packs. A dead tenant degrades one
//       run (a typed { ok:false }); it never crashes the OS.
//
// DB-FREE: this proof never enqueues/ticks/hits a DB-backed endpoint, so the db/client singleton is constructed
// (fake DATABASE_URL) but never dialed. See test/_helpers/fake-db-env.ts.
import "./_helpers/fake-db-env.js"; // MUST be first — sets DATABASE_URL before src/db/client.ts evaluates.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "../src/server.js";
import { createOsEngineRuntime } from "../src/engine-runtime.js";
import { runHandler, type StepContext, type HandlerResult } from "../src/engine/handlers.js";
import { selectCapability } from "../src/engine/capability-selector.js";
import { InMemoryCapabilityRegistrationStore } from "../src/capability-registration.js";
import type { OsEngineRuntime } from "../src/engine-runtime.js";
import type { Hono } from "hono";
import http from "node:http";

// ── A FAKE tenant: an in-process HTTP server exposing an adapter callback the OS calls back to. It records
// every call it receives and (by default) returns a successful HandlerResult echoing the step input. ──
interface AdapterCall {
  authorization: string | undefined;
  handlerKey: string;
  packId: string;
  tenantId: string;
  idempotencyKey: string;
  stepContext: { runId: string; seq: number; attempt: number; input: Record<string, unknown>; checkpoint: unknown };
}

interface FakeTenant {
  url: string;
  calls: AdapterCall[];
  respondWith(fn: (call: AdapterCall) => { status: number; body: unknown }): void;
  close(): Promise<void>;
}

async function startFakeTenant(): Promise<FakeTenant> {
  const calls: AdapterCall[] = [];
  let responder: (call: AdapterCall) => { status: number; body: unknown } = (call) => ({
    status: 200,
    body: { ok: true, result: { echoedInput: call.stepContext.input, servicedBy: "fake-tenant" }, checkpoint: { done: true } },
  });

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const parsed = JSON.parse(raw || "{}");
      const call: AdapterCall = {
        authorization: req.headers["authorization"] as string | undefined,
        handlerKey: parsed.handlerKey,
        packId: parsed.packId,
        tenantId: parsed.tenantId,
        idempotencyKey: parsed.idempotencyKey,
        stepContext: parsed.stepContext,
      };
      calls.push(call);
      const { status, body } = responder(call);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("failed to bind fake tenant");
  const url = `http://127.0.0.1:${addr.port}/os-adapter`;

  return {
    url,
    calls,
    respondWith(fn) {
      responder = fn;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// a StepContext the engine would build — tx/emit are OS-internal and the proxy never serializes them.
function fakeStepContext(over: Partial<StepContext> = {}): StepContext {
  return {
    tx: {},
    runId: "run-abc",
    seq: 0,
    attempt: 1,
    checkpoint: null,
    input: { foo: "bar" },
    emit: async () => {},
    ...over,
  };
}

let os: OsEngineRuntime;
let app: Hono<any>;
const store = new InMemoryCapabilityRegistrationStore();

beforeAll(() => {
  os = createOsEngineRuntime();
  // Fast adapter-exec profile so the dead-tenant path fails quickly (no long production backoff in tests).
  app = createServer(os, { registrationStore: store, adapterExec: { maxAttempts: 2, baseBackoffMs: 1, timeoutMs: 800 } }) as Hono<any>;
});

describe("M3a (1) — the OS executes a capability it does NOT contain the code for", () => {
  let tenant: FakeTenant;
  const TOKEN = "shared-secret-A";

  beforeAll(async () => {
    tenant = await startFakeTenant();
    const manifest = {
      tenantId: "tenant-A",
      adapterCallbackUrl: tenant.url,
      token: TOKEN,
      packs: [
        {
          id: "tenantA.invoice.pack",
          definitions: [
            {
              key: "tenantA.invoice.send",
              description: "send an invoice (tenant code lives in the tenant process)",
              steps: [{ stepType: "effect", owner: "tenant", effect: "emit-only", maxAttempts: 3, handler: "tenantA.invoice.send.run" }],
            },
          ],
          selectors: [{ definitionKey: "tenantA.invoice.send", intent: "invoice.send" }],
          handlerKeys: ["tenantA.invoice.send.run"],
        },
      ],
    };
    const res = await app.fetch(
      new Request("http://os/v1/capabilities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(manifest),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.registeredPackIds).toContain("tenantA.invoice.pack");
    expect(body.enqueueKeys).toContain("tenantA.invoice.send");
    expect(body.selectors).toContain("tenantA.invoice.send");
    expect(body.token).toBe(TOKEN); // the OS stores + presents the tenant-supplied token
  });

  afterAll(async () => {
    await tenant.close();
  });

  it("registration made the capability selectable (the goal would route to the tenant definition)", () => {
    const sel = selectCapability({ intent: "invoice.send" }, { registry: os.selectors() });
    expect(sel.kind).toBe("selected");
    if (sel.kind === "selected") expect(sel.definitionKey).toBe("tenantA.invoice.send");
  });

  it("the engine dispatch of the synthesized proxy handler CALLS BACK to the fake tenant and returns its result", async () => {
    // runHandler IS the engine's per-step handler dispatch. The registered handler is an OS-synthesized PROXY —
    // its run() calls the tenant over HTTP. The OS contains NO tenant code for this capability.
    const result: HandlerResult = await runHandler("tenantA.invoice.send.run", fakeStepContext({ runId: "run-77", seq: 2, input: { invoiceId: "INV-1" } }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toEqual({ echoedInput: { invoiceId: "INV-1" }, servicedBy: "fake-tenant" });
      expect(result.checkpoint).toEqual({ done: true });
    }

    // The fake tenant actually received the callback, authenticated, with the step identity as the idempotency key.
    expect(tenant.calls.length).toBe(1);
    const call = tenant.calls[0]!;
    expect(call.authorization).toBe(`Bearer ${TOKEN}`);
    expect(call.tenantId).toBe("tenant-A");
    expect(call.packId).toBe("tenantA.invoice.pack");
    expect(call.handlerKey).toBe("tenantA.invoice.send.run");
    expect(call.idempotencyKey).toBe("run-77:2"); // "<runId>:<seq>" — the engine step identity
    expect(call.stepContext.input).toEqual({ invoiceId: "INV-1" });
  });

  it("a tenant's own terminal { ok:false } is passed through verbatim (never coerced to ok:true)", async () => {
    tenant.respondWith(() => ({ status: 200, body: { ok: false, transient: false, error: "tenant_rejected_invoice" } }));
    const result = await runHandler("tenantA.invoice.send.run", fakeStepContext());
    expect(result).toEqual({ ok: false, transient: false, error: "tenant_rejected_invoice" });
    tenant.respondWith((call) => ({ status: 200, body: { ok: true, result: { echoedInput: call.stepContext.input }, checkpoint: {} } }));
  });
});

describe("M3a (2) — isolation / survival (I-PI): a removed or dead tenant never breaks the OS", () => {
  let tenantA: FakeTenant;
  let tenantB: FakeTenant;

  beforeAll(async () => {
    tenantA = await startFakeTenant();
    tenantB = await startFakeTenant();
    for (const [tenantId, packId, defKey, handlerKey, tenant, token] of [
      ["iso-A", "isoA.pack", "isoA.def", "isoA.run", tenantA, "tok-A"],
      ["iso-B", "isoB.pack", "isoB.def", "isoB.run", tenantB, "tok-B"],
    ] as const) {
      const res = await app.fetch(
        new Request("http://os/v1/capabilities", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tenantId,
            adapterCallbackUrl: tenant.url,
            token,
            packs: [
              {
                id: packId,
                definitions: [{ key: defKey, description: defKey, steps: [{ stepType: "effect", owner: "tenant", effect: "emit-only", maxAttempts: 1, handler: handlerKey }] }],
                selectors: [{ definitionKey: defKey, intent: defKey }],
                handlerKeys: [handlerKey],
              },
            ],
          }),
        }),
      );
      expect(res.status).toBe(200);
    }
  });

  afterAll(async () => {
    await tenantA.close().catch(() => {});
    await tenantB.close().catch(() => {});
  });

  it("both tenants registered; the OS health surface is green", async () => {
    const health = await app.fetch(new Request("http://os/v1/health"));
    expect(health.status).toBe(200);
    expect(os.registeredPackIds()).toEqual(expect.arrayContaining(["isoA.pack", "isoB.pack"]));
  });

  it("DEREGISTER tenant A: its pack leaves the registry, its proxy is unwired, but tenant B keeps serving and health stays green", async () => {
    const del = await app.fetch(new Request("http://os/v1/capabilities/iso-A", { method: "DELETE" }));
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as any;
    expect(delBody.deregisteredPackIds).toContain("isoA.pack");

    // A's capability is gone from the registry + no longer goal-selectable.
    expect(os.registeredPackIds()).not.toContain("isoA.pack");
    expect(selectCapability({ intent: "isoA.def" }, { registry: os.selectors() }).kind).toBe("no-match");

    // A's proxy handler is unwired: a stale step gets a CLEAN terminal failure (not a crash).
    const staleA = await runHandler("isoA.run", fakeStepContext());
    expect(staleA.ok).toBe(false);
    if (!staleA.ok) expect(staleA.error).toContain("unknown handler");

    // The OS is still serving, and tenant B's capability still executes end-to-end.
    const health = await app.fetch(new Request("http://os/v1/health"));
    expect(health.status).toBe(200);
    const bResult = await runHandler("isoB.run", fakeStepContext({ runId: "b-run", seq: 0 }));
    expect(bResult.ok).toBe(true);
    expect(tenantB.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("KILL tenant B's server: its proxy returns a TRANSIENT { ok:false } (engine retry path), OS never crashes", async () => {
    await tenantB.close();
    const dead = await runHandler("isoB.run", fakeStepContext({ runId: "b-run-2", seq: 0 }));
    expect(dead.ok).toBe(false);
    if (!dead.ok) {
      expect(dead.transient).toBe(true); // → the engine's EXISTING retry/backoff path, no new goal transition
      expect(dead.error).toContain("adapter-callback");
    }
    // The OS survives a dead tenant.
    const health = await app.fetch(new Request("http://os/v1/health"));
    expect(health.status).toBe(200);
  });
});
