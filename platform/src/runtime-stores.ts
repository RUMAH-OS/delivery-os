// C12 — Runtime durable stores: the thin access / repository layer (RS-DOS-v1 §8.3, migration 0052).
//
// This is the ONLY application-side door to the five durable stores. The store INVARIANTS (append-only,
// write-once consume, durable breaker) are enforced IN THE DATABASE (RLS + guard triggers, 0052) — this layer
// is a typed, race-correct convenience over them, NOT the enforcement boundary. Every function is crash- and
// restart-safe: it holds no in-memory state, reads/writes durable rows only, and uses CAS / unique-key races /
// a per-goal transactional advisory lock for correctness under concurrency.
//
// Connection: the shared postgres-js client (src/db/client.ts), which connects via the SESSION pooler (5432)
// — NEVER the :6543 transaction pooler for this concurrent, multi-statement work.
import { sql } from "./db/client.js";

// ── Types ────────────────────────────────────────────────────────────────────────────────────────────────
export type BreakerState = "closed" | "open" | "half_open";

export interface ProgressSampleInput {
  goalId: string;
  cycle: number;
  value?: number | null;
  predicted?: number | null;
  fixRef?: string | null;
}

export interface AttemptInput {
  goalId?: string | null;
  runId?: string | null;
  stepId: string;
  attempt: number;
  hypothesis?: string | null;
  action?: string | null;
  delta?: number | null;
  outcome: string;
}

export interface BreakerRow {
  stepId: string;
  goalId: string | null;
  runId: string | null;
  breakerState: BreakerState;
  breakerCount: number;
  breakerCooldownUntil: Date | null;
  updatedAt: Date;
}

export interface DeadLetterInput {
  stepId: string;
  runId?: string | null;
  goalId?: string | null;
  reason: string;
  payload?: unknown;
}

export interface CostInput {
  goalId: string;
  runId?: string | null;
  costCents: number;
  currency?: string;
}

// ── 1) goal_delta_ledger ─────────────────────────────────────────────────────────────────────────────────
// Append one ProgressSample. Idempotent on (goal_id, cycle): a re-probe of the same cycle is a no-op (the GS
// may run twice for one cycle on a late tick). Returns true if this call inserted the sample, false if the
// cycle was already recorded.
export async function appendProgressSample(s: ProgressSampleInput): Promise<boolean> {
  const rows = await sql`
    INSERT INTO goal_delta_ledger (goal_id, cycle, value, predicted, fix_ref)
    VALUES (${s.goalId}, ${s.cycle}, ${s.value ?? null}, ${s.predicted ?? null}, ${s.fixRef ?? null})
    ON CONFLICT (goal_id, cycle) DO NOTHING
    RETURNING id`;
  return rows.length > 0;
}

// Read the goal-delta series in cycle order (the GS's dGoal/dEffort + loop-fingerprint input).
export async function readProgressSeries(goalId: string): Promise<
  Array<{ cycle: number; value: number | null; predicted: number | null; fixRef: string | null; ts: Date }>
> {
  const rows = await sql`
    SELECT cycle, value, predicted, fix_ref AS "fixRef", ts
    FROM goal_delta_ledger WHERE goal_id = ${goalId} ORDER BY cycle ASC`;
  return rows as any;
}

// ── 2) attempt_ledger ────────────────────────────────────────────────────────────────────────────────────
// Append one immutable attempt record. Unique on (step_id, attempt) — a duplicate attempt number throws
// (23505), surfacing a double-record bug rather than silently overwriting history.
export async function recordAttempt(a: AttemptInput): Promise<void> {
  await sql`
    INSERT INTO attempt_ledger (goal_id, run_id, step_id, attempt, hypothesis, action, delta, outcome)
    VALUES (${a.goalId ?? null}, ${a.runId ?? null}, ${a.stepId}, ${a.attempt},
            ${a.hypothesis ?? null}, ${a.action ?? null}, ${a.delta ?? null}, ${a.outcome})`;
}

