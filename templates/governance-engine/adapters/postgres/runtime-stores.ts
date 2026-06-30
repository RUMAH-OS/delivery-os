// =============================================================================
// governance-engine — REFERENCE POSTGRES ADAPTER · RuntimeStoresPort (the 6 C12 durable stores).
// =============================================================================
// This is admin's `src/runtime-stores.ts` BODY, re-homed as the consumer adapter behind `RuntimeStoresPort`. The
// SQL is lifted VERBATIM — the `ON CONFLICT … DO NOTHING/DO UPDATE`, `make_interval`, the CAS
// `UPDATE … WHERE breaker_state='open'`, and the per-goal `pg_advisory_xact_lock(hashtext(goalId))` inside
// `sql.begin(...)` for `appendCost`. ONLY the shape changed: instead of a top-level `import { sql } from
// "./db/client.js"`, the `sql` client is INJECTED into a factory (`createPostgresRuntimeStores(sql)`), so the
// organ never sees the driver and the package's residency invariant holds. The store INVARIANTS (append-only,
// write-once-consume, durable breaker) are enforced in the DB by the 0052 RLS + guard triggers — this layer is the
// typed, race-correct convenience over them, exactly as in admin.
//
// Connection rule (preserved from admin): use a SESSION connection (5432 / direct), NEVER the :6543 transaction
// pooler — the advisory lock + multi-statement `sql.begin` need a session. `openPostgres()` honors this.
// =============================================================================

import type {
  RuntimeStoresPort,
  ProgressSampleInput,
  AttemptInput,
  BreakerRow,
  BreakerState,
  DeadLetterInput,
  CostInput,
} from "../../ports.js";
import type { Sql } from "./connection.js";

// ── row mapper (verbatim from admin runtime-stores.ts) ──────────────────────────────────────────────────────
function mapBreaker(r: any): BreakerRow {
  return {
    stepId: r.step_id,
    goalId: r.goal_id,
    runId: r.run_id,
    breakerState: r.breaker_state as BreakerState,
    breakerCount: r.breaker_count,
    breakerCooldownUntil: r.breaker_cooldown_until == null ? null : new Date(r.breaker_cooldown_until),
    updatedAt: new Date(r.updated_at),
  };
}

/**
 * Build a Postgres-backed `RuntimeStoresPort` over an injected postgres-js client. Every method body is admin's
 * verbatim SQL; the only change is `sql` is the injected client, not a module-level import.
 */
