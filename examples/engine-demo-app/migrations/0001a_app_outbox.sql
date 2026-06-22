-- 0001a demo-app plane infra — the APP-OWNED outbox the engine emits to (transactional outbox, C5).
-- The CANONICAL engine DDL (0001) deliberately does NOT create the outbox: "the engine EMITS to an outbox the
-- INSTALLER owns ... the engine migration deliberately does NOT touch the outbox here (it would not exist in an
-- engine-only plane)." So every installer owns this table. Admin has the equivalent; the demo keeps it minimal.
-- The installer also owns bounding outbox growth (consumed_at ack + a retention prune) — out of scope for the demo.
CREATE TABLE outbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           text NOT NULL,            -- the engine event type (e.g. workflow.run.completed) / domain event
  aggregate_type text NOT NULL,            -- the engine emits 'workflow_run'
  aggregate_id   uuid NOT NULL,            -- the run id
  payload        jsonb,                    -- data-minimised IDs/refs (PII-free)
  created_at     timestamptz NOT NULL DEFAULT now(),
  consumed_at    timestamptz              -- installer-owned ack (drain bounds growth) — unused in the demo
);
CREATE INDEX outbox_unconsumed_idx ON outbox(created_at) WHERE consumed_at IS NULL;
