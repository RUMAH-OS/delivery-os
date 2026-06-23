-- 0004 DOWN — drop the per-step agent requirement + resolved agent id (reverse of 0004_engine_agent_id.sql). Reversible.
DROP INDEX IF EXISTS workflow_step_agent_id_idx;
ALTER TABLE workflow_step
  DROP COLUMN IF EXISTS agent_id,
  DROP COLUMN IF EXISTS agent_requirement;
