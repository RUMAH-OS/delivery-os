-- 0052 Runtime durable stores (C12) — Sprint 1.4, RS-DOS-v1 §8.3 / DRB-v1 §8.
-- The FIVE greenfield durable stores the Delivery OS Runtime requires so that NO essential state ever
-- lives in reconciler/agent RAM (kill any reconciler/agent/session → lose no progress; a restart never
-- resets a runaway breaker nor double-executes a side-effect). All FIVE tables are created here as a
-- single cohesive C12 slice.
--
--   goal_delta_ledger       — append-only ProgressSample stream (the Goal Supervisor's input; F6 loop detect)
--   attempt_ledger          — append-only attempt history (hypothesis/action/delta/outcome per step attempt)
--   circuit_breaker         — DURABLE breaker state (open/count/cooldown) — survives a reconciler restart
--   idempotency_store       — write-ahead-intent / de-dup keys (F12: dup side-effect = no-op)
--   dead_letter             — append-only poison-step terminal record (F15: breaker-exhausted → durable record)
--   portfolio_cost_ledger   — append-only aggregate spend (F13: bounds a runaway fleet — the billing-outage class)
--
-- ── EXPAND-ONLY / production-safe (DRB-v1 §8) ───────────────────────────────────────────────────────────
--   * ADDITIVE ONLY: five NEW tables. NO ALTER/DROP/RENAME/type-change of any existing table. Old serverless
--     instances tolerate this schema (they never reference these tables) — this is an EXPAND that applies
--     safely BEFORE the code that reads them ships.
--   * Greenfield tables are EMPTY at create time, so the CREATE INDEX statements here take their locks on
--     brand-new relations that NO live traffic references — there is no ACCESS-EXCLUSIVE stall on the shared
--     :6543 pooler (the reason the linter bans bare CREATE INDEX is contention on a *populated, live-read*
--     table; that hazard does not exist for a table created in the same transaction). This migration is
--     therefore correct to run inside the migrator's per-file transaction (migrate-core.applyOne), and needs
--     NO `CREATE INDEX CONCURRENTLY` (which cannot run in a txn anyway).
--   * No backfill, no data migration → no PITR snapshot precondition (that gate is for contract/backfill).
--   * NOT founder-gated: additive, off the serving path, mutates no live critical-path table → applies on a
--     plain `db:migrate` (NOT added to GATED_MIGRATIONS).
--
-- ── RLS + immutability (DRB-v1 §8: "new C12 tables enable RLS in the same migration") ───────────────────
--   Every table ENABLEs RLS in THIS migration (0021/0029/0030/0034 lesson: a NEW table is invisible to RLS
--   until it enables it + adds its own rumah_app policies). anon/authenticated get NO policy → default-deny
--   (PostgREST surface closed). The runtime role rumah_app gets exactly the policies each store's invariant
--   permits — append-only stores get INSERT+SELECT only (no UPDATE/DELETE policy → RLS DENIES mutation, the
--   0030/0032 tamper-evidence pattern). Defense-in-depth: the four append-only stores ALSO carry a BEFORE
--   UPDATE/DELETE trigger that RAISES regardless of role (the owner/migrator bypasses RLS, but NOT a trigger
--   — the 0028/0035 immutability-guard pattern), so history is immutable even from an owner-context bug.
--   (goal_id/tenant-scoped record-level policies are a later tightening WITHOUT a new grant migration — the
--   0021 "sensitive phase tightens to record-level" note; rumah-admin is single-tenant today, so the coarse
--   rumah_app policy IS the default-deny, exactly as 0034 homed the workflow engine.)
--   rumah_app is non-superuser (0021/0028) — it cannot DISABLE TRIGGER or set session_replication_role, so
--   these guards genuinely bind the app path.
--
-- ROLLBACK: forward-only (ADR-005); a paired 0052_..down.sql drops the five tables + the two guard functions.
-- Rolling back DISCARDS all runtime durable state — only safe while the stores are still inert (flags OFF,
-- DRB-v1 §8 "P1.4/1.5/1.6 stores: greenfield additive → flag off the writers; schema left inert").

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
-- handled here — it is denied to rumah_app via RLS (no DELETE policy) while the owner-run TTL reaper may
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
-- 1) goal_delta_ledger — APPEND-ONLY ProgressSample stream (RS-DOS §8.2/§8.3; idempotency key goal_id+cycle).
--    The Goal Supervisor (C7) appends one externally-re-probed sample per cycle; dGoal/dEffort + the
--    no-progress / loop-fingerprint detector read it. `value` is nullable (a probe may fail yet the cycle is
--    still recorded). One sample per (goal_id, cycle) → a re-probe of the same cycle is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE goal_delta_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    uuid NOT NULL,                       -- the Goal Contract this sample belongs to (logical scope key)
  cycle      integer NOT NULL,                    -- monotonically increasing GS cycle index
  value      double precision,                    -- the metric value re-probed from its canonical external source
  predicted  double precision,                    -- the predicted/expected value for this cycle (for dGoal)
  fix_ref    text,                                -- the fix/hypothesis applied this cycle (loop-fingerprint input)
  ts         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goal_delta_ledger_cycle_nonneg CHECK (cycle >= 0)
);
CREATE UNIQUE INDEX goal_delta_ledger_goal_cycle_uniq ON goal_delta_ledger(goal_id, cycle); -- idem: goal_id+cycle
CREATE INDEX        goal_delta_ledger_goal_ts_idx     ON goal_delta_ledger(goal_id, ts);

