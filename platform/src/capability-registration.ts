// =============================================================================
// The HTTP capability-registration SERVICE (E-PH M3a). PLATFORM-INDEPENDENCE (I-PI).
// =============================================================================
// A tenant in a SEPARATE process POSTs a MANIFEST OF DATA (definition/selector metadata + the handler keys it
// will service) + an adapterCallbackUrl. This module: (1) validates the manifest (zod, fail-closed), (2)
// SYNTHESIZES a proxy `handler.run` for each handler key — a closure that calls the cross-process callback
// executor (engine/adapter-callback.ts) — and (3) registers the resulting CapabilityPacks through the EXISTING
// in-process registration seam (os.registerCapabilityPacks). The OS imports ZERO tenant code: it registers DATA
// and calls the tenant back over HTTP. Deregistration is the inverse. A store persists the manifest so the OS
// can RE-HYDRATE (re-synthesize the proxies) after a restart.
//
// DESIGN: platform/docs/DESIGN-m3a-capability-callback.md.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CapabilityPack, PackHandler } from "./engine/capability-pack.js";
import type { WorkflowDefinition } from "./engine/definitions.js";
import type { SelectableCapability } from "./engine/capability-selector.js";
import type { Handler } from "./engine/handlers.js";
import { executeViaCallback } from "./engine/adapter-callback.js";

// ── The registry snapshot the register/deregister paths return (mirrors OsEngineRuntime's shape). ──
export interface RegistrySnapshot {
  registeredPackIds: string[];
  enqueueKeys: string[];
  selectors: SelectableCapability[];
}

// ── The minimal OS surface this service needs — so the service does NOT import engine-runtime (and therefore
// does not pull the db/client singleton at import time; tests stay DB-free). OsEngineRuntime satisfies it. ──
export interface CapabilityRegistrar {
  registerCapabilityPacks(packs: CapabilityPack[]): RegistrySnapshot;
  deregisterCapabilityPacks(packIds: string[]): RegistrySnapshot;
}

// ── tunables threaded into every synthesized proxy (timeouts/retry/injected fetch — the last for tests only). ──
export interface AdapterExecOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  baseBackoffMs?: number;
  fetchImpl?: typeof fetch;
}

// ── The manifest zod schema. The tenant sends DATA only — a selector over HTTP is intent-only (a `match`
// predicate is CODE and can never cross the wire); step fields beyond the required ones are passed through
// verbatim (verifierId/stopCondition/agent/…). Fail-closed: a malformed manifest parses to an error, nothing
// is registered. ──
const manifestStepSchema = z
  .object({
    stepType: z.string(),
    owner: z.string(),
    effect: z.string(),
    maxAttempts: z.number().int().positive(),
    handler: z.string(),
  })
  .passthrough();

const manifestDefinitionSchema = z.object({
  key: z.string().min(1),
  description: z.string(),
  steps: z.array(manifestStepSchema).min(1),
});

const manifestSelectorSchema = z.object({
  definitionKey: z.string().min(1),
  intent: z.string().min(1).optional(),
});

const manifestPackSchema = z.object({
  id: z.string().min(1),
  definitions: z.array(manifestDefinitionSchema).optional().default([]),
  selectors: z.array(manifestSelectorSchema).optional().default([]),
  verifierIds: z.array(z.string()).optional().default([]), // reserved — verifier proxying is deferred (design §7)
  handlerKeys: z.array(z.string()).optional().default([]),
});

export const RegistrationRequestSchema = z.object({
  tenantId: z.string().min(1),
  adapterCallbackUrl: z.string().url(),
  token: z.string().min(1).optional(),
  packs: z.array(manifestPackSchema).min(1),
});

export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>;
export type ManifestPack = z.infer<typeof manifestPackSchema>;

// ── The persisted registration (the store row). The MANIFEST is retained so the OS can re-synthesize the proxy
// closures on boot. The token is the ONLY tenant secret the OS holds — one the tenant itself handed over. ──
export interface StoredRegistration {
  tenantId: string;
  adapterCallbackUrl: string;
  token: string;
  packs: ManifestPack[];
  packIds: string[];
}

export interface CapabilityRegistrationStore {
  put(rec: StoredRegistration): Promise<void>;
  get(tenantId: string): Promise<StoredRegistration | null>;
  delete(tenantId: string): Promise<void>;
  list(): Promise<StoredRegistration[]>;
}

// ── An in-memory store — the default, and what the DB-free tests use. ─────────────────────────────
export class InMemoryCapabilityRegistrationStore implements CapabilityRegistrationStore {
  private readonly rows = new Map<string, StoredRegistration>();
  async put(rec: StoredRegistration): Promise<void> {
    this.rows.set(rec.tenantId, rec);
  }
  async get(tenantId: string): Promise<StoredRegistration | null> {
    return this.rows.get(tenantId) ?? null;
  }
  async delete(tenantId: string): Promise<void> {
    this.rows.delete(tenantId);
  }
  async list(): Promise<StoredRegistration[]> {
    return [...this.rows.values()];
  }
}

