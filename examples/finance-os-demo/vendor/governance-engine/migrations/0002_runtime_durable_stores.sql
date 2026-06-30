-- governance-engine — Runtime durable stores (C12): the 6 stores + their RLS/immutability guards.
--
-- SCOPE NOTE (read this): this file ships the C12 durable-store DDL as the consumer copy-in TEMPLATE (the complete,
-- applyable set — the 6 tables + full RLS policy set + the guard functions/triggers, with `{{app_role}}` the only
-- substitution and a paired DOWN in `0002_runtime_durable_stores.down.sql`; see `migrations/README.md`) AND as the
-- `runtime-stores-cage.ts` PINNED REFERENCE (the cage parses it to prove the in-memory RuntimeStoresPort adapter
-- honors the same invariants the DB triggers enforce). It is the governance analogue of the slice-1
-- `0001_goal_contract.sql`: the canonical DDL shipped WITH the package so the cage runs in any checkout. The
-- reference Postgres adapter that issues the SQL behind the RuntimeStoresPort lives in `../adapters/postgres/`.
--
-- PROVENANCE: lifted verbatim (invariants unchanged) from `rumah-admin/migrations/0052_runtime_durable_stores.sql`.
-- The ONLY de-admin'ing is the RLS role, parameterized as `{{app_role}}` (the guard FUNCTIONS reference no role —
-- the cage parses the function bodies, which are identical to admin's). When the admin sibling repo is present,
-- the cage ALSO parses admin's real 0052 and asserts this copy has not drifted from it.
--
-- THE C12 INVARIANTS (what the cage + the in-memory adapter must honor):
--   * APPEND-ONLY (goal_delta_ledger · attempt_ledger · dead_letter · portfolio_cost_ledger): a BEFORE UPDATE OR
--     DELETE trigger (`c12_append_only_guard`) RAISES for every role. STRUCTURAL in the port (no mutation method).
--   * IDEMPOTENCY WRITE-ONCE (idempotency_store): `c12_idempotency_guard` — key/created_at/ttl/expires_at are
--     immutable; consumed_at is write-once. NON-structural → the cage proves the adapter honors it.
--   * DURABLE BREAKER (circuit_breaker): MUTABLE closed→open→half_open→closed CAS with a cooldown that survives a
--     restart. NON-structural → the cage proves the adapter honors the cooldown rule.
--   * goal_delta_ledger idempotent on (goal_id, cycle); attempt_ledger unique on (step_id, attempt).
--
-- ── EXPAND-ONLY / production-safe (DRB-v1 §8) ───────────────────────────────────────────────────────────
--   ADDITIVE ONLY: six NEW tables; greenfield + EMPTY at create → the CREATE INDEX statements lock brand-new
--   relations no live traffic references; correct inside the migrator's per-file transaction; no backfill, no
--   PITR precondition; NOT founder-gated (off the serving path).
--
-- ── RLS + immutability ──────────────────────────────────────────────────────────────────────────────────
--   Every table ENABLEs RLS in THIS migration. anon/authenticated get NO policy → default-deny. The runtime
--   role {{app_role}} gets exactly the policies each store's invariant permits — append-only stores get
--   INSERT+SELECT only (no UPDATE/DELETE policy → RLS DENIES mutation). Defense-in-depth: the four append-only
--   stores ALSO carry a BEFORE UPDATE/DELETE trigger that RAISES regardless of role (the owner/migrator bypasses
--   RLS, but NOT a trigger). {{app_role}} is non-superuser — it cannot DISABLE TRIGGER or set
--   session_replication_role, so these guards genuinely bind the app path.
--
-- ROLLBACK: forward-only (ADR-005); a paired down migration drops the six tables + the two guard functions.

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Shared guard functions (reused by the append-only tables + the idempotency write-once rule).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Generic append-only guard: any UPDATE or DELETE on an attached table is rejected for EVERY role (owner
-- included). History is immutable by construction, not by code discipline.
CREATE OR REPLACE FUNCTION c12_append_only_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only store %: % is forbidden (history is immutable)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Idempotency write-once guard: the key/created_at/ttl/expires_at are immutable; consumed_at is WRITE-ONCE
-- (once a side-effect is confirmed, the intent can never be un-consumed or re-consumed). DELETE is NOT
-- handled here — it is denied to {{app_role}} via RLS (no DELETE policy) while the owner-run TTL reaper may
-- still prune expired keys (a maintenance path, not an app path).
CREATE OR REPLACE FUNCTION c12_idempotency_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.idempotency_key <> OLD.idempotency_key
     OR NEW.created_at   <> OLD.created_at
     OR NEW.ttl_seconds  <> OLD.ttl_seconds
     OR NEW.expires_at   <> OLD.expires_at THEN
    RAISE EXCEPTION 'idempotency_store: idempotency_key/created_at/ttl_seconds/expires_at are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at THEN
    RAISE EXCEPTION 'idempotency_store: consumed_at is write-once (cannot un-consume / re-consume key %)', OLD.idempotency_key
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 1) goal_delta_ledger — APPEND-ONLY ProgressSample stream (idempotency key goal_id+cycle).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE goal_delta_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    uuid NOT NULL,
  cycle      integer NOT NULL,
  value      double precision,
  predicted  double precision,
  fix_ref    text,
  ts         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goal_delta_ledger_cycle_nonneg CHECK (cycle >= 0)
);
CREATE UNIQUE INDEX goal_delta_ledger_goal_cycle_uniq ON goal_delta_ledger(goal_id, cycle);
CREATE INDEX        goal_delta_ledger_goal_ts_idx     ON goal_delta_ledger(goal_id, ts);

