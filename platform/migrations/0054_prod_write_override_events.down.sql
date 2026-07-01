-- Down 0054 — drop the break-glass override ledger + its append-only guard function.
-- The trigger, policies, indexes and CHECK constraints drop WITH the table; the function is dropped
-- explicitly (it is table-independent).
--
-- WARNING: this DISCARDS the entire break-glass audit history (every issued / consumed / denied override
-- event). By design that history is NOT reconstructable. Only roll back while the ledger is still inert
-- (no real grant has ever been issued or consumed against a production database).

DROP TABLE IF EXISTS prod_write_override_events;
DROP FUNCTION IF EXISTS prod_write_override_append_only_guard();
