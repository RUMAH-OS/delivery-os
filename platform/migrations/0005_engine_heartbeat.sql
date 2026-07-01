-- 0005 Workflow Engine — runtime LIVENESS heartbeat (additive, reversible). ADR-005 / M3.1.
-- A single row per Execution Node, stamped by the engine-host's tick loop (host-written, host-owned
-- liveness — NOT a domain/run table). A DB-plane watchdog (Supabase pg_cron, a DIFFERENT failure domain
-- than the node's compute) reads `last_beat_at` and ALARMS if it goes stale — replacing the GitHub-Actions
-- dead-man-switch cron (M3.2). PII-free (a node id + a timestamp). IF NOT EXISTS so it is idempotent
-- whether applied by this migration or pre-created by an older host build.
CREATE TABLE IF NOT EXISTS engine_heartbeat (
  node_id      text PRIMARY KEY,                         -- which Execution Node wrote the beat
  last_beat_at timestamptz NOT NULL DEFAULT now()        -- stamped each tick (throttled); freshness = liveness
);

-- RLS + an explicit app-role policy (the most-repeated repo lesson; consistent with 0001). The engine
-- (table owner) and a pg_cron job running as a privileged role both bypass RLS; this governs the app role.
ALTER TABLE engine_heartbeat ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='engine_heartbeat' AND policyname='rumah_app_all') THEN
    CREATE POLICY rumah_app_all ON engine_heartbeat FOR ALL TO rumah_app USING (true) WITH CHECK (true);
  END IF;
END $$;