ALTER TABLE goal_delta_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_insert ON goal_delta_ledger FOR INSERT TO {{app_role}} WITH CHECK (true);
CREATE POLICY app_select ON goal_delta_ledger FOR SELECT TO {{app_role}} USING (true);
-- (no UPDATE/DELETE policy → RLS denies mutation: append-only.)
CREATE TRIGGER goal_delta_ledger_append_only_trg
  BEFORE UPDATE OR DELETE ON goal_delta_ledger
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 2) attempt_ledger — APPEND-ONLY attempt history per step. One immutable row per (step_id, attempt).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE attempt_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid,
  run_id      uuid,
  step_id     uuid NOT NULL,
  attempt     integer NOT NULL,
  hypothesis  text,
  action      text,
  delta       double precision,
  outcome     text NOT NULL,
  ts          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attempt_ledger_attempt_pos CHECK (attempt >= 1)
);
CREATE UNIQUE INDEX attempt_ledger_step_attempt_uniq ON attempt_ledger(step_id, attempt);
CREATE INDEX        attempt_ledger_run_idx           ON attempt_ledger(run_id);
CREATE INDEX        attempt_ledger_goal_idx          ON attempt_ledger(goal_id);

ALTER TABLE attempt_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_insert ON attempt_ledger FOR INSERT TO {{app_role}} WITH CHECK (true);
CREATE POLICY app_select ON attempt_ledger FOR SELECT TO {{app_role}} USING (true);
CREATE TRIGGER attempt_ledger_append_only_trg
  BEFORE UPDATE OR DELETE ON attempt_ledger
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 3) circuit_breaker — DURABLE breaker state (closed→open→half_open→closed) — survives a reconciler restart.
--    MUTABLE → a full app_all policy.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE circuit_breaker (
  step_id                uuid PRIMARY KEY,
  goal_id                uuid,
  run_id                 uuid,
  breaker_state          text NOT NULL DEFAULT 'closed',
  breaker_count          integer NOT NULL DEFAULT 0,
  breaker_cooldown_until timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT circuit_breaker_state_chk CHECK (breaker_state IN ('closed','open','half_open')),
  CONSTRAINT circuit_breaker_count_nonneg CHECK (breaker_count >= 0)
);
CREATE INDEX circuit_breaker_open_idx ON circuit_breaker(breaker_state) WHERE breaker_state <> 'closed';

