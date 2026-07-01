// =============================================================================
// The Postgres-backed CapabilityRegistrationStore (E-PH M3a durability). OS-owned platform table.
// =============================================================================
// Persists the tenant registration MANIFEST (never a proxy closure — closures cannot be serialized) into the
// platform-owned `capability_registration` table (migration 0056) so the OS can RE-HYDRATE after a restart. This
// file is the ONLY registration module that imports the db/client singleton; it is imported by boot (index.ts),
// never by the DB-free tests. The token stored here is the tenant's own shared secret — the OS holds NO tenant
// DB credential (I-PI).
import { sql } from "./db/client.js";
import type { CapabilityRegistrationStore, StoredRegistration, ManifestPack } from "./capability-registration.js";

export class PgCapabilityRegistrationStore implements CapabilityRegistrationStore {
  async put(rec: StoredRegistration): Promise<void> {
    // UPSERT on the tenant id — re-registration replaces the stored manifest (idempotent per tenant).
    await sql`
      INSERT INTO capability_registration (tenant_id, adapter_callback_url, token, packs, pack_ids, updated_at)
      VALUES (${rec.tenantId}, ${rec.adapterCallbackUrl}, ${rec.token},
              ${JSON.stringify(rec.packs)}::jsonb, ${rec.packIds}, now())
      ON CONFLICT (tenant_id) DO UPDATE SET
        adapter_callback_url = EXCLUDED.adapter_callback_url,
        token                = EXCLUDED.token,
        packs                = EXCLUDED.packs,
        pack_ids             = EXCLUDED.pack_ids,
        updated_at           = now()`;
  }

  async get(tenantId: string): Promise<StoredRegistration | null> {
    const rows = await sql<StoredRow[]>`
      SELECT tenant_id, adapter_callback_url, token, packs, pack_ids
      FROM capability_registration WHERE tenant_id = ${tenantId}`;
    const r = rows[0];
    return r ? toStored(r) : null;
  }

  async delete(tenantId: string): Promise<void> {
    await sql`DELETE FROM capability_registration WHERE tenant_id = ${tenantId}`;
  }

  async list(): Promise<StoredRegistration[]> {
    const rows = await sql<StoredRow[]>`
      SELECT tenant_id, adapter_callback_url, token, packs, pack_ids
      FROM capability_registration ORDER BY created_at`;
    return rows.map(toStored);
  }
}

interface StoredRow {
  tenant_id: string;
  adapter_callback_url: string;
  token: string;
  packs: ManifestPack[];
  pack_ids: string[];
}

function toStored(r: StoredRow): StoredRegistration {
  return {
    tenantId: r.tenant_id,
    adapterCallbackUrl: r.adapter_callback_url,
    token: r.token,
    packs: r.packs,
    packIds: r.pack_ids,
  };
}
