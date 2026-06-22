-- 0000 demo-app plane bootstrap — the app-owned least-privilege role the engine's RLS policies grant.
-- The CANONICAL engine DDL (0001/0002, applied verbatim from .claude/os/engine/migrations) grants role
-- `rumah_app` (the reference installer's role — see the portability NOTE in 0001_engine_core.sql). A real
-- 2nd app substitutes its OWN role here; this demo keeps the canonical name so the engine DDL applies
-- byte-identically (proving "engine owns the SHAPE; the app owns the plane + the role"). This is APP infra,
-- NOT engine DDL — the engine migration deliberately does not create the role (it would not exist in an
-- engine-only plane). Idempotent: create the role only if absent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rumah_app') THEN
    CREATE ROLE rumah_app;
  END IF;
END
$$;
