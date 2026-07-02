-- 0057 DOWN — forward-only (ADR-005). Drops the append-only drain trigger + the platform_event table.
-- DESTRUCTIVE: discards the drained event history. Only safe while no consumer has advanced a cursor against
-- events captured here (the append-only guard blocks row UPDATE/DELETE, but DROP TABLE removes the whole relation).
SET lock_timeout = '5s';
SET statement_timeout = '60s';

DROP TRIGGER IF EXISTS platform_event_append_only_trg ON platform_event;
DROP TABLE IF EXISTS platform_event;