// Count immutable attempt records for a goal — the Goal Supervisor's dEffort "attempts consumed" input
// (C7 / RS-DOS-v1 §7.2). Read-only over the append-only ledger; 0 when the goal has no recorded attempts.
export async function countAttempts(goalId: string): Promise<number> {
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM attempt_ledger WHERE goal_id = ${goalId}`;
  return Number(r?.n ?? 0);
}

// ── 3) circuit_breaker (DURABLE) ─────────────────────────────────────────────────────────────────────────
function mapBreaker(r: any): BreakerRow {
  return {
    stepId: r.step_id,
    goalId: r.goal_id,
    runId: r.run_id,
    breakerState: r.breaker_state,
    breakerCount: r.breaker_count,
    breakerCooldownUntil: r.breaker_cooldown_until == null ? null : new Date(r.breaker_cooldown_until),
    updatedAt: new Date(r.updated_at),
  };
}

// Read the durable breaker for a step (null if never tripped). This is what a fresh reconciler reads after a
// restart — the breaker state is on disk, so a runaway is NOT reset by the restart.
export async function getBreaker(stepId: string): Promise<BreakerRow | null> {
  const [r] = await sql`SELECT * FROM circuit_breaker WHERE step_id = ${stepId}`;
  return r ? mapBreaker(r) : null;
}

// Record a failure and (durably) advance the breaker. Increments the consecutive-failure count; once the count
// reaches `threshold` the breaker OPENs with a cooldown. Atomic upsert (one statement) — safe under concurrency.
// Returns the post-update durable row.
export async function recordFailure(
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
}

// Move an OPEN breaker to half_open once its cooldown has elapsed (a single trial is then permitted). No-op if
// the cooldown has not elapsed or the breaker is not open. Returns the resulting durable row.
export async function coolBreaker(stepId: string): Promise<BreakerRow | null> {
  const [r] = await sql`
    UPDATE circuit_breaker SET breaker_state='half_open', updated_at=now()
    WHERE step_id = ${stepId} AND breaker_state='open'
      AND breaker_cooldown_until IS NOT NULL AND breaker_cooldown_until <= now()
    RETURNING *`;
  return r ? mapBreaker(r) : await getBreaker(stepId);
}

// Close (reset) the breaker after a successful trial — count back to 0, cooldown cleared.
export async function closeBreaker(stepId: string): Promise<BreakerRow | null> {
  const [r] = await sql`
    UPDATE circuit_breaker SET breaker_state='closed', breaker_count=0, breaker_cooldown_until=NULL, updated_at=now()
    WHERE step_id = ${stepId} RETURNING *`;
  return r ? mapBreaker(r) : null;
}

// ── 4) idempotency_store (write-ahead-intent) ────────────────────────────────────────────────────────────
// Reserve an intent BEFORE performing a side-effect. The PK race means EXACTLY ONE concurrent caller gets
// reserved=true (it owns the side-effect); every other caller gets reserved=false (it must NOT perform it).
export async function reserveIntent(
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
}

// Confirm the side-effect completed (write-once). Returns true if THIS call set consumed_at, false if it was
// already consumed (the DB guard makes re-consume impossible, so this is a clean idempotent confirm).
export async function consumeIntent(key: string): Promise<{ consumed: boolean }> {
  const rows = await sql`
    UPDATE idempotency_store SET consumed_at = now()
    WHERE idempotency_key = ${key} AND consumed_at IS NULL
    RETURNING idempotency_key`;
  return { consumed: rows.length > 0 };
}

export async function isConsumed(key: string): Promise<boolean> {
  const [r] = await sql`SELECT consumed_at FROM idempotency_store WHERE idempotency_key = ${key}`;
  return !!r && r.consumed_at !== null;
}

// ── 5) dead_letter ───────────────────────────────────────────────────────────────────────────────────────
// Record a poison-step terminal record (append-only). Call this BEFORE emitting the boundary FAP (F15).
export async function recordDeadLetter(d: DeadLetterInput): Promise<string> {
  const [r] = await sql`
    INSERT INTO dead_letter (step_id, run_id, goal_id, reason, payload)
    VALUES (${d.stepId}, ${d.runId ?? null}, ${d.goalId ?? null}, ${d.reason},
            ${d.payload === undefined || d.payload === null ? null : JSON.stringify(d.payload)}::jsonb)
    RETURNING id`;
  return r!.id as string;
}

// ── 6) portfolio_cost_ledger ─────────────────────────────────────────────────────────────────────────────
// Append a cost row and atomically compute the running cumulative for the goal. A per-goal transactional
// advisory lock serializes concurrent appends for the SAME goal, so the cumulative is exact (two parallel
// appends never read the same prior max). Returns the new cumulative.
export async function appendCost(c: CostInput): Promise<{ cumulativeCostCents: number }> {
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
  });
}

// Read the current cumulative spend for a goal (0 if none).
export async function readCumulativeCost(goalId: string): Promise<number> {
  const [r] = await sql`
    SELECT COALESCE(MAX(cumulative_cost_cents), 0)::bigint AS cum FROM portfolio_cost_ledger WHERE goal_id = ${goalId}`;
  return Number(r!.cum);
}
