-- 0001 Workflow Engine — engine core DDL (CANONICAL, forward-only; additive + reversible).
-- The engine-owned schema: workflow_run + workflow_step backing the 7-state machine; a BEFORE UPDATE
-- trigger enforcing the legal-edge whitelist; RLS + an explicit app-role policy on BOTH tables;
-- UNIQUE(run_id, seq); the partial index on the tick's ready-step predicate; an index on
-- workflow_step(run_id). The engine owns this SHAPE; each installer applies it into its OWN db plane and
-- owns the INSTANCE rows. This is the canonical DDL; an installer may carry an instance copy renumbered
-- into its own migration sequence.
--
-- NOTE (portability): the RLS policies grant role `rumah_app` (the reference installer's app role). An
-- installer applying this into a different plane substitutes its own least-privilege application role.
--
-- LEASE (C1): the step's lease_until + lease_token columns + the partial ready-step index are the
-- visibility-timeout lease read via SELECT ... FOR UPDATE SKIP LOCKED in the tick. NO pgmq, NO pg_cron —
-- the heartbeat is a scheduled POST to the engine's /workflow/tick route.
--
-- CAS (C1): every state write-back is UPDATE ... WHERE lease_token = mine; a mismatch means I lost my
-- lease (a slow process resumed) and the write is discarded — prevents double-execute. Enforced in the
-- engine runner; the columns here make it possible.
--
-- EMIT-ONLY (C6): the engine runs only emit-only/idempotent steps unattended; an irreversible step
-- leaves the run blocked (no unattended money mutation).

-- ── workflow_run: the live, mutable current-truth row (NOT the outbox — that stays the event log) ──
CREATE TABLE workflow_run (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_key  text NOT NULL,                                   -- which recipe (per-project DEFINITION)
  state           text NOT NULL DEFAULT 'queued'
                    CHECK (state IN ('queued','planned','executing','blocked','completed','failed','recovered')),
  input           jsonb,                                           -- data-minimised IDs/refs, NOT PII dumps
  idempotency_key text,                                            -- re-enqueue with same key is a no-op
  attempt         integer NOT NULL DEFAULT 0,                      -- run-level attempt counter
  was_interrupted boolean NOT NULL DEFAULT false,                  -- drives recovered vs completed (#5)
  blocked_reason  text,                                            -- why a run is blocked (C6 / human gate)
  next_retry_at   timestamptz,                                     -- run-level backoff marker
  terminal_at     timestamptz,                                     -- when a terminal state was reached
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- re-enqueue idempotency: at most one run per (definition_key, idempotency_key) when a key is present.
CREATE UNIQUE INDEX workflow_run_idem_uniq
  ON workflow_run(definition_key, idempotency_key) WHERE idempotency_key IS NOT NULL;
-- the tick's run-selection predicate: runs that are advanceable (not terminal, not blocked).
CREATE INDEX workflow_run_active_idx ON workflow_run(state) WHERE state IN ('queued','planned','executing');

-- ── workflow_step: one dispatch (~ one dispatch-log row); the leasable unit ──────────────────────
CREATE TABLE workflow_step (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid NOT NULL REFERENCES workflow_run(id) ON DELETE CASCADE,
  seq           integer NOT NULL,                                  -- ordered position in the definition
  state         text NOT NULL DEFAULT 'ready'
                  CHECK (state IN ('ready','leased','done','failed','blocked')),
  step_type     text NOT NULL,                                     -- dispatch-route plan shape (no new DSL)
  owner         text NOT NULL,                                     -- ownership-policy requiredOwner
  skill         text,                                              -- skill-route top match (advisory)
  ku            text,                                              -- knowledge-route top match (advisory)
  handler       text NOT NULL,                                     -- registered executor key
  effect        text NOT NULL DEFAULT 'emit-only'
                  CHECK (effect IN ('emit-only','idempotent','irreversible','await-callback')),  -- C6 unattended gate (await-callback = the cross-system block-on-callback primitive; unattended-safe)
  lease_until   timestamptz,                                       -- visibility-timeout lease expiry (C1)
  lease_token   uuid,                                              -- CAS token for the lease (C1)
  attempt       integer NOT NULL DEFAULT 0,                        -- this step's attempt (idempotency dim)
  max_attempts  integer NOT NULL DEFAULT 3,                        -- per-step retry ceiling (#5)
  next_retry_at timestamptz,                                       -- backoff marker (auto-retry, #5)
  checkpoint    jsonb,                                             -- resumable progress marker (#4)
  result        jsonb,                                             -- step output (refs only, PII-free)
  error         jsonb,                                             -- last error (forensic; PII-free)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workflow_step_run_seq_uniq ON workflow_step(run_id, seq);   -- C3: UNIQUE(run_id, seq)
CREATE INDEX workflow_step_run_idx ON workflow_step(run_id);                    -- C3: index on (run_id)
-- C3: partial index on the tick's READY-STEP predicate (what SKIP LOCKED leases): a step is leasable
-- when it is 'ready', OR 'leased' with an EXPIRED lease (a dead process), OR a failed step due for retry.
-- The tick's lease query filters on exactly this set; the partial index keeps the scan tiny.
CREATE INDEX workflow_step_leasable_idx
  ON workflow_step(run_id, seq)
  WHERE state IN ('ready','leased','failed');

-- ── The legal-edge trigger (C3, hard gate) — the DB BACKSTOP mirroring the app validator ──────────
-- A BEFORE UPDATE trigger keyed on OLD.state that RAISEs on any transition not in the legal-edge whitelist
-- (= state-machine.ts LEGAL_RUN_EDGES). Guarantee is "modulo DB-superuser/migration": a non-superuser app
-- role cannot DISABLE TRIGGER. Same-state writes (checkpoint/lease/attempt bookkeeping) are always
-- permitted; only a state CHANGE is whitelist-checked.
CREATE OR REPLACE FUNCTION workflow_run_transition_guard() RETURNS trigger AS $$
BEGIN
  IF (NEW.state = OLD.state) THEN
    RETURN NEW;  -- bookkeeping write (checkpoint/lease/attempt) — not a transition
  END IF;
  IF NOT (
       (OLD.state = 'queued'    AND NEW.state = 'planned')
    OR (OLD.state = 'queued'    AND NEW.state = 'failed')
    OR (OLD.state = 'planned'   AND NEW.state = 'executing')
    OR (OLD.state = 'executing' AND NEW.state = 'blocked')
    OR (OLD.state = 'executing' AND NEW.state = 'completed')
    OR (OLD.state = 'executing' AND NEW.state = 'failed')
    OR (OLD.state = 'executing' AND NEW.state = 'recovered')
    OR (OLD.state = 'blocked'   AND NEW.state = 'executing')
    OR (OLD.state = 'blocked'   AND NEW.state = 'failed')
    OR (OLD.state = 'failed'    AND NEW.state = 'executing')
  ) THEN
    RAISE EXCEPTION 'illegal workflow_run transition % -> % (fail-closed; not in the legal-edge whitelist)', OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_run_transition_guard_trg
  BEFORE UPDATE ON workflow_run
  FOR EACH ROW EXECUTE FUNCTION workflow_run_transition_guard();

-- ── RLS + explicit app-role policy on BOTH tables (the most-repeated repo lesson — DO NOT skip, C3) ──
-- The reference installer's app role is `rumah_app`; substitute your plane's least-privilege app role.
ALTER TABLE workflow_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_all ON workflow_run FOR ALL TO rumah_app USING (true) WITH CHECK (true);
ALTER TABLE workflow_step ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_all ON workflow_step FOR ALL TO rumah_app USING (true) WITH CHECK (true);

-- ── C5 (event-lifecycle): the engine EMITS to an outbox the INSTALLER owns (the engine does not own the
-- outbox table — it is app infra). The installer is responsible for bounding outbox growth (an ack stamp +
-- a retention prune). The engine multiplies the append-only log (>=N events/run); the installer's outbox
-- migration owns consumed_at + the ack-and-prune drain. The engine migration deliberately does NOT touch
-- the outbox here (it would not exist in an engine-only plane).
