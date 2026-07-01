-- 0054 prod_write_override_events — Sprint 1.1, RS-DOS-v1 §30/§57 / DRB-v1 CONFLICT-03 closure.
-- The append-only, immutable, tamper-evident LEDGER of every audited break-glass prod-write override.
-- This is the durable record behind src/db/break-glass.ts (issueGrant/consumeGrant). It REPLACES the
-- ALLOW_PROD_DB_WRITE env-var escape hatch (removed from code in this sprint) with a founder-signed,
-- single-use, short-TTL, table+operation-SCOPED grant whose entire lifecycle (issued / consumed / denied)
-- is recorded here as immutable history.
--
-- WHY A LEDGER, NOT A MUTABLE GRANTS TABLE:
--   Single-use is enforced STRUCTURALLY, not by a mutable consumed flag a bug could flip back:
--     * one 'issued'   event per action_id  (a grant is minted exactly once)  -- partial unique index
--     * one 'consumed' event per action_id  (the grant is spent exactly once) -- partial unique index
--   The 2nd consume attempts to INSERT a 2nd 'consumed' row and hits the unique index (SQLSTATE 23505) so
--   the runner-side consumeGrant rejects it. There is NO update-in-place, so the immutability trigger and
--   the append-only RLS (below) make the record genuinely tamper-evident: history can only grow.
--
-- EXPAND-ONLY / production-safe (DRB-v1 section 8):
--   ONE new table + one guard function. NO ALTER/DROP/RENAME/type-change of any existing table. Greenfield
--   and empty at create time, so the CREATE INDEX statements lock a brand-new relation with no live traffic
--   (no ACCESS-EXCLUSIVE stall on the shared :6543 pooler -- the same reasoning 0052 documented). Correct to
--   run inside the migrator per-file transaction (migrate-core.applyOne); no CREATE INDEX CONCURRENTLY.
--   No backfill, no data migration, so no PITR snapshot precondition.
--   NOT founder-gated: additive, off every serving path, mutates no live critical-path table, so it applies
--   on a plain db:migrate (NOT added to GATED_MIGRATIONS).
--
-- RLS + immutability (the 0028/0032/0035/0052 tamper-evidence pattern):
--   ENABLE RLS in THIS migration (a NEW table is invisible to RLS until it does). anon/authenticated get NO
--   policy so default-deny (the PostgREST surface is closed). rumah_app (the non-superuser runtime role,
--   0021) gets INSERT + SELECT ONLY -- no UPDATE/DELETE policy, so RLS DENIES mutation (append-only for the
--   app path). Defense-in-depth: a BEFORE UPDATE OR DELETE trigger RAISES for EVERY role (the owner/migrator
--   bypasses RLS but NOT a trigger -- the 0028/0035 pattern), so the override ledger is immutable even from
--   an owner-context bug. rumah_app cannot DISABLE TRIGGER nor set session_replication_role (non-superuser,
--   0021/0028), so the guard genuinely binds the app path.
--
-- SCOPE LINE (what this grant CANNOT do -- the financial-SoR carve-out, RS-DOS section 57.6):
--   A break-glass grant authorizes ONE table + ONE operation for the PLATFORM RUNNER to APPLY. It mints NO
--   database privilege and CANNOT disable any trigger. The financial source-of-record immutability triggers
--   (invoice_immutability_guard 0028/0030, operator_audit append-only RLS 0032, the c12 append-only guards
--   0052) therefore remain NON-OVERRIDABLE under ANY grant -- a grant for _migrations/migrate does not, and
--   structurally cannot, let anyone UPDATE/DELETE an issued invoice or an audit row.
--
-- ROLLBACK: forward-only (ADR-005); 0054_..down.sql drops the table + guard function. Rolling back DISCARDS
-- the override audit history -- only safe while no real grant has been consumed (the ledger is still inert).

-- Dedicated append-only guard (self-contained; does not depend on 0052 c12_append_only_guard so this
-- migration stands alone). Any UPDATE/DELETE on the ledger is rejected for EVERY role (owner included).
CREATE OR REPLACE FUNCTION prod_write_override_append_only_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'prod_write_override_events is append-only: % is forbidden (break-glass history is immutable/tamper-evident)', TG_OP
    USING ERRCODE = 'restrict_violation';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE prod_write_override_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id       uuid NOT NULL,                       -- the grant identity (one issued + at most one consumed)
  event_type      text NOT NULL,                       -- 'issued' | 'consumed' | 'denied'
  table_name      text NOT NULL,                       -- SCOPE: the single table the grant authorizes
  op              text NOT NULL,                        -- SCOPE: the single operation (migrate|insert|update|delete|...)
  issued_by       text,                                 -- founder identity that signed the grant (audit; on 'issued')
  credential_ref  text,                                 -- reference to the PLATFORM signing-key store (NEVER the key)
  signature       text,                                 -- HMAC over the canonical grant payload (a MAC, not a secret)
  nonce           text,                                 -- per-grant random, part of the signed payload (anti-collision)
  url_fingerprint text,                                 -- sha256(target DATABASE_URL) -- binds the grant; never the raw url
  expires_at      timestamptz,                          -- short-TTL absolute expiry (on 'issued')
  ttl_seconds     integer,                              -- the TTL the grant was minted with
  reason          text,                                 -- why the break-glass was needed (audit)
  denied_reason   text,                                 -- on 'denied': bad-signature | expired | scope-mismatch | already-consumed | ...
  payload         jsonb,                                -- extra context (PII-minimised by the caller)
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prod_write_override_event_type_chk CHECK (event_type IN ('issued','consumed','denied')),
  CONSTRAINT prod_write_override_ttl_pos CHECK (ttl_seconds IS NULL OR ttl_seconds > 0)
);

-- SINGLE-USE, enforced by the schema (not a flag): exactly one issue and at most one consume per action_id.
CREATE UNIQUE INDEX prod_write_override_one_issue_per_action
  ON prod_write_override_events(action_id) WHERE event_type = 'issued';
CREATE UNIQUE INDEX prod_write_override_one_consume_per_action
  ON prod_write_override_events(action_id) WHERE event_type = 'consumed';
-- (no unique on 'denied' -- every failed/attacked consume attempt is recorded: the attempt audit trail.)
CREATE INDEX prod_write_override_action_idx  ON prod_write_override_events(action_id);
CREATE INDEX prod_write_override_created_idx ON prod_write_override_events(created_at DESC);

ALTER TABLE prod_write_override_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_insert ON prod_write_override_events FOR INSERT TO rumah_app WITH CHECK (true);
CREATE POLICY rumah_app_select ON prod_write_override_events FOR SELECT TO rumah_app USING (true);
-- (no UPDATE/DELETE policy -> RLS denies mutation for rumah_app: append-only.)
CREATE TRIGGER prod_write_override_append_only_trg
  BEFORE UPDATE OR DELETE ON prod_write_override_events
  FOR EACH ROW EXECUTE FUNCTION prod_write_override_append_only_guard();
