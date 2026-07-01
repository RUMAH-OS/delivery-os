-- 0002 DOWN — exact inverse of 0002_engine_await_loop.sql. Drops ONLY what 0002 created; touches NO 0001
-- object (the run-level trigger, the step CHECK on state, the lease/CAS columns, RLS policies all remain).
-- Order is the reverse of creation. Idempotent-friendly (IF EXISTS) so a partial-apply can still roll back.

-- the human-gate audit table (+ its policies/indexes drop with it)
DROP TABLE IF EXISTS workflow_approval_audit;

-- the step-level legal-edge trigger + its function
DROP TRIGGER IF EXISTS workflow_step_transition_guard_trg ON workflow_step;
DROP FUNCTION IF EXISTS workflow_step_transition_guard();

-- the unique partial index on awaiting_event_id
DROP INDEX IF EXISTS workflow_step_awaiting_event_uniq;

-- the await_source CHECK then the four added columns
ALTER TABLE workflow_step DROP CONSTRAINT IF EXISTS workflow_step_await_source_chk;
ALTER TABLE workflow_step
  DROP COLUMN IF EXISTS verdict,
  DROP COLUMN IF EXISTS stop_condition,
  DROP COLUMN IF EXISTS awaiting_event_id,
  DROP COLUMN IF EXISTS await_source;
