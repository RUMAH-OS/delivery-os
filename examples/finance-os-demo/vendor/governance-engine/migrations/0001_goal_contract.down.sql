-- governance-engine — GoalContract (C2-STATE) §4.3 — the PAIRED DOWN migration for 0001_goal_contract.sql.
--
-- Forward-only is the production discipline (ADR-005): this DOWN exists for a CLEAN-ROOM rollback ONLY (a
-- consumer un-applying the template before any live PO is running). Running it DISCARDS all GoalContract state —
-- never run it against a database with a live goal lifecycle. It is the exact inverse of the up migration and is
-- idempotent (IF EXISTS), so a partially-applied up can be safely re-rolled.
--
-- Order: the trigger references the function; drop the trigger first, then the function, then the table (its
-- indexes + RLS policies are dropped with the table).

DROP TRIGGER IF EXISTS goal_contract_state_machine_trg ON goal_contract;
DROP FUNCTION IF EXISTS goal_contract_state_machine_guard();
DROP TABLE IF EXISTS goal_contract;
