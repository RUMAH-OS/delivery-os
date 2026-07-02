// =============================================================================
// The platform EVENT STORE — the DB-backed append/drain over the append-only `platform_event` stream (0057).
// =============================================================================
// The OS side of the founder-action → Slack loop (ECR-0006). Two operations over the platform-owned event seam:
//   * appendEvent — persist ONE event, assigning the monotonic `seq` cursor. Returns the event id.
//   * drainEvents — page the stream in TOTAL ORDER, strictly PAST a supplied cursor (`since` seq), so no event is
//     ever seen twice across drains. Bounds the page by `limit`; optional server-side `type` filter.
//
// THE CROSS-BOUNDARY CONTRACT: an event maps to the frozen EventEnvelopeV1 the Slack adapter's EventsClient
// validates (deliveryos-control-surface/src/core/events-client.ts) — { id, type, version, occurredAt,
// aggregate:{type,id}, payload }. The HTTP route (GET /v1/events, server.ts) wraps a drained page into that
// client's { data:[...], meta:{ version:"v1", count, nextCursor, hasMore } } response envelope. This module is
// the ONLY event module that imports the db/client `sql` singleton (like the pg registration store).
import { sql } from "../db/client.js";

// ── The events:read scope (mirrors human-principal's WORKFLOW_SCOPES vocabulary). The drain route is gated by
// this engine scope through the SAME ScopeGuard mechanism the workflow/goals routes use — a read-only drain
// principal carries events:read; the app maps its verifier/grants onto it. ──
export const EVENTS_SCOPES = { read: "events:read" } as const;
export type EventsScope = (typeof EVENTS_SCOPES)[keyof typeof EVENTS_SCOPES];

// The current EventEnvelopeV1 schema version (v1). Stamped on every appended event; surfaced on the envelope.
export const EVENT_ENVELOPE_VERSION = 1;

/** One drained event — the EventEnvelopeV1 shape the cross-boundary EventsClient validates field-for-field. */
export interface EventEnvelope {
  id: string;
  type: string;
  version: number;
  /** ISO-8601 timestamp (the row's occurred_at). */
  occurredAt: string;
  aggregate: { type: string; id: string };
  payload: Record<string, unknown> | null;
}

/** The append input: the event type, the aggregate it is about, and an optional open payload. */
export interface AppendEventInput {
  type: string;
  aggregate: { type: string; id: string };
  payload?: Record<string, unknown> | null;
  /** OPTIONAL envelope schema version (defaults to the current v1). */
  version?: number;
}

/** The drain input: `since` cursor (a seq, absent/null ⇒ from the start), the page `limit`, an optional `type`. */
export interface DrainEventsInput {
  since?: string | number | null;
  limit: number;
  type?: string;
}

/** A drained page: the events, the cursor to persist for the next drain, whether more remain, and the count. */
export interface DrainEventsResult {
  events: EventEnvelope[];
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
}

interface EventRow {
  seq: string; // bigserial → postgres.js returns bigint as a string
  id: string;
  type: string;
  version: number;
  occurred_at: Date | string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown> | null;
}

function toEnvelope(r: EventRow): EventEnvelope {
  const occurredAt = r.occurred_at instanceof Date ? r.occurred_at.toISOString() : new Date(r.occurred_at).toISOString();
  return {
    id: r.id,
    type: r.type,
    version: Number(r.version),
    occurredAt,
    aggregate: { type: r.aggregate_type, id: r.aggregate_id },
    payload: r.payload ?? null,
  };
}

/** APPEND one event to the append-only stream. The DB assigns `seq` (the cursor) + `id`; occurred_at defaults to
 *  now(). Returns the assigned event id. The payload is stored as jsonb (SQL NULL when absent — never the string
 *  "null"). */
export async function appendEvent(input: AppendEventInput): Promise<string> {
  const version = input.version ?? EVENT_ENVELOPE_VERSION;
  const payload = input.payload == null ? null : JSON.stringify(input.payload);
  const rows = await sql<{ id: string }[]>`
    INSERT INTO platform_event (type, version, aggregate_type, aggregate_id, payload)
    VALUES (${input.type}, ${version}, ${input.aggregate.type}, ${input.aggregate.id}, ${payload}::jsonb)
    RETURNING id`;
  return rows[0]!.id;
}

/** DRAIN a page from the stream: seq STRICTLY greater than `since` (absent/null ⇒ from seq 0), optionally filtered
 *  by `type`, ordered by seq ASC, bounded by `limit`. Reads limit+1 to compute hasMore; nextCursor is the last
 *  returned event's seq as a string (null on an empty page). Total-ordered + strictly-past-cursor ⇒ no event is
 *  seen twice across successive drains that advance on the returned nextCursor. */
export async function drainEvents(input: DrainEventsInput): Promise<DrainEventsResult> {
  const sinceSeq = input.since == null || input.since === "" ? "0" : String(input.since);
  const limit = Math.max(1, Math.trunc(input.limit));
  const rows = await sql<EventRow[]>`
    SELECT seq, id, type, version, occurred_at, aggregate_type, aggregate_id, payload
    FROM platform_event
    WHERE seq > ${sinceSeq}::bigint
    ${input.type ? sql`AND type = ${input.type}` : sql``}
    ORDER BY seq ASC
    LIMIT ${limit + 1}`;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = page.length ? String(page[page.length - 1]!.seq) : null;
  return {
    events: page.map(toEnvelope),
    nextCursor,
    hasMore,
    count: page.length,
  };
}
