-- 0057 platform_event — the OS-owned, append-only PLATFORM EVENT STREAM (the durable outbox drain, ECR-0006).
-- The founder-action → Slack loop's OS side: the enforce-flip's onFounderAction sink now PERSISTS an event here
-- (a `founder_action` envelope), and a scope-gated `GET /v1/events` drain (events:read) pages this stream in
-- total order so the Slack adapter's EventsClient (deliveryos-control-surface/src/core/events-client.ts) can drain
-- it at-least-once, consumer-idempotent-by-`id`. This is the CROSS-BOUNDARY seam (an HTTP-drained envelope), a
-- SIBLING of — never a replacement for — the goal-lifecycle stream 0055 (goal_contract_event, the SoR history the
-- reconciler dual-writes). 0055 is the goal spine's private ledger; THIS is the public, drainable event seam.
--
-- ── EXPAND-ONLY / production-safe (continues the 0052/0053/0054/0055/0056 DRB-v1 §8 discipline) ─────────────────
--   * ADDITIVE ONLY: ONE new greenfield table. NO ALTER/DROP/RENAME/type-change of any existing table. Old
--     instances tolerate this schema (they never reference it) — an EXPAND that applies safely before the code
--     that reads it ships.
--   * The table is EMPTY at create, so its indexes lock a brand-new relation no live traffic references —
--     correct inside the migrator's per-file transaction (migrate-core.applyOne); NO CREATE INDEX CONCURRENTLY.
--   * No backfill / no data migration → no PITR precondition. NOT founder-gated (off every serving path) →
--     applies on a plain `db:migrate` (NOT in GATED_MIGRATIONS).
--
-- ── APPEND-ONLY RLS (the 0052/0055 C12 tamper-evidence pattern) ────────────────────────────────────────────────
--   rumah_app gets INSERT + SELECT only (no UPDATE/DELETE policy → RLS denies mutation), and a BEFORE UPDATE OR
--   DELETE trigger RAISES for EVERY role (owner included) via the shared c12_append_only_guard() from 0052 — so
--   the drained history can only ever grow. anon/authenticated get NO policy → default-deny (PostgREST closed).
--
-- ROLLBACK: forward-only (ADR-005); 0057_..down.sql drops the trigger + table. Rolling back DISCARDS the drained
-- event history — only safe while no consumer relies on a cursor advanced against events captured here.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- platform_event — the append-only drainable event stream. `seq` (bigserial) is the TOTAL-ORDER cursor: the
-- drain returns events strictly PAST a supplied `since` seq, ordered by seq, so no event is seen twice across
-- drains. The EventEnvelopeV1 shape (id/type/version/occurred_at/aggregate/payload) is the frozen cross-boundary
-- contract the Slack EventsClient validates — `version` is the envelope schema version (v1 today).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE platform_event (
  seq             bigserial PRIMARY KEY,                   -- monotonic total-order key; the OPAQUE drain cursor
  id              uuid NOT NULL DEFAULT gen_random_uuid(), -- stable event identity (consumer idempotency key)
  type            text NOT NULL,                           -- event type (e.g. 'founder_action'); server-side filter
  version         integer NOT NULL DEFAULT 1,              -- EventEnvelopeV1 schema version (v1 today)
  occurred_at     timestamptz NOT NULL DEFAULT now(),      -- when the event happened (the envelope's occurredAt)
  aggregate_type  text NOT NULL,                           -- the aggregate the event is about (e.g. 'goal')
  aggregate_id    text NOT NULL,                           -- that aggregate's id (e.g. the goalId)
  payload         jsonb,                                   -- open event body (nullable — the catalog is additive)
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_event_type_nonempty CHECK (length(type) > 0),
  CONSTRAINT platform_event_aggregate_type_nonempty CHECK (length(aggregate_type) > 0),
  CONSTRAINT platform_event_aggregate_id_nonempty CHECK (length(aggregate_id) > 0),
  CONSTRAINT platform_event_version_pos CHECK (version >= 1)
);
-- Stable event identity is unique (a consumer de-dupes by id; a re-insert of the same id is a bug, not a merge).
CREATE UNIQUE INDEX platform_event_id_uniq ON platform_event(id);
-- The type-filtered drain path: WHERE type = $t AND seq > $cursor ORDER BY seq — a composite covers it in order.
CREATE INDEX platform_event_type_seq_idx ON platform_event(type, seq);
-- Aggregate lookups (e.g. every founder_action for a goal).
CREATE INDEX platform_event_aggregate_idx ON platform_event(aggregate_type, aggregate_id);

-- Append-only: rumah_app gets INSERT + SELECT only; no UPDATE/DELETE policy → RLS denies mutation; the shared
-- c12_append_only_guard() (0052) RAISES on any UPDATE/DELETE for every role (owner included).
ALTER TABLE platform_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY rumah_app_insert ON platform_event FOR INSERT TO rumah_app WITH CHECK (true);
CREATE POLICY rumah_app_select ON platform_event FOR SELECT TO rumah_app USING (true);
-- (no UPDATE/DELETE policy → RLS denies mutation for rumah_app: append-only.)
CREATE TRIGGER platform_event_append_only_trg
  BEFORE UPDATE OR DELETE ON platform_event
  FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard();
