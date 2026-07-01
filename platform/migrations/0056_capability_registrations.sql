-- 0056 Capability registrations (E-PH M3a) — the durable seam for the HTTP capability-registration API.
-- A tenant in a SEPARATE process POSTs a manifest of DATA (definitions/selectors + the handler keys it
-- services) + an adapter callback URL to POST /v1/capabilities. The OS synthesizes a PROXY handler per key
-- (a closure that calls the tenant back over HTTP — the OS imports ZERO tenant code) and registers them. Proxy
-- CLOSURES cannot be serialized, so to survive an OS restart the OS persists the tenant MANIFEST here and
-- RE-HYDRATES it on boot (re-synthesizing the proxies). This is the ONLY tenant secret the OS holds — a
-- shared callback token the tenant itself handed over (I-PI: the OS never stores a tenant DB credential).
-- DESIGN: platform/docs/DESIGN-m3a-capability-callback.md §8.
--
-- ── EXPAND-ONLY / production-safe (continues the 0052/0053/0054/0055 DRB-v1 §8 discipline) ───────────────────
--   * ADDITIVE ONLY: ONE new greenfield table. NO ALTER/DROP/RENAME/type-change of any existing table. Old
--     instances tolerate this schema (they never reference it) — an EXPAND that applies safely before the code
--     that reads it ships.
--   * The table is EMPTY at create, so its indexes lock a brand-new relation no live traffic references —
--     correct inside the migrator's per-file transaction (migrate-core.applyOne); NO CREATE INDEX CONCURRENTLY.
--   * No backfill / no data migration → no PITR precondition. NOT founder-gated (off every serving path) →
--     applies on a plain `db:migrate` (NOT in GATED_MIGRATIONS).
--
-- ── RLS (DRB-v1 §8: a new table enables RLS in the same migration) ──────────────────────────────────────────
--   Unlike the 0052/0055 append-only ledgers, this is a MUTABLE config table (a registration is upserted on
--   re-register and DELETEd on deregister), so rumah_app gets full CRUD policies. anon/authenticated get NO
--   policy → default-deny (the PostgREST surface stays closed). No append-only trigger (this table is meant to
--   be mutated by the registration service).
--
-- ROLLBACK: forward-only (ADR-005); 0056_..down.sql drops the table. Rolling back DISCARDS persisted tenant
-- registrations — only safe while no tenant relies on re-hydration surviving a restart.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE capability_registration (
  tenant_id            text PRIMARY KEY,                    -- the stable tenant id (the deregister key)
  adapter_callback_url text NOT NULL,                       -- where the OS POSTs step context to run a capability
  token                text NOT NULL,                       -- the shared callback secret the OS presents (tenant-supplied)
  packs                jsonb NOT NULL DEFAULT '[]'::jsonb,  -- the DATA manifest (definitions/selectors/verifierIds/handlerKeys)
  pack_ids             text[] NOT NULL DEFAULT '{}',        -- the pack ids this tenant registered (the deregister set)
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capability_registration_url_nonempty CHECK (length(adapter_callback_url) > 0),
  CONSTRAINT capability_registration_token_nonempty CHECK (length(token) > 0)
);
CREATE INDEX capability_registration_created_idx ON capability_registration(created_at);

-- RLS: rumah_app gets full CRUD (a mutable config table); anon/authenticated default-deny (no policy).
ALTER TABLE capability_registration ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_all ON capability_registration FOR ALL TO rumah_app USING (true) WITH CHECK (true);
