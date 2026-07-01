-- 0055 GoalContract P0 foundation — tenant/stream columns (G-02) + state_machine_version (G-04) +
-- the append-only GoalContract event stream (G-03). Company-OS-FROZEN-v1 §3.4 / §4.3 / §4.4 (B3 decision A) /
-- invariants I11 (tenant isolation) · I12 (platform self-versioning) · I13 (every transition is a captured,
-- versioned, append-only event) · I15 (operator-plane legality).
--
-- WHY NOW (the day-1 hedge): the frozen spec's B3 DECISION is Option (A) — "dual-write a versioned,
-- tenant-partitioned event stream from day one; add the tenant/stream columns." Retrofitting tenant columns +
-- a versioned event log onto a populated, in-place-mutated table is the exact ruinous-later cost the review
-- flagged. This migration takes that cheap-now / un-takeable-later hedge so the later phases (event-log SoR,
-- tenant cells, the break-glass v2 edge under state_machine_version, the B4 invariant-auditor) are
-- column-adds and new-reader wiring, NOT a rewrite. The invariant-auditor (I15/B4) re-derives legality from
-- THIS stream and is a strict successor of it — nothing to re-derive until transitions are captured here.
--
-- ── EXPAND-ONLY / production-safe (continues the 0052/0053/0054 DRB-v1 §8 discipline) ───────────────────────
--   * ADDITIVE ONLY. Three NEW columns on goal_contract (all NOT NULL *with a constant DEFAULT* → Postgres 11+
--     fills existing rows via the fast catalog default, NO table rewrite, NO long ACCESS-EXCLUSIVE scan) + ONE
--     new table (goal_contract_event) + a CREATE-OR-REPLACE of the existing state-machine guard that is a pure
--     superset (v1 legality byte-for-byte unchanged; a version dispatch wraps it). NO DROP/RENAME/type-change.
--   * BACKWARD-COMPATIBLE: every existing goal_contract row stays legal. Existing rows backfill to
--     tenant_id='RUMAH', stream_id='default', state_machine_version=1 — i.e. exactly today's single-tenant, v1
--     semantics. Old code paths that never SELECT the new columns are unaffected; transition() (the sole
--     mutator) is the only writer of the event stream.
--   * The new table is greenfield + empty at create, so its CREATE INDEX statements lock a brand-new relation
--     no live traffic references — correct inside the migrator's per-file transaction (migrate-core.applyOne),
--     no CREATE INDEX CONCURRENTLY needed (same reasoning 0052/0053/0054 documented).
--   * No data migration of a live critical-path table → no PITR precondition; NOT founder-gated (off every
--     serving path) → applies on a plain `db:migrate` (NOT in GATED_MIGRATIONS).
--
-- ROLLBACK: forward-only (ADR-005); 0055_..down.sql drops the event table, drops the three columns, and
-- restores the guard to its 0053 v1-only form. Rolling back DISCARDS the captured event history — only safe
-- while the stream is still inert (no live Project Owner has transitioned a goal through the dual-write door).

-- LIVE-TABLE SAFETY (migration-expand-lint): this migration ALTERs the live goal_contract table (three fast
-- catalog-default ADD COLUMNs + a CHECK on a brand-new column, so no full-table rewrite/scan). Bound the DDL
-- so it can never queue unbounded behind pooled :6543 traffic. NOTE: the (tenant_id, stream_id) *lookup* index
-- on goal_contract is deliberately DEFERRED to the non-transactional CREATE INDEX CONCURRENTLY lane and added
-- only when multi-tenant querying actually lands — it cannot run inside the migrator's per-file transaction and
-- nothing in this P0 slice queries goal_contract by tenant/stream (the reconciler scans by state). The event
-- stream's own (tenant_id, stream_id, seq) index is on the greenfield goal_contract_event table (safe here).
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- G-02 — tenant_id + stream_id on the GoalContract spine (I11 tenant isolation; single-tenant today).
-- Ground-truth (frozen §4.4.3): these columns are ABSENT everywhere on the goal spine today. Stamped now
-- (tenant = RUMAH, one stream per scope) so the multi-tenant refactor is a column-already-present, not a
-- rewrite. The 163 pre-existing tenant_id hits in this repo are the billing/renter "who OWES" domain — a red
-- herring, a different entity — so these platform-scope columns live only on the goal spine + its event table.
-- NB: only goal_contract (+ the new event table) is the GoalContract spine touched here. The workflow-engine
-- run/lease/outbox tables are the SEPARATE RUN engine and are deliberately NOT altered by this migration.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE goal_contract ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'RUMAH';
ALTER TABLE goal_contract ADD COLUMN IF NOT EXISTS stream_id text NOT NULL DEFAULT 'default';

