-- 0004 Workflow Engine — Slice 1 (MULTI-AGENT RUNTIME): per-step agent requirement + resolved agent id.
-- Builds ON the runner claim/lease (0003). The runner is no longer ONE global executor: it routes each claimed
-- agent-result step to a registered AGENT (selectAgentFor, fail-closed). This migration records BOTH sides of
-- that routing on workflow_step (additive, reversible; touches no 0001/0002/0003 object):
--
--   agent_requirement  jsonb NULL — the step's DECLARED agent requirement ({id?, skill?}), materialized at plan
--                      time from the definition step's `agent`. The runner reads it (claimAgentTask returns it)
--                      to resolve the agent WITHOUT loading the definition (the runner stays self-contained).
--                      NULL on non-agent-result steps (they run the in-process engine handler, not an executor).
--   agent_id           text NULL — the RESOLVED agent that executed the step (selectAgentFor's pick). Written by
--                      the runner on completion / retry / terminal-fail. This is the per-agent REPORT's grouping
--                      key: steps + workflow.agent.* outbox events grouped by agent_id = per-agent execution.
--   a partial INDEX on agent_id (WHERE agent_id IS NOT NULL) supporting per-agent reporting/grouping queries.
--
-- RLS: 0001 enabled RLS + a table-level FOR ALL policy on workflow_step (USING true / WITH CHECK true). A
-- table-level policy covers ALL columns, so the NEW columns are ALREADY governed — no per-column policy needed.
-- The step transition guard (0002) is unaffected: writing agent_id/agent_requirement is a same-state
-- (blocked->blocked) bookkeeping write, which the guard's same-state branch always permits.

ALTER TABLE workflow_step
  ADD COLUMN agent_requirement jsonb,   -- the step's declared agent requirement ({id?, skill?}) — runner resolves it
  ADD COLUMN agent_id          text;    -- the RESOLVED agent that executed the step (per-agent report grouping key)

-- per-agent reporting/grouping: steps that were executed by a resolved agent. Partial (most steps have no agent).
CREATE INDEX workflow_step_agent_id_idx
  ON workflow_step(agent_id)
  WHERE agent_id IS NOT NULL;
