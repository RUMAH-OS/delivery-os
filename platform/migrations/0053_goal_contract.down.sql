-- Down 0053 — drop the GoalContract (C2-STATE) table + its legal-edge state-machine guard.
-- The trigger, policy, indexes and CHECK constraints drop WITH the table; the guard function is dropped
-- explicitly (it is table-independent). No FKs reference goal_contract.
--
-- WARNING: this DISCARDS all GoalContract state — every goal's objective, acceptance metric, budget cap,
-- ledger binding, and PO lifecycle state. By design that state is the project's accountability locus and is
-- NOT reconstructable. Only roll back while the contract store is still inert (no live Project Owner running
-- against it).

DROP TABLE IF EXISTS goal_contract;
DROP FUNCTION IF EXISTS goal_contract_state_machine_guard();
