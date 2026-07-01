-- 0053 GoalContract (C2-STATE) — Sprint 1.6, RS-DOS-v1 §4.1 (schema) / §4.3 (PO lifecycle state machine) / §54.1 (data_class).
-- The durable record that "owns" a project: the Project Owner's accountability locus. This is RECONCILED STATE,
-- not a daemon — the reconciler loop (C2-LOOP) that advances it is Sprint 3.3 and is OUT OF SCOPE here. This
-- migration ships ONLY the durable state + the legal-edge state machine that constrains how that state may move.
--
--   goal_contract — one row per goal. The Goal Contract (§4.1): objective + acceptance metric + its registered
--                   external MetricProbe ref (probe_id+version, §36 / src/metric-probe.ts) + data_class (§54.1)
--                   + the H1 budget cap + a logical ref to the goal-delta ledger (0052) + the PO lifecycle state.
--
-- ── EXPAND-ONLY / production-safe (continues the 0052 DRB-v1 §8 discipline) ─────────────────────────────────
--   * ADDITIVE ONLY: ONE new table. NO ALTER/DROP/RENAME/type-change of any existing table. Old serverless
--     instances never reference goal_contract → this EXPAND applies safely BEFORE the code that reads it ships.
--   * Greenfield + EMPTY at create: the CREATE INDEX statements lock a brand-new relation no live traffic
--     references — no ACCESS-EXCLUSIVE stall on the shared pooler, so this is correct inside the migrator's
--     per-file transaction (migrate-core.applyOne) and needs NO CREATE INDEX CONCURRENTLY.
--   * No backfill / no data migration → no PITR snapshot precondition. NOT founder-gated (off the serving path,
--     mutates no live critical-path table) → applies on a plain `db:migrate` (NOT in GATED_MIGRATIONS).
--
-- ── RLS (0021/0052 lesson: a NEW table is invisible to RLS until it enables it + adds its own policies) ──────
--   goal_contract ENABLEs RLS in THIS migration. anon/authenticated get NO policy → default-deny (PostgREST
--   surface closed). goal_contract is MUTABLE reconciled state (state advances through the §4.3 machine), so
--   rumah_app gets a full FOR ALL policy (mirrors 0052 circuit_breaker, the other mutable C12 store) — the
--   state-machine legality is NOT an RLS concern; it is enforced by the owner-proof trigger below.
--
-- ── Legal-edge state machine (owner-proof, copies the 0042/0052 trigger-guard pattern) ──────────────────────
--   The `state` column may move ONLY along the RS-DOS-v1 §4.3 LEGAL edges. A BEFORE UPDATE trigger RAISES on any
--   illegal edge for EVERY role — the table owner / migrator bypasses RLS but NOT a trigger (0028/0035/0052
--   immutability-guard pattern), so an illegal transition is impossible even from an owner-context bug, not
--   merely discouraged by application code. Terminal states (DONE/FAILED/CLOSED) have NO outgoing edges.
--
-- ROLLBACK: forward-only (ADR-005); the paired 0053_..down.sql drops the table + the guard function. Rolling
-- back DISCARDS all GoalContract state — only safe while the contract store is still inert (no live PO running).

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- goal_contract — the durable C2-STATE record (RS-DOS-v1 §4.1).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE goal_contract (
  goal_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective               text NOT NULL,                       -- the Founder's objective (the goal, in plain terms)
  acceptance_metric       text NOT NULL,                       -- the acceptance metric (the success measure, §4.1 acceptance.metric)
  metric_source_probe_id  text NOT NULL,                       -- §4.1 acceptance.metric_source: a REGISTERED MetricProbe probe_id (§36 / src/metric-probe.ts)
  metric_source_version   integer NOT NULL,                    -- the PINNED probe version (no latest-fallback — the GS re-reads under this exact descriptor)
  data_class              text NOT NULL,                       -- §54.1 classification carrier (the goal's maximum sensitivity)
  budget_cap              jsonb NOT NULL DEFAULT '{}'::jsonb,  -- the H1 cap envelope {max_turns,max_wallclock_seconds,max_cost_cents} (§4.1 budget)
  goal_delta_ledger_ref   uuid NOT NULL,                       -- LOGICAL ref into goal_delta_ledger (0052): the goal_id scope key of this goal's ProgressSample stream
  state                   text NOT NULL DEFAULT 'CREATED',     -- the PO lifecycle state (§4.3) — moves ONLY along legal edges (trigger-enforced)
  prev_state              text,                                -- the state to resume to after a founder-freeze (SUSPENDED → prev_state); NULL otherwise
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goal_contract_state_chk CHECK (
    state IN ('CREATED','FEASIBILITY','ACTIVE','PLANNING','EXECUTING','REVIEWING','DONE','HALTED','FAILED','SUSPENDED','CLOSED')
  ),
  CONSTRAINT goal_contract_prev_state_chk CHECK (
    prev_state IS NULL OR prev_state IN ('CREATED','FEASIBILITY','ACTIVE','PLANNING','EXECUTING','REVIEWING','HALTED')
  ),
  CONSTRAINT goal_contract_data_class_chk CHECK (data_class IN ('PUBLIC','INTERNAL','CONFIDENTIAL','PII','SECRET')),
  CONSTRAINT goal_contract_metric_version_pos CHECK (metric_source_version >= 1)
);
CREATE INDEX goal_contract_state_idx      ON goal_contract(state);                          -- the reconciler scans by state
CREATE INDEX goal_contract_data_class_idx ON goal_contract(data_class);                     -- trust-boundary selection (§54.2)
CREATE INDEX goal_contract_ledger_idx     ON goal_contract(goal_delta_ledger_ref);          -- contract ↔ goal-delta join

ALTER TABLE goal_contract ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_all ON goal_contract FOR ALL TO rumah_app USING (true) WITH CHECK (true);
-- (anon/authenticated get NO policy → default-deny; the state machine is enforced by the trigger, not RLS.)

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Legal-edge state-machine guard (RS-DOS-v1 §4.3). OWNER-PROOF: fires BEFORE UPDATE for EVERY role; the
-- table owner / migrator bypasses RLS but cannot bypass a trigger (and rumah_app is non-superuser, so it
-- cannot DISABLE TRIGGER nor set session_replication_role). An illegal transition is therefore impossible
-- from any path — application code, an owner-context bug, or a raw SQL UPDATE.
--
-- LEGAL edges (the ONLY transitions permitted):
--   CREATED     → FEASIBILITY                          (submit / contract-drafted)
--   FEASIBILITY → ACTIVE | HALTED                      (pre-flight reachable | unreachable)
--   ACTIVE      → PLANNING                             (tick / no-open-sprint)
--   PLANNING    → EXECUTING                            (sprint-planned)
--   EXECUTING   → REVIEWING                            (all-work-posted | GS-early-trip)
--   REVIEWING   → DONE | PLANNING | HALTED             (complete | incomplete-but-reachable | unreachable)
--   HALTED      → PLANNING | REVIEWING | CLOSED        (founder: redirect | accept-lower-bar | kill)
--   ANY(non-terminal)        → FAILED                  (H1-cap-tripped)
--   ANY(non-terminal,≠susp.) → SUSPENDED               (founder-freeze; prev_state captures the resume target)
--   SUSPENDED                → prev_state              (founder-resume → the prior state)
-- TERMINAL (no outgoing edge): DONE (success), FAILED (failure), CLOSED.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION goal_contract_state_machine_guard() RETURNS trigger AS $$
BEGIN
  -- Identity columns are immutable (owner-proof): a transition never re-keys a contract nor rewrites its birth.
  IF NEW.goal_id <> OLD.goal_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'goal_contract %: goal_id/created_at are immutable', OLD.goal_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- No state change → allow (an updated_at touch, an objective/budget amendment, prev_state bookkeeping).
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;

  -- Terminal states have NO outgoing edge.
  IF OLD.state IN ('DONE','FAILED','CLOSED') THEN
    RAISE EXCEPTION 'goal_contract %: % is terminal — transition to % is illegal (RS-DOS-v1 §4.3)', OLD.goal_id, OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;

  -- Any edge not enumerated below is illegal.
  IF NOT (
       -- ANY non-terminal → FAILED (the H1 cap tripped)
       (NEW.state = 'FAILED')
       -- ANY non-terminal (not already suspended) → SUSPENDED (founder-freeze); prev_state MUST capture the resume target
    OR (NEW.state = 'SUSPENDED' AND OLD.state <> 'SUSPENDED' AND NEW.prev_state = OLD.state)
       -- SUSPENDED → the prior state (founder-resume)
    OR (OLD.state = 'SUSPENDED' AND OLD.prev_state IS NOT NULL AND NEW.state = OLD.prev_state)
       -- the forward lifecycle (§4.3)
    OR (OLD.state = 'CREATED'     AND NEW.state = 'FEASIBILITY')
    OR (OLD.state = 'FEASIBILITY' AND NEW.state IN ('ACTIVE','HALTED'))
    OR (OLD.state = 'ACTIVE'      AND NEW.state = 'PLANNING')
    OR (OLD.state = 'PLANNING'    AND NEW.state = 'EXECUTING')
    OR (OLD.state = 'EXECUTING'   AND NEW.state = 'REVIEWING')
    OR (OLD.state = 'REVIEWING'   AND NEW.state IN ('DONE','PLANNING','HALTED'))
    OR (OLD.state = 'HALTED'      AND NEW.state IN ('PLANNING','REVIEWING','CLOSED'))
  ) THEN
    RAISE EXCEPTION 'goal_contract %: illegal state transition % -> % (RS-DOS-v1 §4.3 legal edges only)', OLD.goal_id, OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goal_contract_state_machine_trg
  BEFORE UPDATE ON goal_contract
  FOR EACH ROW EXECUTE FUNCTION goal_contract_state_machine_guard();