ALTER TABLE circuit_breaker ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_all ON circuit_breaker FOR ALL TO {{app_role}} USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 4) idempotency_store — write-ahead-intent / de-dup. PK race ⇒ exactly one reserve wins; consumed_at is
--    write-once. MUTABLE (insert→consume) but tightly guarded: INSERT+SELECT+UPDATE policies, NO DELETE policy,
--    plus the write-once column guard trigger.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE idempotency_store (
  idempotency_key text PRIMARY KEY,
  scope           text,
  run_id          uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  ttl_seconds     integer NOT NULL DEFAULT 86400,
  expires_at      timestamptz NOT NULL,
  consumed_at     timestamptz,
  CONSTRAINT idempotency_store_ttl_pos CHECK (ttl_seconds > 0)
);
CREATE INDEX idempotency_store_expires_idx    ON idempotency_store(expires_at);
CREATE INDEX idempotency_store_unconsumed_idx ON idempotency_store(consumed_at) WHERE consumed_at IS NULL;

ALTER TABLE idempotency_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_insert ON idempotency_store FOR INSERT TO {{app_role}} WITH CHECK (true);
CREATE POLICY app_select ON idempotency_store FOR SELECT TO {{app_role}} USING (true);
CREATE POLICY app_update ON idempotency_store FOR UPDATE TO {{app_role}} USING (true) WITH CHECK (true);
-- (no DELETE policy → RLS denies app DELETE; the owner-run TTL reaper prunes expired keys.)
CREATE TRIGGER idempotency_store_guard_trg
  BEFORE UPDATE ON idempotency_store
  FOR EACH ROW EXECUTE FUNCTION c12_idempotency_guard();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 5) dead_letter — APPEND-ONLY poison-step terminal record. Logical step_id/run_id (no cascade).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE dead_letter (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id    uuid NOT NULL,
  run_id     uuid,
  goal_id    uuid,
  reason     text NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dead_letter_step_idx    ON dead_letter(step_id);
CREATE INDEX dead_letter_run_idx     ON dead_letter(run_id);
CREATE INDEX dead_letter_created_idx ON dead_letter(created_at DESC);

ALTER TABLE dead_letter ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_insert ON dead_letter FOR INSERT TO {{app_role}} WITH CHECK (true);
CREATE POLICY app_select ON dead_letter FOR SELECT TO {{app_role}} USING (true);
CREATE TRIGGER dead_letter_append_only_trg
  BEFORE UPDATE OR DELETE ON dead_letter
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 6) portfolio_cost_ledger — APPEND-ONLY aggregate spend. Each row carries this charge AND the running
--    cumulative for the goal (computed atomically at append; the access layer serializes per-goal appends with
--    a transactional advisory lock so the cumulative is exact under concurrency).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE portfolio_cost_ledger (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id               uuid NOT NULL,
  run_id                uuid,
  cost_cents            bigint NOT NULL,
  cumulative_cost_cents bigint NOT NULL,
  currency              text NOT NULL DEFAULT 'EUR',
  ts                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_cost_ledger_cost_nonneg CHECK (cost_cents >= 0),
  CONSTRAINT portfolio_cost_ledger_cum_nonneg  CHECK (cumulative_cost_cents >= 0)
);
CREATE INDEX portfolio_cost_ledger_goal_ts_idx ON portfolio_cost_ledger(goal_id, ts);
CREATE INDEX portfolio_cost_ledger_run_idx     ON portfolio_cost_ledger(run_id);

ALTER TABLE portfolio_cost_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_insert ON portfolio_cost_ledger FOR INSERT TO {{app_role}} WITH CHECK (true);
CREATE POLICY app_select ON portfolio_cost_ledger FOR SELECT TO {{app_role}} USING (true);
CREATE TRIGGER portfolio_cost_ledger_append_only_trg
  BEFORE UPDATE OR DELETE ON portfolio_cost_ledger
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();
