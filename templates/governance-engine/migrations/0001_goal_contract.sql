-- governance-engine — GoalContract (C2-STATE) §4.3 legal-edge state machine: the CAGE'S PINNED REFERENCE DDL.
--
-- SCOPE NOTE (read this): this file is BOTH (a) the de-admin'd, applyable migration template for goal_contract —
-- the goal_contract table + full RLS policy set + the §4.3 state-machine trigger, with `{{app_role}}` the only
-- substitution and a paired DOWN in `0001_goal_contract.down.sql` (slice-5 work-item W1, now complete; see
-- `migrations/README.md`) — AND (b) the §4.3 state-machine GUARD that the golden-master cage (`golden-master.ts`)
-- parses to prove the TypeScript validator (`state-machine.ts`) and the DB trigger describe the SAME legal-edge
-- set. It is the governance analogue of the C11 engine's `templates/workflow-engine/migrations/0001_engine_core.sql`
-- (the canonical DDL the engine's cage pins against, shipped WITH the engine so the cage runs in any checkout).
-- The reference Postgres adapter that issues the SQL behind the ports lives in `../adapters/postgres/`.
--
-- PROVENANCE: lifted verbatim (legality unchanged) from `rumah-admin/migrations/0053_goal_contract.sql`. The
-- ONLY de-admin'ing here is the RLS role, parameterized as `{{app_role}}` (the guard FUNCTION references no role
-- — the cage parses the function body, which is identical to admin's). When the admin sibling repo is present,
-- the cage ALSO parses admin's real 0053 and asserts this copy has not drifted from it.
--
-- LEGAL edges (the ONLY transitions permitted) — see the guard body below for the authoritative enumeration:
--   CREATED     → FEASIBILITY
--   FEASIBILITY → ACTIVE | HALTED
--   ACTIVE      → PLANNING
--   PLANNING    → EXECUTING
--   EXECUTING   → REVIEWING
--   REVIEWING   → DONE | PLANNING | HALTED
--   HALTED      → PLANNING | REVIEWING | CLOSED
--   ANY(non-terminal)        → FAILED        (H1-cap-tripped)
--   ANY(non-terminal,≠susp.) → SUSPENDED     (founder-freeze; prev_state captures the resume target)
--   SUSPENDED                → prev_state    (founder-resume → the captured prior state)
-- TERMINAL (no outgoing edge): DONE, FAILED, CLOSED.

CREATE TABLE goal_contract (
  goal_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective               text NOT NULL,
  acceptance_metric       text NOT NULL,
  metric_source_probe_id  text NOT NULL,
  metric_source_version   integer NOT NULL,
  data_class              text NOT NULL,
  budget_cap              jsonb NOT NULL DEFAULT '{}'::jsonb,
  goal_delta_ledger_ref   uuid NOT NULL,
  state                   text NOT NULL DEFAULT 'CREATED',
  prev_state              text,
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
CREATE INDEX goal_contract_state_idx      ON goal_contract(state);
CREATE INDEX goal_contract_data_class_idx ON goal_contract(data_class);
CREATE INDEX goal_contract_ledger_idx     ON goal_contract(goal_delta_ledger_ref);

ALTER TABLE goal_contract ENABLE ROW LEVEL SECURITY;
-- The consumer owns its app role; `{{app_role}}` is substituted at install (admin: rumah_app). The state-machine
-- legality is NOT an RLS concern — it is the owner-proof trigger below, which fires for EVERY role.
CREATE POLICY app_all ON goal_contract FOR ALL TO {{app_role}} USING (true) WITH CHECK (true);

-- ── Legal-edge state-machine guard (RS-DOS-v1 §4.3). OWNER-PROOF: BEFORE UPDATE for EVERY role. ─────────────
CREATE OR REPLACE FUNCTION goal_contract_state_machine_guard() RETURNS trigger AS $$
BEGIN
  -- Identity columns are immutable.
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