// ── synthesize ONE proxy handler: an emit-free closure that delegates step execution to the tenant callback.
// This is the crux of I-PI — the OS holds a FUNCTION it authored (a proxy), never tenant code; the actual work
// happens in the tenant process, reached only over HTTP. ──
function synthesizeProxyHandler(args: {
  adapterCallbackUrl: string;
  token: string;
  tenantId: string;
  packId: string;
  handlerKey: string;
  exec?: AdapterExecOptions;
}): PackHandler {
  const run: Handler = async (ctx) =>
    executeViaCallback({
      adapterCallbackUrl: args.adapterCallbackUrl,
      token: args.token,
      tenantId: args.tenantId,
      packId: args.packId,
      handlerKey: args.handlerKey,
      ctx,
      timeoutMs: args.exec?.timeoutMs,
      maxAttempts: args.exec?.maxAttempts,
      baseBackoffMs: args.exec?.baseBackoffMs,
      fetchImpl: args.exec?.fetchImpl,
    });
  return { key: args.handlerKey, run };
}

// ── Build the CapabilityPacks (proxies synthesized) from a stored/validated manifest. Shared by the register
// path and the boot re-hydration path — so a re-hydrated tenant is byte-for-byte the registered one. ──
export function buildCapabilityPacks(
  tenantId: string,
  adapterCallbackUrl: string,
  token: string,
  packs: ManifestPack[],
  exec?: AdapterExecOptions,
): CapabilityPack[] {
  return packs.map((p) => {
    const selectors: SelectableCapability[] = (p.selectors ?? []).map((s) => ({
      definitionKey: s.definitionKey,
      selector: s.intent !== undefined ? { intent: s.intent } : undefined,
    }));
    const handlers: PackHandler[] = (p.handlerKeys ?? []).map((handlerKey) =>
      synthesizeProxyHandler({ adapterCallbackUrl, token, tenantId, packId: p.id, handlerKey, exec }),
    );
    return {
      id: p.id,
      definitions: (p.definitions ?? []) as unknown as WorkflowDefinition[],
      selectors,
      handlers,
    };
  });
}

// ── registerTenantManifest — the service behind POST /v1/capabilities. Validates, synthesizes proxies,
// registers (fail-closed on cross-pack conflict — the engine throws CapabilityConflictError), then persists. ──
// Register-BEFORE-persist: a conflicting manifest throws and leaves NOTHING stored. Returns the snapshot + the
// callback token the tenant must authenticate.
export async function registerTenantManifest(
  os: CapabilityRegistrar,
  store: CapabilityRegistrationStore,
  request: RegistrationRequest,
  exec?: AdapterExecOptions,
): Promise<RegistrySnapshot & { token: string }> {
  const token = request.token && request.token.length > 0 ? request.token : mintToken();
  const capPacks = buildCapabilityPacks(request.tenantId, request.adapterCallbackUrl, token, request.packs, exec);
  const snap = os.registerCapabilityPacks(capPacks); // may THROW CapabilityConflictError (fail-closed).
  await store.put({
    tenantId: request.tenantId,
    adapterCallbackUrl: request.adapterCallbackUrl,
    token,
    packs: request.packs,
    packIds: capPacks.map((p) => p.id),
  });
  return { ...snap, token };
}

// ── deregisterTenant — the service behind DELETE /v1/capabilities/:tenantId. Removes the tenant's packs from the
// OS registry (goals route rebuilt, proxies unwired) and forgets the stored row. Unknown tenant = idempotent
// no-op snapshot. This is the I-PI survival lever: deleting a tenant never breaks the OS. ──
export async function deregisterTenant(
  os: CapabilityRegistrar,
  store: CapabilityRegistrationStore,
  tenantId: string,
): Promise<RegistrySnapshot & { deregisteredPackIds: string[] }> {
  const rec = await store.get(tenantId);
  const packIds = rec?.packIds ?? [];
  const snap = os.deregisterCapabilityPacks(packIds);
  await store.delete(tenantId);
  return { ...snap, deregisteredPackIds: packIds };
}

// ── rehydrateRegistrations — boot-time re-registration from durable storage. Re-synthesizes every tenant's
// proxies and re-registers them, so the OS resumes serving tenant capabilities after a restart WITHOUT importing
// any tenant code. Best-effort per tenant: one tenant's conflict/failure never aborts the others (fail-open on
// re-hydration is the safe choice — a tenant that fails to re-register is simply absent, the OS still boots). ──
export async function rehydrateRegistrations(
  os: CapabilityRegistrar,
  store: CapabilityRegistrationStore,
  exec?: AdapterExecOptions,
): Promise<{ tenants: number; packs: number; failures: Array<{ tenantId: string; error: string }> }> {
  const rows = await store.list();
  let packs = 0;
  const failures: Array<{ tenantId: string; error: string }> = [];
  for (const rec of rows) {
    try {
      const capPacks = buildCapabilityPacks(rec.tenantId, rec.adapterCallbackUrl, rec.token, rec.packs, exec);
      os.registerCapabilityPacks(capPacks);
      packs += capPacks.length;
    } catch (e) {
      failures.push({ tenantId: rec.tenantId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { tenants: rows.length - failures.length, packs, failures };
}

function mintToken(): string {
  return `os-cbk-${randomUUID()}`;
}
