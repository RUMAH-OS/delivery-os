-- 0002 Workflow Engine — Slice 1: the verified-loop + the block/resume await primitive (additive, reversible).
-- Conditions D1-D4 / S1-S5 / R1-R2 / C1-C2.
-- Builds ON the engine core (0001): the 7-state run machine, the tick, the lease/CAS, attempt/max_attempts.
-- This migration adds ONLY the Slice-1 cut scope; it does NOT touch / drop any 0001 object.
--
-- WHAT THIS ADDS (D1-D4):
--   D1: workflow_step += await_source (CHECK enum or NULL) + awaiting_event_id + a UNIQUE PARTIAL INDEX on
--       awaiting_event_id WHERE awaiting_event_id IS NOT NULL (makes duplicate-callback safe BY CONSTRUCTION +
--       the completer's awaiting_event_id match unambiguous). wake_at is DEFERRED to Slice 2 (NOT added here).
--   D3: REUSE the existing attempt / max_attempts (0001) for the hard cap. NO new counter is added.
--   D2: a STEP-LEVEL legal-edge trigger (BEFORE UPDATE on workflow_step) — the completer is the FIRST
--       cross-process writer of step state (blocked->executing materialised as the step's blocked->done after
--       the await resolves). The DB backstop mirrors the app validator (state-machine.ts STEP edges).
--   D4: stop_condition (jsonb declarative predicate) + verdict (jsonb) columns. The engine evaluates a PURE
--       predicate over the stored verdict; it NEVER runs the verifier (the verifier is a capability, not engine).
--
-- RLS: 0001 already enabled RLS + the table-level app-role FOR ALL policy on workflow_step (USING true / WITH
-- CHECK true). A table-level policy covers ALL columns of the table, so the NEW columns added here are ALREADY
-- governed by the existing policy — no per-column policy exists or is needed.

-- ── D1: the await columns + the declarative loop columns on workflow_step ─────────────────────────
ALTER TABLE workflow_step
  ADD COLUMN await_source      text,                                   -- pluggable callback source (or NULL = in-process)
  ADD COLUMN awaiting_event_id uuid,                                   -- correlation key = the request/await event id (R1)
  ADD COLUMN stop_condition    jsonb,                                  -- declarative loop stop predicate (D4) — evaluated by the engine
  ADD COLUMN verdict           jsonb;                                  -- the verifier's last Verdict ({verdict,reasons[]}) (D4) — read by the predicate

-- await_source is a CLOSED enum (S2 per-source least-privilege) or NULL (a plain in-process step). timer is
-- listed for the Slice-2 forward-compat shape but is INTERNAL-ONLY (no HTTP ingress in Slice 1).
ALTER TABLE workflow_step
  ADD CONSTRAINT workflow_step_await_source_chk
  CHECK (await_source IS NULL OR await_source IN ('system-callback','agent-result','timer','domain-event','human-response'));

-- D1: UNIQUE PARTIAL INDEX on awaiting_event_id. Two steps can NEVER await the same event id; a duplicate
-- callback can therefore match AT MOST one blocked step (the completer's match is unambiguous), and the
-- correlation key is unique by construction (the duplicate-callback safety floor).
CREATE UNIQUE INDEX workflow_step_awaiting_event_uniq
  ON workflow_step(awaiting_event_id) WHERE awaiting_event_id IS NOT NULL;

-- ── D2: the STEP-LEVEL legal-edge trigger (the DB backstop for step transitions) ─────────────────
-- Mirrors the run-level guard (0001) at the STEP granularity. The completer is a NEW cross-process writer of
-- step state, so the DB — not just the app — must enforce the step edge whitelist. Same-state writes
-- (lease/checkpoint/attempt/verdict bookkeeping) are always permitted; only a state CHANGE is whitelist-checked.
-- The whitelist MUST mirror state-machine.ts LEGAL_STEP_EDGES exactly (the golden-master cage pins both).
--   ready->leased       lease a ready step
--   leased->done        step succeeded (incl. verify pass / cap-trip judged)
--   leased->failed      step failed (transient retry or terminal)
--   leased->blocked     await step yields: block on a correlation key (R1; the completer's first edge)
--   leased->ready       the verify step re-readies itself on a failing check (loop back-edge)
--   failed->leased      auto-retry re-lease (D3 retry path bumps attempt)
--   done->ready         the loop BACK-EDGE: re-open a done act step for another attempt (Improve)
--   ready->done         SKIP: a conditional step (the cap-trip gate) is skipped on a clean loop stop
--   ready->blocked      a step is blocked for a human without leasing (C6 / cap-trip human gate, R1)
--   blocked->done       the await resolved (the COMPLETER advances it — the new cross-process write, D2)
--   blocked->failed     the await escalated to terminal failure
CREATE OR REPLACE FUNCTION workflow_step_transition_guard() RETURNS trigger AS $$
BEGIN
  IF (NEW.state = OLD.state) THEN
    RETURN NEW;  -- bookkeeping write (lease/checkpoint/attempt/verdict) — not a transition
  END IF;
  IF NOT (
       (OLD.state = 'ready'   AND NEW.state = 'leased')
    OR (OLD.state = 'leased'  AND NEW.state = 'done')
    OR (OLD.state = 'leased'  AND NEW.state = 'failed')
    OR (OLD.state = 'leased'  AND NEW.state = 'blocked')
    OR (OLD.state = 'leased'  AND NEW.state = 'ready')
    OR (OLD.state = 'failed'  AND NEW.state = 'leased')
    OR (OLD.state = 'done'    AND NEW.state = 'ready')
    OR (OLD.state = 'ready'   AND NEW.state = 'done')
    OR (OLD.state = 'ready'   AND NEW.state = 'blocked')
    OR (OLD.state = 'blocked' AND NEW.state = 'done')
    OR (OLD.state = 'blocked' AND NEW.state = 'failed')
  ) THEN
    RAISE EXCEPTION 'illegal workflow_step transition % -> % (fail-closed; not in the step legal-edge whitelist)', OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_step_transition_guard_trg
  BEFORE UPDATE ON workflow_step
  FOR EACH ROW EXECUTE FUNCTION workflow_step_transition_guard();

-- ── append-only human-gate audit (S1: fail-CLOSED durable evidence atomic with the gate advance) ──────
-- Append-only at the DATABASE via RLS (INSERT + SELECT policies only; NO update/delete policy -> RLS denies
-- both for the app role -> tamper-evident). This row is written INSIDE the SAME transaction as the
-- blocked->executing/blocked->done advance: if this insert fails, the whole gate transaction rolls back and
-- the gate does NOT open (S1 fail-CLOSED). It is the system-of-record evidence for the irreversible human
-- gate, not an observability trail. PII-FREE BY CONTRACT (refs + coded reasons only; never names/emails/free-text).
CREATE TABLE workflow_approval_audit (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid NOT NULL REFERENCES workflow_run(id) ON DELETE CASCADE,
  step_seq         integer NOT NULL,                       -- the gated step's seq (run+step binding, S1)
  awaiting_event_id uuid NOT NULL,                         -- the correlation key the gate resolved (S1 action binding)
  action_id        text NOT NULL,                          -- the single-use action/candidate id the human consumed (S1)
  decision         text NOT NULL CHECK (decision IN ('approve','reject')),  -- the human verdict
  actor_sub        text NOT NULL,                          -- the VERIFIED human principal subject (S1; never a service)
  actor_email      text,                                   -- audit identity (not 3rd-party PII)
  actor_role       text,                                   -- audit identity
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflow_approval_audit_run_idx ON workflow_approval_audit(run_id, step_seq);
-- S1 single-use: at most ONE consumed approval per action_id (a replay of the same action is a DB-level no-op).
CREATE UNIQUE INDEX workflow_approval_audit_action_uniq ON workflow_approval_audit(action_id);

ALTER TABLE workflow_approval_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_insert ON workflow_approval_audit FOR INSERT TO rumah_app WITH CHECK (true);
CREATE POLICY rumah_app_select ON workflow_approval_audit FOR SELECT TO rumah_app USING (true);
-- (no FOR UPDATE / FOR DELETE policy on purpose -> RLS denies both for rumah_app: append-only / tamper-evident.)