ALTER TABLE goal_delta_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_insert ON goal_delta_ledger FOR INSERT TO rumah_app WITH CHECK (true);
CREATE POLICY rumah_app_select ON goal_delta_ledger FOR SELECT TO rumah_app USING (true);
-- (no UPDATE/DELETE policy → RLS denies mutation for rumah_app: append-only.)
CREATE TRIGGER goal_delta_ledger_append_only_trg
  BEFORE UPDATE OR DELETE ON goal_delta_ledger
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 2) attempt_ledger — APPEND-ONLY attempt history per step. One immutable row per (step_id, attempt). The
--    breaker's "same fix repeated" / bounded-restart logic reads this; it is NOT the breaker STATE (that is
--    the separate mutable circuit_breaker table below).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE attempt_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid,                               -- logical scope (nullable: a step may predate a goal binding)
  run_id      uuid,                               -- the engine run (logical; no FK — see dead_letter note)
  step_id     uuid NOT NULL,                      -- the leasable unit being attempted
  attempt     integer NOT NULL,                   -- 1-based attempt number for this step
  hypothesis  text,                               -- what this attempt assumed
  action      text,                               -- what this attempt did
  delta       double precision,                   -- observed goal-delta attributable to this attempt
  outcome     text NOT NULL,                       -- progressed | flat | failed | aborted | ...
  ts          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attempt_ledger_attempt_pos CHECK (attempt >= 1)
);
CREATE UNIQUE INDEX attempt_ledger_step_attempt_uniq ON attempt_ledger(step_id, attempt);
CREATE INDEX        attempt_ledger_run_idx           ON attempt_ledger(run_id);
CREATE INDEX        attempt_ledger_goal_idx          ON attempt_ledger(goal_id);

ALTER TABLE attempt_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_insert ON attempt_ledger FOR INSERT TO rumah_app WITH CHECK (true);
CREATE POLICY rumah_app_select ON attempt_ledger FOR SELECT TO rumah_app USING (true);
CREATE TRIGGER attempt_ledger_append_only_trg
  BEFORE UPDATE OR DELETE ON attempt_ledger
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 3) circuit_breaker — DURABLE breaker state, the load-bearing C12 invariant (RS-DOS §8.3): the breaker open
--    flag + consecutive-failure count + cooldown live ON DISK, never in reconciler RAM, so a reconciler
--    restart re-reads an OPEN breaker and does NOT reset a runaway. One breaker per step (PK = step_id).
--    This table is MUTABLE (state advances closed→open→half_open→closed) → a full rumah_app_all policy.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE circuit_breaker (
  step_id                uuid PRIMARY KEY,         -- one breaker per leasable step
  goal_id                uuid,
  run_id                 uuid,
  breaker_state          text NOT NULL DEFAULT 'closed',
  breaker_count          integer NOT NULL DEFAULT 0,   -- consecutive failures since last close
  breaker_cooldown_until timestamptz,                  -- when a half_open trial is permitted (NULL while closed)
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT circuit_breaker_state_chk CHECK (breaker_state IN ('closed','open','half_open')),
  CONSTRAINT circuit_breaker_count_nonneg CHECK (breaker_count >= 0)
);
CREATE INDEX circuit_breaker_open_idx ON circuit_breaker(breaker_state) WHERE breaker_state <> 'closed';

