-- 0006 Platform outbox (OS-owned, forward-only, idempotent). Sorts AFTER the engine set (0001-0005).
-- WHY THIS IS OS-OWNED: the engine EMITS transactionally to an `outbox` but does NOT own that table — its
-- shipped drizzle object (engine/schema.ts) is the MINIMAL shape the engine writes, and the DDL is
-- "installer-owned infra" (engine 0001 C5 note). In rumah-admin the outbox is created by a TENANT migration
-- (0009_invoice.sql), which the OS does NOT apply. But PLATFORM-HOME-EXTRACTION.md §1 lists `outbox` among
-- "The platform DB" — so the OS RUNTIME (now the installer) owns its own outbox. Shape matches the engine's
-- shipped table object exactly (the four columns the engine inserts + created/consumed). Without it, the
-- engine's enqueue() fails ("relation outbox does not exist") — this is the installer's outbox obligation.

CREATE TABLE IF NOT EXISTS outbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id   uuid NOT NULL,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,     -- the engine always emits a payload object
  created_at     timestamptz NOT NULL DEFAULT now(),
  consumed_at    timestamptz                             -- null until a consumer drains it
);
CREATE INDEX IF NOT EXISTS outbox_unconsumed_idx ON outbox(created_at) WHERE consumed_at IS NULL;

-- RLS + the least-privilege app-role policy (consistent with the engine tables 0001/0005). The migrator +
-- runtime connect as the table owner (bypass RLS); this governs the app role on a real deploy.
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outbox' AND policyname='rumah_app_all') THEN
    CREATE POLICY rumah_app_all ON outbox FOR ALL TO rumah_app USING (true) WITH CHECK (true);
  END IF;
END $$;
