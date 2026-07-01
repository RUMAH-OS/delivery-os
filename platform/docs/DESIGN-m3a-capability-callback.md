# DESIGN — E-PH M3a: HTTP capability-registration seam + cross-process adapter-callback executor

**Slice:** S-PH.3 / G-PH3 (the additive, NON-DESTRUCTIVE half). **Author:** rumah-os-builder.
**Invariant governed:** I-PI (platform-independence, founder-locked) — the OS depends on NO tenant, imports
NO tenant code, holds NO tenant credential. It calls the tenant ONLY through registered adapter callbacks.

This note states the protocol and the defaults locked for the founder to review, then the code is built to it.

## 1. The seam in one sentence

A tenant running in a SEPARATE process POSTs a *manifest of DATA* (definition/selector metadata + the list of
handler keys it will service) plus an `adapterCallbackUrl` to `POST /v1/capabilities`. The OS synthesizes each
`handler.run` as a PROXY closure that, when the engine steps it, HTTP-POSTs the step context back to the
tenant's callback URL and awaits a `HandlerResult`. The OS registers those proxies through the EXISTING
in-process `registerCapabilityPacks()` seam. The registry lives in the OS; the entries are tenant data; handler
EXECUTION happens by the OS calling the tenant — never by importing tenant code.

## 2. Registration request — `POST /v1/capabilities`

```jsonc
{
  "tenantId": "rumah-admin",                       // stable tenant id (the deregister key)
  "adapterCallbackUrl": "https://tenant.host/os-adapter",
  "token": "shared-secret-optional",               // OPTIONAL; if omitted the OS mints + returns one
  "packs": [
    {
      "id": "invoice.send.pack",                   // pack id (idempotency + conflict key in the engine)
      "definitions": [ /* WorkflowDefinition[] — DATA: steps reference handler KEYS, not code */ ],
      "selectors":   [ /* { definitionKey, selector: { intent } } — intent-only over HTTP (see §6) */ ],
      "verifierIds": [ /* reserved — verifier proxying is deferred; see §7 */ ],
      "handlerKeys": [ "invoice.send.run" ]        // the keys the OS synthesizes proxies for
    }
  ]
}
```

**Response** (`200`): `{ registeredPackIds, enqueueKeys, selectors, token }` — the same registry snapshot the
in-process API returns, plus the callback token the tenant must authenticate. Validation is zod; a malformed
manifest is a `400` (fail-closed, nothing registered). A cross-pack key conflict surfaces the engine's
`CapabilityConflictError` as a `409` (fail-closed — no silent last-writer-wins). Registration is idempotent per
`(tenantId, packId)`.

## 3. Execution callback — OS → tenant (sync HTTP request/response, v1)

When the engine steps a proxied handler, the OS POSTs to `adapterCallbackUrl`:

```jsonc
{
  "tenantId": "rumah-admin",
  "packId": "invoice.send.pack",
  "handlerKey": "invoice.send.run",
  "idempotencyKey": "<runId>:<seq>",               // the engine step identity (§5)
  "stepContext": { "runId", "seq", "attempt", "checkpoint", "input" }   // SERIALIZABLE subset only
}
```

The OS awaits a JSON `HandlerResult` — exactly the engine's contract:
`{ ok:true, result, checkpoint, awaitEventId? }` or `{ ok:false, transient, error }`.

**What is deliberately NOT sent:** the Drizzle `tx` handle and the `emit` closure. A proxied handler is
emit-free and runs in the tenant's process; it returns `result`/`checkpoint` and the OS engine writes the step
done in its OWN transaction. (Async-via-outbox — the tenant ACKs fast and later POSTs the result to the engine's
existing await-callback completer — is the documented v2 option; v1 is synchronous for a reviewable first cut.)

## 4. Auth — a per-registration shared secret, tenant-authenticates-the-OS

