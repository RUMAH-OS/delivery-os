-- 0000 Platform app role (OS-owned, forward-only, idempotent). MUST sort BEFORE the engine migrations.
-- WHY THIS IS OS-OWNED NOW: the engine migrations (0001/0002/0005) attach RLS policies granting the
-- least-privilege app role `rumah_app` (CREATE POLICY ... TO rumah_app). In rumah-admin that role is created
-- by a TENANT migration (0021_rls_app_role.sql), which the OS does NOT apply on a bare platform DB. So the OS
-- must OWN its own app-role bootstrap, else the engine RLS policies fail on a fresh platform-owned Postgres
-- with zero tenant schema (PLATFORM-HOME-EXTRACTION.md §2.2 step 1: "only OS migrations applied; no tenant
-- schema"). This is the platform owning its own least-privilege role — never a tenant credential.
--
-- rumah_app is created WITHOUT a password (cannot log in until one is set out-of-band at deploy:
--   ALTER ROLE rumah_app WITH PASSWORD '<secret>';  -- never in a migration). The migrator + the OS runtime
-- connect as the platform DB owner (bypasses RLS), exactly as the tenant migrator/loader do — so a local
-- bare-OS proof runs uncoupled from RLS while the policies are still correctly attached for a real deploy.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rumah_app') THEN
    CREATE ROLE rumah_app LOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO rumah_app;
-- Grant on existing + FUTURE tables/sequences (the engine tables are created by later migrations in this run;
-- ALTER DEFAULT PRIVILEGES ensures they are reachable by rumah_app without a second grant migration).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rumah_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rumah_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rumah_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO rumah_app;
