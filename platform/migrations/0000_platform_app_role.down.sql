-- 0000 DOWN — drop the platform app role (best-effort; reversible). Revokes then drops rumah_app.
-- Guarded so it is safe on a DB where the role was never created.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rumah_app') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM rumah_app';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM rumah_app';
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM rumah_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM rumah_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM rumah_app';
    EXECUTE 'DROP ROLE rumah_app';
  END IF;
END $$;
