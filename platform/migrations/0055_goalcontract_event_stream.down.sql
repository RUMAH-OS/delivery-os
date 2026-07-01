-- Down 0055 — reverse the P0 foundation: drop the GoalContract event stream (G-03), drop the tenant/stream +
-- state_machine_version columns (G-02/G-04), and RESTORE the state-machine guard to its 0053 v1-only form.
--
-- WARNING: this DISCARDS all captured GoalContract transition history (the append-only event stream) — by
-- design that history is the retained system-of-record and is NOT reconstructable from the fast read model.
-- Only roll back while the stream is still inert (no live Project Owner has transitioned a goal through the
-- dual-write door). The append-only trigger is dropped WITH the table.

DROP TABLE IF EXISTS goal_contract_event;

ALTER TABLE goal_contract DROP CONSTRAINT IF EXISTS goal_contract_smv_pos;
ALTER TABLE goal_contract DROP COLUMN IF EXISTS state_machine_version;
ALTER TABLE goal_contract DROP COLUMN IF EXISTS stream_id;
ALTER TABLE goal_contract DROP COLUMN IF EXISTS tenant_id;

-- Restore the 0053 guard (v1 legality, no version dispatch — the columns it referenced are gone).
CREATE OR REPLACE FUNCTION goal_contract_state_machine_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.goal_id <> OLD.goal_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'goal_contract %: goal_id/created_at are immutable', OLD.goal_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;

  IF OLD.state IN ('DONE','FAILED','CLOSED') THEN
    RAISE EXCEPTION 'goal_contract %: % is terminal — transition to % is illegal (RS-DOS-v1 §4.3)', OLD.goal_id, OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (
       (NEW.state = 'FAILED')
    OR (NEW.state = 'SUSPENDED' AND OLD.state <> 'SUSPENDED' AND NEW.prev_state = OLD.state)
    OR (OLD.state = 'SUSPENDED' AND OLD.prev_state IS NOT NULL AND NEW.state = OLD.prev_state)
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
