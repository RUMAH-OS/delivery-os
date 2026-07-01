-- Down 0052 — drop the five C12 runtime durable stores + their two shared guard functions.
-- Triggers, policies, indexes and CHECK constraints drop WITH their tables; the two functions are
-- dropped explicitly (they are table-independent). Order is reverse-of-create (no FKs between them).
--
-- WARNING: this DISCARDS all runtime durable state — the goal-delta history, attempt history, every live
-- circuit-breaker, every reserved/consumed idempotency intent, every dead-letter terminal record, and the
-- portfolio cost ledger. By design that history is NOT reconstructable. Only roll back while the stores are
-- still inert (writers flag OFF, no real runtime has executed against them).

DROP TABLE IF EXISTS portfolio_cost_ledger;
DROP TABLE IF EXISTS dead_letter;
DROP TABLE IF EXISTS idempotency_store;
DROP TABLE IF EXISTS circuit_breaker;
DROP TABLE IF EXISTS attempt_ledger;
DROP TABLE IF EXISTS goal_delta_ledger;

DROP FUNCTION IF EXISTS c12_idempotency_guard();
DROP FUNCTION IF EXISTS c12_append_only_guard();
