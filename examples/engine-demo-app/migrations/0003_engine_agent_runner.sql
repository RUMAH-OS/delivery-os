-- 0003 Workflow Engine — Slice A: the PRODUCTION AGENT RUNNER claim/lease (additive, reversible).
-- Builds ON the await primitive (0002): an `await-callback` step can now DECLARE its block source
-- (await_source = 'agent-result'); a continuous runner DRAINS many such blocked steps concurrently &
-- durably. This migration adds the runner CLAIM/LEASE on workflow_step so a runner can claim a blocked
-- agent-result step with SKIP LOCKED, hold a time-boxed lease, and have a crashed runner's claim
-- auto-reclaimed by another runner after the lease expires. It does NOT touch / drop any 0001/0002 object.
--
-- WHY A SEPARATE LEASE (distinct from the step LEASE in 0001):
--   The 0001 lease (lease_until/lease_token) is the TICK's visibility lease over a READY/LEASED step — held
--   only WHILE a tick is executing one transition, then released. A blocked agent-result step holds NO 0001
--   lease (a blocked step is leaseless — crash-while-blocked is trivially resumable). The RUNNER claim is a
--   SECOND, longer-lived lease over a BLOCKED step: it marks "a runner has taken responsibility for executing
--   this agent task and posting its result". The two never overlap (tick-lease is for ready/leased; runner
--   claim is for blocked), so they are kept as separate columns rather than overloading one.
--
-- WHAT THIS ADDS:
--   runner_id                text NULL  — which runner claimed this blocked agent-result step (audit/identity).
--   runner_claimed_at        timestamptz NULL — when the claim was taken.
--   runner_lease_expires_at  timestamptz NULL — the claim lease expiry; a NULL/past value = the step is
--                            CLAIMABLE again (a crashed runner's work is reclaimed by another runner).
--   a PARTIAL INDEX supporting the SKIP-LOCKED claim query: blocked agent-result steps whose runner lease is
--   null or expired (the runner's claim predicate; keeps the scan tiny).
--
-- RLS: 0001 already enabled RLS + the table-level app-role FOR ALL policy on workflow_step (USING true / WITH
-- CHECK true). A table-level policy covers ALL columns, so the NEW columns are ALREADY governed — no per-column
-- policy is needed. The step transition guard (0002) is unaffected: a CLAIM is a same-state (blocked->blocked)
-- bookkeeping write, which the guard's same-state branch always permits — claiming never changes step state.

-- ── the runner claim/lease columns on workflow_step ───────────────────────────────────────────────
ALTER TABLE workflow_step
  ADD COLUMN runner_id               text,           -- which runner claimed this blocked agent-result step (identity/audit)
  ADD COLUMN runner_claimed_at       timestamptz,    -- when the claim was taken
  ADD COLUMN runner_lease_expires_at timestamptz;    -- claim lease expiry; NULL/past = claimable again (auto-reclaim)

-- the runner's SKIP-LOCKED claim predicate: a BLOCKED step awaiting an 'agent-result' callback whose runner
-- lease is null OR expired. The partial index keeps the claim scan tiny even with many blocked steps.
CREATE INDEX workflow_step_agent_runner_claimable_idx
  ON workflow_step(seq)
  WHERE state = 'blocked' AND await_source = 'agent-result';