ALTER TABLE circuit_breaker ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_all ON circuit_breaker FOR ALL TO rumah_app USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 4) idempotency_store — write-ahead-intent / de-dup (RS-DOS §8.3, F12; DRB-v1 §10 "single C12 idempotency/
--    intent-key store shared by both paths"). The PK on idempotency_key makes a concurrent reserve a RACE
--    that EXACTLY ONE writer wins (INSERT … ON CONFLICT DO NOTHING). Intent is recorded BEFORE the side-effect;
--    consumed_at is set AFTER it confirms (write-once). MUTABLE (insert→consume) but tightly guarded:
--    INSERT+SELECT+UPDATE policies for rumah_app, NO DELETE policy (TTL reaping is an owner maintenance job),
--    plus the write-once column guard trigger.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE idempotency_store (
  idempotency_key text PRIMARY KEY,               -- unique on key: the de-dup / write-ahead-intent identity
  scope           text,                           -- side-effect class (outreach | payment | comms | ...)
  run_id          uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  ttl_seconds     integer NOT NULL DEFAULT 86400, -- intent retention window
  expires_at      timestamptz NOT NULL,           -- created_at + ttl; the reaper prunes past this
  consumed_at     timestamptz,                    -- NULL = intent reserved, side-effect not yet confirmed
  CONSTRAINT idempotency_store_ttl_pos CHECK (ttl_seconds > 0)
);
CREATE INDEX idempotency_store_expires_idx   ON idempotency_store(expires_at);
CREATE INDEX idempotency_store_unconsumed_idx ON idempotency_store(consumed_at) WHERE consumed_at IS NULL;

ALTER TABLE idempotency_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_insert ON idempotency_store FOR INSERT TO rumah_app WITH CHECK (true);
CREATE POLICY rumah_app_select ON idempotency_store FOR SELECT TO rumah_app USING (true);
CREATE POLICY rumah_app_update ON idempotency_store FOR UPDATE TO rumah_app USING (true) WITH CHECK (true);
-- (no DELETE policy → RLS denies app DELETE; the owner-run TTL reaper prunes expired keys.)
CREATE TRIGGER idempotency_store_guard_trg
  BEFORE UPDATE ON idempotency_store
  FOR EACH ROW EXECUTE FUNCTION c12_idempotency_guard();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 5) dead_letter — APPEND-ONLY poison-step terminal record (RS-DOS §8.3, F15). A breaker-exhausted step is
--    recorded here durably, THEN a boundary FAP is emitted. NO FK to workflow_step ON DELETE CASCADE — a
--    terminal poison record must SURVIVE the step's own lifecycle (an FK cascade would erase the evidence the
--    record exists to preserve), so step_id/run_id are LOGICAL references.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE dead_letter (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id    uuid NOT NULL,                       -- the poison step (logical reference; no cascade)
  run_id     uuid,
  goal_id    uuid,
  reason     text NOT NULL,                       -- why it became terminal (breaker-exhausted | unrecoverable | ...)
  payload    jsonb,                               -- the last attempt's context (PII-minimised by the caller)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dead_letter_step_idx    ON dead_letter(step_id);
CREATE INDEX dead_letter_run_idx     ON dead_letter(run_id);
CREATE INDEX dead_letter_created_idx ON dead_letter(created_at DESC);

ALTER TABLE dead_letter ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_insert ON dead_letter FOR INSERT TO rumah_app WITH CHECK (true);
CREATE POLICY rumah_app_select ON dead_letter FOR SELECT TO rumah_app USING (true);
CREATE TRIGGER dead_letter_append_only_trg
  BEFORE UPDATE OR DELETE ON dead_letter
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 6) portfolio_cost_ledger — APPEND-ONLY aggregate spend (RS-DOS §8.3, F13; the billing-outage class). Each
--    row carries this charge (cost_cents) AND the running cumulative for the goal (cumulative_cost_cents),
--    computed atomically at append (the access layer serializes per-goal appends with a transactional
--    advisory lock so the cumulative is exact under concurrency). The write-ahead budget / GS reads it.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE portfolio_cost_ledger (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id               uuid NOT NULL,
  run_id                uuid,
  cost_cents            bigint NOT NULL,           -- this charge
  cumulative_cost_cents bigint NOT NULL,           -- running total for goal_id INCLUDING this row
  currency              text NOT NULL DEFAULT 'EUR',
  ts                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_cost_ledger_cost_nonneg CHECK (cost_cents >= 0),
  CONSTRAINT portfolio_cost_ledger_cum_nonneg  CHECK (cumulative_cost_cents >= 0)
);
CREATE INDEX portfolio_cost_ledger_goal_ts_idx ON portfolio_cost_ledger(goal_id, ts);
CREATE INDEX portfolio_cost_ledger_run_idx     ON portfolio_cost_ledger(run_id);

ALTER TABLE portfolio_cost_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_insert ON portfolio_cost_ledger FOR INSERT TO rumah_app WITH CHECK (true);
CREATE POLICY rumah_app_select ON portfolio_cost_ledger FOR SELECT TO rumah_app USING (true);
CREATE TRIGGER portfolio_cost_ledger_append_only_trg
  BEFORE UPDATE OR DELETE ON portfolio_cost_ledger
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();