The tenant supplies a `token` at registration (or the OS mints one and returns it). The OS **stores only that
token** — never a tenant DB credential — and presents it on every callback as `Authorization: Bearer <token>`.
The tenant uses it to authenticate that the caller really is its OS. This is the ONLY secret the OS holds for a
tenant, and it is one the tenant itself handed over. (OS-authenticates-tenant, i.e. verifying the tenant at
registration time, is the operator-plane's job in a later slice; M3a is the execution seam.)

## 5. Idempotency

The idempotency key is the **engine step identity** `"<runId>:<seq>"`. The engine may re-deliver a step (crash
recovery, lease expiry, transient-retry) — the same `(runId, seq)` re-issues the SAME idempotencyKey. The tenant
MUST dedupe on it so an at-least-once callback is effectively-once at the tenant. `attempt` is included for
observability but is NOT part of the key (a retry is the same logical step).

## 6. Failure — timeout + bounded retry, then the engine's EXISTING error path

The callback executor applies a per-attempt **timeout** (default 10s via `AbortController`) and a **bounded
retry** (default 3 attempts, capped exponential backoff) for TRANSPORT-class failures only: network error,
timeout, HTTP 5xx, or a 429. A 4xx (other than 429) is a tenant contract error and is NOT retried. On
exhaustion the proxy returns `{ ok:false, transient:true, error }` — so the step fails through the engine's
ALREADY-EXISTING retry/backoff/terminal path (§advanceNextReadyStep). No new goal transition is invented.
Fail-closed: the proxy NEVER fabricates an `ok:true`. A well-formed `{ ok:false, transient:false }` from the
tenant is passed through verbatim (the tenant's own terminal failure).

## 7. Isolation / survival (the I-PI proof)

- A callback failure returns a typed `HandlerResult` — it NEVER throws out of the engine. A dead/slow tenant
  degrades that one run; the OS keeps serving.
- `DELETE /v1/capabilities/:tenantId` deregisters the tenant's packs: its selectors leave the goals registry
  (no longer routable), its proxy handlers are unregistered (a stale step gets `unknown handler` — a clean
  terminal step failure, not a crash), and OTHER tenants' packs are untouched. Deleting a tenant ⇒ the OS keeps
  serving `/v1/health` and every other tenant's capability. This is proven by test.
- Verifier proxying is **deferred**: a verifier runs in-process inside the engine's loop control and cannot be a
  fire-and-return proxy without a protocol for the loop. `verifierIds` is accepted (reserved) but no phantom
  verifier is registered in M3a — fail-closed rather than register a verifier the OS cannot actually run.

## 8. Durability — migration `0056_capability_registrations.sql` (additive, forward-only)

Proxy handlers are synthesized CLOSURES; they cannot be persisted. To survive an OS restart the OS persists the
tenant *manifest* (`tenant_id` PK, `adapter_callback_url`, `token`, `manifest jsonb`, timestamps) in a NEW,
greenfield, expand-only table `capability_registration`. It touches NO existing table. On boot the OS
**re-hydrates**: it reads every row and re-runs the SAME synth-and-register path, reconstructing the proxies.
A `CapabilityRegistrationStore` port has two impls: an in-memory store (used by tests — DB-free) and a
Postgres-backed store (used by the running OS). Registration writes the row; deregistration deletes it.

## 9. Files

- `src/engine/adapter-callback.ts` — the callback executor (timeout, bounded retry, typed errors; imports NO tenant module).
- `src/capability-registration.ts` — the manifest zod schema, proxy synthesis, register/deregister service, the store port + in-memory + Postgres impls, and `rehydrate()`.
- `src/server.ts` — `POST /v1/capabilities` (implemented) + `DELETE /v1/capabilities/:tenantId`.
- `src/engine/{capability-pack,handlers,definitions,verifiers}.ts` — additive `deregister`/`unregister` support.
- `src/engine-runtime.ts` — `deregisterCapabilityPacks()`.
- `src/index.ts` — boot-time re-hydration from the Postgres store.
- `migrations/0056_capability_registrations.sql` (+ `.down.sql`).
</content>
</invoke>
