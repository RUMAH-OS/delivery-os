-- 0003 DOWN — drop the runner claim/lease (reverse of 0003_engine_agent_runner.sql). Reversible.
DROP INDEX IF EXISTS workflow_step_agent_runner_claimable_idx;
ALTER TABLE workflow_step
  DROP COLUMN IF EXISTS runner_lease_expires_at,
  DROP COLUMN IF EXISTS runner_claimed_at,
  DROP COLUMN IF EXISTS runner_id;
