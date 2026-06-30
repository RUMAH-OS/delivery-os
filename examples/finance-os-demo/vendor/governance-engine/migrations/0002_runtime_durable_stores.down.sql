-- governance-engine — Runtime durable stores (C12) — the PAIRED DOWN migration for 0002_runtime_durable_stores.sql.
--
-- Forward-only is the production discipline (ADR-005); this DOWN exists for a CLEAN-ROOM rollback ONLY (un-applying
-- the template before any writer is live). Running it DISCARDS all runtime durable state (the goal-delta series,
-- attempt history, breaker state, idempotency keys, dead-letters, the cost ledger) — only safe while the stores
-- are still inert. It is the exact inverse of the up migration and idempotent (IF EXISTS).
--
-- Order: drop the six tables first (their per-table triggers, indexes + RLS policies drop with them), THEN the two
-- shared guard functions (they are referenced by the append-only / idempotency triggers, so they must outlive the
-- tables). CASCADE is NOT used — an explicit ordered drop surfaces any unexpected dependency rather than silently
-- cascading through it.

DROP TABLE IF EXISTS portfolio_cost_ledger;
DROP TABLE IF EXISTS dead_letter;
DROP TABLE IF EXISTS idempotency_store;
DROP TABLE IF EXISTS circuit_breaker;
DROP TABLE IF EXISTS attempt_ledger;
DROP TABLE IF EXISTS goal_delta_ledger;

DROP FUNCTION IF EXISTS c12_idempotency_guard();
DROP FUNCTION IF EXISTS c12_append_only_guard();