export function createPostgresRuntimeStores(sql: Sql): RuntimeStoresPort {
  return {
    // ── 1) goal_delta_ledger ─────────────────────────────────────────────────────────────────────────────
    async appendProgressSample(s: ProgressSampleInput): Promise<boolean> {
      const rows = await sql`
        INSERT INTO goal_delta_ledger (goal_id, cycle, value, predicted, fix_ref)
        VALUES (${s.goalId}, ${s.cycle}, ${s.value ?? null}, ${s.predicted ?? null}, ${s.fixRef ?? null})
        ON CONFLICT (goal_id, cycle) DO NOTHING
        RETURNING id`;
      return rows.length > 0;
    },

    async readProgressSeries(goalId: string) {
      const rows = await sql`
        SELECT cycle, value, predicted, fix_ref AS "fixRef", ts
        FROM goal_delta_ledger WHERE goal_id = ${goalId} ORDER BY cycle ASC`;
      return rows as any;
    },

    // ── 2) attempt_ledger ────────────────────────────────────────────────────────────────────────────────
    async recordAttempt(a: AttemptInput): Promise<void> {
      await sql`
        INSERT INTO attempt_ledger (goal_id, run_id, step_id, attempt, hypothesis, action, delta, outcome)
        VALUES (${a.goalId ?? null}, ${a.runId ?? null}, ${a.stepId}, ${a.attempt},
                ${a.hypothesis ?? null}, ${a.action ?? null}, ${a.delta ?? null}, ${a.outcome})`;
    },

    async countAttempts(goalId: string): Promise<number> {
      const [r] = await sql`SELECT COUNT(*)::int AS n FROM attempt_ledger WHERE goal_id = ${goalId}`;
      return Number(r?.n ?? 0);
    },

    // ── 3) circuit_breaker (DURABLE) ─────────────────────────────────────────────────────────────────────
    async getBreaker(stepId: string): Promise<BreakerRow | null> {
      const [r] = await sql`SELECT * FROM circuit_breaker WHERE step_id = ${stepId}`;
      return r ? mapBreaker(r) : null;
    },

    async recordFailure(
      stepId: string,
      opts: { goalId?: string | null; runId?: string | null; threshold?: number; cooldownMs?: number } = {},
    ): Promise<BreakerRow> {
      const threshold = opts.threshold ?? 3;
      const cooldownMs = opts.cooldownMs ?? 60_000;
      const [r] = await sql`
        INSERT INTO circuit_breaker (step_id, goal_id, run_id, breaker_state, breaker_count, breaker_cooldown_until, updated_at)
        VALUES (${stepId}, ${opts.goalId ?? null}, ${opts.runId ?? null}, 'closed', 1, NULL, now())
        ON CONFLICT (step_id) DO UPDATE SET
          breaker_count = circuit_breaker.breaker_count + 1,
          breaker_state = CASE WHEN circuit_breaker.breaker_count + 1 >= ${threshold} THEN 'open' ELSE circuit_breaker.breaker_state END,
          breaker_cooldown_until = CASE WHEN circuit_breaker.breaker_count + 1 >= ${threshold}
                                        THEN now() + make_interval(secs => ${cooldownMs / 1000}) ELSE circuit_breaker.breaker_cooldown_until END,
          updated_at = now()
        RETURNING *`;
      // The freshly-inserted (first failure) row may still be below threshold; re-open if threshold===1.
      if (threshold <= 1 && r!.breaker_state !== "open") {
        const [o] = await sql`
          UPDATE circuit_breaker SET breaker_state='open',
            breaker_cooldown_until = now() + make_interval(secs => ${cooldownMs / 1000}), updated_at = now()
          WHERE step_id = ${stepId} RETURNING *`;
        return mapBreaker(o);
      }
      return mapBreaker(r);
    },

    async coolBreaker(stepId: string): Promise<BreakerRow | null> {
      const [r] = await sql`
        UPDATE circuit_breaker SET breaker_state='half_open', updated_at=now()
        WHERE step_id = ${stepId} AND breaker_state='open'
          AND breaker_cooldown_until IS NOT NULL AND breaker_cooldown_until <= now()
        RETURNING *`;
      return r ? mapBreaker(r) : await this.getBreaker(stepId);
    },

    async closeBreaker(stepId: string): Promise<BreakerRow | null> {
      const [r] = await sql`
        UPDATE circuit_breaker SET breaker_state='closed', breaker_count=0, breaker_cooldown_until=NULL, updated_at=now()
        WHERE step_id = ${stepId} RETURNING *`;
      return r ? mapBreaker(r) : null;
    },

    // ── 4) idempotency_store (write-ahead-intent) ──────────────────────────────────────────────────────────
    async reserveIntent(
      key: string,
      opts: { ttlSeconds?: number; scope?: string | null; runId?: string | null } = {},
    ): Promise<{ reserved: boolean }> {
      const ttl = opts.ttlSeconds ?? 86_400;
      const rows = await sql`
        INSERT INTO idempotency_store (idempotency_key, scope, run_id, ttl_seconds, expires_at)
        VALUES (${key}, ${opts.scope ?? null}, ${opts.runId ?? null}, ${ttl}, now() + make_interval(secs => ${ttl}))
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING idempotency_key`;
      return { reserved: rows.length > 0 };
    },

    async consumeIntent(key: string): Promise<{ consumed: boolean }> {
      const rows = await sql`
        UPDATE idempotency_store SET consumed_at = now()
        WHERE idempotency_key = ${key} AND consumed_at IS NULL
        RETURNING idempotency_key`;
      return { consumed: rows.length > 0 };
    },

    async isConsumed(key: string): Promise<boolean> {
      const [r] = await sql`SELECT consumed_at FROM idempotency_store WHERE idempotency_key = ${key}`;
      return !!r && r.consumed_at !== null;
    },

    // ── 5) dead_letter ───────────────────────────────────────────────────────────────────────────────────
    async recordDeadLetter(d: DeadLetterInput): Promise<string> {
      const [r] = await sql`
        INSERT INTO dead_letter (step_id, run_id, goal_id, reason, payload)
        VALUES (${d.stepId}, ${d.runId ?? null}, ${d.goalId ?? null}, ${d.reason},
                ${d.payload === undefined || d.payload === null ? null : JSON.stringify(d.payload)}::jsonb)
        RETURNING id`;
      return r!.id as string;
    },

    // ── 6) portfolio_cost_ledger ───────────────────────────────────────────────────────────────────────────
    async appendCost(c: CostInput): Promise<{ cumulativeCostCents: number }> {
      return await sql.begin(async (tx) => {
        // pg_advisory_xact_lock keyed on the goal_id (hashed) — released at commit. Serializes same-goal appends.
        await tx`SELECT pg_advisory_xact_lock(hashtext(${c.goalId}))`;
        const [prev] = await tx`
          SELECT COALESCE(MAX(cumulative_cost_cents), 0)::bigint AS cum FROM portfolio_cost_ledger WHERE goal_id = ${c.goalId}`;
        const cumulative = Number(prev!.cum) + c.costCents;
        await tx`
          INSERT INTO portfolio_cost_ledger (goal_id, run_id, cost_cents, cumulative_cost_cents, currency)
          VALUES (${c.goalId}, ${c.runId ?? null}, ${c.costCents}, ${cumulative}, ${c.currency ?? "EUR"})`;
        return { cumulativeCostCents: cumulative };
      }) as { cumulativeCostCents: number };
    },

    async readCumulativeCost(goalId: string): Promise<number> {
      const [r] = await sql`
        SELECT COALESCE(MAX(cumulative_cost_cents), 0)::bigint AS cum FROM portfolio_cost_ledger WHERE goal_id = ${goalId}`;
      return Number(r!.cum);
    },
  };
}