-- G-04 — state_machine_version (I12 platform self-versioning). Every goal is stamped with the version whose
-- legality governs it FOR ITS WHOLE LIFE (in-flight goals pinned to their start version). v1 = exactly today's
-- 11-state / frozen-§3.2 edge set. New states/edges (e.g. the §6.3 break-glass administrative edge) may be
-- introduced ONLY additively as a v2 dispatch branch below — never as a mutation of v1 semantics.
ALTER TABLE goal_contract ADD COLUMN IF NOT EXISTS state_machine_version integer NOT NULL DEFAULT 1;

ALTER TABLE goal_contract
  DROP CONSTRAINT IF EXISTS goal_contract_smv_pos;
ALTER TABLE goal_contract
  ADD CONSTRAINT goal_contract_smv_pos CHECK (state_machine_version >= 1);

-- (the goal_contract(tenant_id, stream_id) lookup index is DEFERRED to the CONCURRENTLY lane — see the
--  LIVE-TABLE SAFETY note in the header. Not needed by this P0 slice.)

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- G-03 — goal_contract_event: the append-only, versioned, tenant-partitioned event stream (I13/B3).
-- Every legal transition is DUAL-WRITTEN here in the SAME transaction as the reconciled goal_contract row
-- update (the write path src/goal-contract.transition() performs). The goal_contract row stays the fast read
-- model; THIS stream is the retained system-of-record history the B4 invariant-auditor + the event-log SoR
-- promotion later read. No event is written for a no-op / rejected / CAS-lost transition (guaranteed both by
-- transition()'s in-tx logic AND by the from_state<>to_state CHECK below).
--
-- LOGICAL ref (not a FK), matching the 0052 append-only ledgers (goal_delta_ledger etc.): goal_contract_id is
-- the goal_id scope key. A logical ref keeps the stream decoupled (no lock/dependency on goal_contract, and it
-- survives a goal_contract rollback as retained history) — the same discipline the other C12 ledgers use.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE goal_contract_event (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_contract_id  uuid NOT NULL,                        -- LOGICAL ref to goal_contract.goal_id (the scope key)
  tenant_id         text NOT NULL,                        -- I11 partition: copied from the contract at emit time
  stream_id         text NOT NULL,                        -- I11 partition: copied from the contract at emit time
  seq               bigint NOT NULL,                      -- per-contract monotonic sequence (1,2,3…); ordering key
  from_state        text NOT NULL,                        -- the OLD lifecycle state (the edge tail)
  to_state          text NOT NULL,                        -- the NEW lifecycle state (the edge head)
  actor             text NOT NULL,                        -- who caused the transition (the sole mutator by default)
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  schema_id         text NOT NULL,                        -- event schema identity (e.g. 'goal_contract.transition')
  schema_version    integer NOT NULL DEFAULT 1,           -- I13 non-negotiable version stamp (no unversioned event #1)
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,   -- extra context (state_machine_version, prev_state bookkeeping…)
  CONSTRAINT goal_contract_event_from_state_chk CHECK (
    from_state IN ('CREATED','FEASIBILITY','ACTIVE','PLANNING','EXECUTING','REVIEWING','DONE','HALTED','FAILED','SUSPENDED','CLOSED')
  ),
  CONSTRAINT goal_contract_event_to_state_chk CHECK (
    to_state IN ('CREATED','FEASIBILITY','ACTIVE','PLANNING','EXECUTING','REVIEWING','DONE','HALTED','FAILED','SUSPENDED','CLOSED')
  ),
  -- No event may record a no-op: a transition that does not move the state emits NOTHING (I13 write path).
  CONSTRAINT goal_contract_event_no_noop_chk CHECK (from_state <> to_state),
  CONSTRAINT goal_contract_event_seq_pos_chk CHECK (seq >= 1),
  CONSTRAINT goal_contract_event_schema_version_pos_chk CHECK (schema_version >= 1)
);
-- Exactly one event per (contract, seq): the monotonic per-contract order is structurally enforced (a second
-- writer racing the same seq hits this unique index → 23505, so the stream can never fork its ordering).
CREATE UNIQUE INDEX goal_contract_event_contract_seq_uniq ON goal_contract_event(goal_contract_id, seq);
CREATE INDEX goal_contract_event_stream_seq_idx ON goal_contract_event(tenant_id, stream_id, seq); -- SoR stream read
CREATE INDEX goal_contract_event_contract_idx   ON goal_contract_event(goal_contract_id);
CREATE INDEX goal_contract_event_occurred_idx   ON goal_contract_event(occurred_at DESC);

-- Append-only (the 0052 C12 tamper-evidence pattern): rumah_app gets INSERT+SELECT only (no UPDATE/DELETE
-- policy → RLS denies mutation), and a BEFORE UPDATE OR DELETE trigger RAISES for EVERY role (owner included)
-- via the shared c12_append_only_guard() from 0052 — so the captured history can only ever grow.
ALTER TABLE goal_contract_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_insert ON goal_contract_event FOR INSERT TO rumah_app WITH CHECK (true);
CREATE POLICY rumah_app_select ON goal_contract_event FOR SELECT TO rumah_app USING (true);
-- (no UPDATE/DELETE policy → RLS denies mutation for rumah_app: append-only.)
CREATE TRIGGER goal_contract_event_append_only_trg
  BEFORE UPDATE OR DELETE ON goal_contract_event
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- G-04 — version-dispatched legality (owner-proof). CREATE OR REPLACE of the 0053 guard as a PURE SUPERSET:
-- the legal-edge test is now dispatched by the goal's state_machine_version. v1 (the ONLY version today) is
-- the frozen §3.2 edge set, byte-for-byte identical to 0053 — so every existing goal + every existing
-- transition stays legal. A goal is pinned to its birth version: state_machine_version is IMMUTABLE across a
-- transition (like goal_id/created_at), so an in-flight v1 goal can never be silently promoted to v2 by a bug.
-- tenant_id/stream_id are likewise immutable (a transition never re-partitions a goal across a tenant/stream).
-- Future v2 edges (e.g. the §6.3 dual-controlled break-glass administrative edge) are added as an *additional*
-- WHEN branch here — never by editing the v1 branch.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION goal_contract_state_machine_guard() RETURNS trigger AS $$
DECLARE
  v_legal boolean;
BEGIN
  -- Identity + partition + version columns are immutable (owner-proof): a transition never re-keys a contract,
  -- rewrites its birth, re-partitions it across a tenant/stream, nor re-versions its state machine.
  IF NEW.goal_id <> OLD.goal_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'goal_contract %: goal_id/created_at are immutable', OLD.goal_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.state_machine_version <> OLD.state_machine_version THEN
    RAISE EXCEPTION 'goal_contract %: state_machine_version is immutable (in-flight goals are pinned to their start version)', OLD.goal_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.tenant_id <> OLD.tenant_id OR NEW.stream_id <> OLD.stream_id THEN
    RAISE EXCEPTION 'goal_contract %: tenant_id/stream_id are immutable (a transition never re-partitions a goal)', OLD.goal_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- No state change → allow (an updated_at touch, an objective/budget amendment, prev_state bookkeeping).
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;

  -- Terminal states have NO outgoing edge — version-independent (true in every version).
  IF OLD.state IN ('DONE','FAILED','CLOSED') THEN
    RAISE EXCEPTION 'goal_contract %: % is terminal — transition to % is illegal (frozen §3.2)', OLD.goal_id, OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;

  -- Version-dispatched legality. The goal is governed by ITS OWN version (OLD.state_machine_version).
  CASE OLD.state_machine_version
    WHEN 1 THEN
      -- ── v1 legal edges — the frozen §3.2 set, byte-for-byte identical to 0053. DO NOT EDIT to add edges;
      --    a new edge class is a NEW `WHEN` branch (a new version), never a mutation of v1. ──
      v_legal := (
           -- ANY non-terminal → FAILED (the H1 cap tripped)
           (NEW.state = 'FAILED')
           -- ANY non-terminal (not already suspended) → SUSPENDED (founder-freeze); prev_state MUST capture the resume target
        OR (NEW.state = 'SUSPENDED' AND OLD.state <> 'SUSPENDED' AND NEW.prev_state = OLD.state)
           -- SUSPENDED → the prior state (founder-resume)
        OR (OLD.state = 'SUSPENDED' AND OLD.prev_state IS NOT NULL AND NEW.state = OLD.prev_state)
           -- the forward lifecycle (§3.2)
        OR (OLD.state = 'CREATED'     AND NEW.state = 'FEASIBILITY')
        OR (OLD.state = 'FEASIBILITY' AND NEW.state IN ('ACTIVE','HALTED'))
        OR (OLD.state = 'ACTIVE'      AND NEW.state = 'PLANNING')
        OR (OLD.state = 'PLANNING'    AND NEW.state = 'EXECUTING')
        OR (OLD.state = 'EXECUTING'   AND NEW.state = 'REVIEWING')
        OR (OLD.state = 'REVIEWING'   AND NEW.state IN ('DONE','PLANNING','HALTED'))
        OR (OLD.state = 'HALTED'      AND NEW.state IN ('PLANNING','REVIEWING','CLOSED'))
      );
    ELSE
      RAISE EXCEPTION 'goal_contract %: unknown state_machine_version % (no legality defined; additive versions only)', OLD.goal_id, OLD.state_machine_version
        USING ERRCODE = 'check_violation';
  END CASE;

  IF NOT v_legal THEN
    RAISE EXCEPTION 'goal_contract %: illegal state transition % -> % under state_machine_version % (legal edges only)', OLD.goal_id, OLD.state, NEW.state, OLD.state_machine_version
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- (the 0053 trigger goal_contract_state_machine_trg already binds this function BEFORE UPDATE — replacing the
--  function body is enough; the trigger binding is unchanged.)
