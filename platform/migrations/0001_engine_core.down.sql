-- 0001 DOWN — exact inverse of 0001_engine_core.sql (tested DOWN).
-- Drop in reverse dependency order: the legal-edge trigger + function, then the two engine tables (their
-- RLS policies + indexes drop with them). The engine migration does NOT own the outbox, so there is no
-- outbox comment to revert here (the installer owns that).

-- the legal-edge trigger + its function.
DROP TRIGGER IF EXISTS workflow_run_transition_guard_trg ON workflow_run;
DROP FUNCTION IF EXISTS workflow_run_transition_guard();

-- the two engine tables — DROP TABLE cascades their indexes, RLS policies, and the FK from workflow_step.
DROP TABLE IF EXISTS workflow_step;
DROP TABLE IF EXISTS workflow_run;
