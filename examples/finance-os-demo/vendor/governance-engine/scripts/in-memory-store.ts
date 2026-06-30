// Governance Engine — an IN-MEMORY `GoalContractStorePort` adapter.
//
// This is the existence proof that the port is genuinely DB-agnostic: it implements the entire seam over a
// `Map`, with NO `postgres`, NO `./db/client.js`, and — crucially — NO state-machine trigger. The legality is
// therefore supplied ENTIRELY by the TypeScript organ (`createGoalContractOrgan`) that wraps it. If the organ's
// TS validator is the only thing standing between a caller and an illegal edge, this adapter is where that gets
// proven (a Postgres adapter would also have the 0053 trigger; here there is nothing but the TS guard).
//
// It is a test/fixture adapter (used by `scripts/self-test.ts`) — not a production store (no durability).

import { randomUUID } from "node:crypto";
import type {
  GoalContractStorePort,
  CreateGoalContractInput,
  GoalContractRow,
  GoalState,
  RuntimeStoresPort,
  ProgressSampleInput,
  AttemptInput,
  BreakerRow,
  DeadLetterInput,
  CostInput,
} from "../ports.js";
import { computeNextPrevState } from "../goal-contract.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export function createInMemoryGoalContractStore(): GoalContractStorePort {
  const rows = new Map<string, GoalContractRow>();

  function clone(r: GoalContractRow): GoalContractRow {
    return { ...r, budgetCap: { ...r.budgetCap }, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) };
  }

  return {
    async createContract(input: CreateGoalContractInput): Promise<GoalContractRow> {
      const goalId = input.goalId ?? randomUUID();
      const now = new Date();
      const row: GoalContractRow = {
        goalId,
        objective: input.objective,
        acceptanceMetric: input.acceptanceMetric,
        metricSourceProbeId: input.metricSourceProbeId,
        metricSourceVersion: input.metricSourceVersion,
        dataClass: input.dataClass,
        budgetCap: input.budgetCap ?? {},
        // ledger ref defaults to the contract's own goal_id (the scope key) — mirrors admin's backfill.
        goalDeltaLedgerRef: input.goalDeltaLedgerRef ?? goalId ?? ZERO_UUID,
        state: "CREATED",
        prevState: null,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(goalId, row);
      return clone(row);
    },

    async readContract(goalId: string): Promise<GoalContractRow | null> {
      const r = rows.get(goalId);
      return r ? clone(r) : null;
    },

    async persistContract(input: CreateGoalContractInput & { goalId: string }): Promise<GoalContractRow> {
      const existing = rows.get(input.goalId);
      const now = new Date();
      if (!existing) {
        // upsert: create at CREATED (state is NEVER set by persist).
        return this.createContract(input);
      }
      // metadata-only write-through; `state`/`prevState` deliberately untouched.
      existing.objective = input.objective;
      existing.acceptanceMetric = input.acceptanceMetric;
      existing.metricSourceProbeId = input.metricSourceProbeId;
      existing.metricSourceVersion = input.metricSourceVersion;
      existing.dataClass = input.dataClass;
      existing.budgetCap = input.budgetCap ?? {};
      existing.goalDeltaLedgerRef = input.goalDeltaLedgerRef ?? existing.goalDeltaLedgerRef;
      existing.updatedAt = now;
      return clone(existing);
    },

    // RAW persist of a state move (NO legality check here — that is the organ's job; this adapter has no
    // trigger, which is exactly what proves the TS validator is the portable enforcement floor).
    async transition(goalId: string, to: GoalState): Promise<GoalContractRow> {
      const r = rows.get(goalId);
      if (!r) throw new Error(`goal_contract ${goalId} not found`);
      r.prevState = computeNextPrevState(r.state, to, r.prevState);
      r.state = to;
      r.updatedAt = new Date();
      return clone(r);
    },

    async resume(goalId: string): Promise<GoalContractRow> {
      const r = rows.get(goalId);
      if (!r) throw new Error(`goal_contract ${goalId} not found`);
      if (r.state !== "SUSPENDED" || !r.prevState) {
        throw new Error(`goal_contract ${goalId}: not SUSPENDED with a resume target`);
      }
      return this.transition(goalId, r.prevState);
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SLICE 2 — an IN-MEMORY `RuntimeStoresPort` adapter (the 6 C12 durable stores over Maps/arrays; NO DB).
//
// This is the existence proof that the C12 seam is genuinely DB-agnostic: it implements all 14 methods with NO
// `postgres`, NO `./db/client.js`, NO `pg_advisory_xact_lock`, NO `make_interval`, NO RLS — yet it PRESERVES THE
// REAL SEMANTICS so an organ (the Goal Supervisor) behaves identically against it:
//   * APPEND-ONLY (structural): the four append-only stores are plain arrays this adapter only ever PUSHes to.
//     There is no code path that splices, overwrites, or deletes an existing append-only row — the append-only
//     invariant the 0052 `c12_append_only_guard` trigger enforces is honored by construction (and the port has
//     no method to ask for a mutation in the first place). `runtime-stores-cage.ts` pins this.
//   * IDEMPOTENCY (goal_delta_ledger): append is idempotent on (goal_id, cycle) — a re-probe of a recorded cycle
//     is a no-op returning false (mirrors `ON CONFLICT (goal_id, cycle) DO NOTHING`).
//   * IDEMPOTENCY (idempotency_store): reserve is a PK race — exactly one reserve wins (reserved=true); consume
//     is WRITE-ONCE (a second consume returns false; a consumed key can never be un-consumed). Mirrors the 0052
//     `c12_idempotency_guard` write-once column rule.
//   * DURABLE BREAKER COOLDOWN: recordFailure advances closed→open at the threshold with a cooldown; coolBreaker
//     moves open→half_open ONLY once the cooldown has elapsed (a `now()` injectable for deterministic proofs).
//   * UNIQUE ATTEMPT: recordAttempt throws on a duplicate (step_id, attempt) (mirrors the unique-index 23505).
//   * PER-GOAL CUMULATIVE COST: appendCost computes cumulative = prior-max + this charge (the `pg_advisory_xact_
//     lock` per-goal serialization is a Postgres concurrency detail; single-threaded JS is already serialized).
//
// It is a test/fixture adapter — not a production store (no durability).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════

interface ProgressRow { goalId: string; cycle: number; value: number | null; predicted: number | null; fixRef: string | null; ts: Date }
interface AttemptRow { goalId: string | null; runId: string | null; stepId: string; attempt: number; hypothesis: string | null; action: string | null; delta: number | null; outcome: string; ts: Date }
interface DeadLetterRow { id: string; stepId: string; runId: string | null; goalId: string | null; reason: string; payload: unknown; createdAt: Date }
interface CostRow { id: string; goalId: string; runId: string | null; costCents: number; cumulativeCostCents: number; currency: string; ts: Date }
interface IntentRow { key: string; scope: string | null; runId: string | null; createdAt: Date; ttlSeconds: number; expiresAt: Date; consumedAt: Date | null }

export interface InMemoryRuntimeStoresOptions {
  /** Injectable clock (defaults to `() => new Date()`). Lets a cage advance time to prove breaker cooldown
   *  deterministically — the real adapter uses the DB's `now()`; this is the in-memory analogue. */
  now?: () => Date;
}

export function createInMemoryRuntimeStores(opts: InMemoryRuntimeStoresOptions = {}): RuntimeStoresPort {
  const now = opts.now ?? (() => new Date());

  // ── the four APPEND-ONLY stores: plain arrays this adapter ONLY pushes to (never splice/overwrite/delete). ──
  const goalDeltaLedger: ProgressRow[] = [];
  const attemptLedger: AttemptRow[] = [];
  const deadLetters: DeadLetterRow[] = [];
  const costLedger: CostRow[] = [];
  // ── the two MUTABLE stores. ──
  const breakers = new Map<string, BreakerRow>();
  const intents = new Map<string, IntentRow>();

  function cloneBreaker(r: BreakerRow): BreakerRow {
    return { ...r, breakerCooldownUntil: r.breakerCooldownUntil == null ? null : new Date(r.breakerCooldownUntil), updatedAt: new Date(r.updatedAt) };
  }

  return {
    // ── 1) goal_delta_ledger (APPEND-ONLY; idempotent on goal_id+cycle) ──────────────────────────────────────
    async appendProgressSample(s: ProgressSampleInput): Promise<boolean> {
      // idempotent on (goal_id, cycle) — a re-probe of a recorded cycle is a no-op (mirrors ON CONFLICT DO NOTHING).
      if (goalDeltaLedger.some((r) => r.goalId === s.goalId && r.cycle === s.cycle)) return false;
      goalDeltaLedger.push({
        goalId: s.goalId,
        cycle: s.cycle,
        value: s.value ?? null,
        predicted: s.predicted ?? null,
        fixRef: s.fixRef ?? null,
        ts: now(),
      });
      return true;
    },

    async readProgressSeries(goalId: string): Promise<Array<{ cycle: number; value: number | null; predicted: number | null; fixRef: string | null; ts: Date }>> {
      return goalDeltaLedger
        .filter((r) => r.goalId === goalId)
        .sort((a, b) => a.cycle - b.cycle)
        .map((r) => ({ cycle: r.cycle, value: r.value, predicted: r.predicted, fixRef: r.fixRef, ts: new Date(r.ts) }));
    },

    // ── 2) attempt_ledger (APPEND-ONLY; unique on step_id+attempt) ──────────────────────────────────────────
    async recordAttempt(a: AttemptInput): Promise<void> {
      // unique on (step_id, attempt) — a duplicate throws (mirrors the unique-index 23505), never overwrites.
      if (attemptLedger.some((r) => r.stepId === a.stepId && r.attempt === a.attempt)) {
        throw new Error(`attempt_ledger: duplicate (step_id=${a.stepId}, attempt=${a.attempt}) — unique violation`);
      }
      attemptLedger.push({
        goalId: a.goalId ?? null,
        runId: a.runId ?? null,
        stepId: a.stepId,
        attempt: a.attempt,
        hypothesis: a.hypothesis ?? null,
        action: a.action ?? null,
        delta: a.delta ?? null,
        outcome: a.outcome,
        ts: now(),
      });
    },

    async countAttempts(goalId: string): Promise<number> {
      return attemptLedger.filter((r) => r.goalId === goalId).length;
    },

    // ── 3) circuit_breaker (DURABLE / MUTABLE) ──────────────────────────────────────────────────────────────
    async getBreaker(stepId: string): Promise<BreakerRow | null> {
      const r = breakers.get(stepId);
      return r ? cloneBreaker(r) : null;
    },

    async recordFailure(stepId: string, o: { goalId?: string | null; runId?: string | null; threshold?: number; cooldownMs?: number } = {}): Promise<BreakerRow> {
      const threshold = o.threshold ?? 3;
      const cooldownMs = o.cooldownMs ?? 60_000;
      const ts = now();
      const existing = breakers.get(stepId);
      let r: BreakerRow;
      if (!existing) {
        // fresh INSERT — count 1, state 'closed', no cooldown (the ON CONFLICT CASE branch does NOT run on insert).
        r = { stepId, goalId: o.goalId ?? null, runId: o.runId ?? null, breakerState: "closed", breakerCount: 1, breakerCooldownUntil: null, updatedAt: ts };
      } else {
        // ON CONFLICT DO UPDATE — increment, OPEN with a cooldown once count reaches threshold (else keep state).
        const newCount = existing.breakerCount + 1;
        const trips = newCount >= threshold;
        r = {
          ...existing,
          breakerCount: newCount,
          breakerState: trips ? "open" : existing.breakerState,
          breakerCooldownUntil: trips ? new Date(ts.getTime() + cooldownMs) : existing.breakerCooldownUntil,
          updatedAt: ts,
        };
      }
      breakers.set(stepId, r);
      // the freshly-inserted (first failure) row may still be below threshold; re-open if threshold===1 (or less).
      if (threshold <= 1 && r.breakerState !== "open") {
        r = { ...r, breakerState: "open", breakerCooldownUntil: new Date(ts.getTime() + cooldownMs), updatedAt: now() };
        breakers.set(stepId, r);
      }
      return cloneBreaker(r);
    },

    async coolBreaker(stepId: string): Promise<BreakerRow | null> {
      const r = breakers.get(stepId);
      const t = now();
      // move OPEN → half_open ONLY once the cooldown has elapsed; else no-op (return the current durable row).
      if (r && r.breakerState === "open" && r.breakerCooldownUntil != null && r.breakerCooldownUntil.getTime() <= t.getTime()) {
        const next: BreakerRow = { ...r, breakerState: "half_open", updatedAt: t };
        breakers.set(stepId, next);
        return cloneBreaker(next);
      }
      return r ? cloneBreaker(r) : null;
    },

    async closeBreaker(stepId: string): Promise<BreakerRow | null> {
      const r = breakers.get(stepId);
      if (!r) return null;
      const next: BreakerRow = { ...r, breakerState: "closed", breakerCount: 0, breakerCooldownUntil: null, updatedAt: now() };
      breakers.set(stepId, next);
      return cloneBreaker(next);
    },

    // ── 4) idempotency_store (MUTABLE; reserve = PK race, consume = write-once) ──────────────────────────────
    async reserveIntent(key: string, o: { ttlSeconds?: number; scope?: string | null; runId?: string | null } = {}): Promise<{ reserved: boolean }> {
      // PK race: exactly one reserve wins (mirrors INSERT … ON CONFLICT (idempotency_key) DO NOTHING).
      if (intents.has(key)) return { reserved: false };
      const ttl = o.ttlSeconds ?? 86_400;
      const created = now();
      intents.set(key, {
        key,
        scope: o.scope ?? null,
        runId: o.runId ?? null,
        createdAt: created,
        ttlSeconds: ttl,
        expiresAt: new Date(created.getTime() + ttl * 1000),
        consumedAt: null,
      });
      return { reserved: true };
    },

    async consumeIntent(key: string): Promise<{ consumed: boolean }> {
      const r = intents.get(key);
      // write-once: only an unconsumed, reserved intent can be consumed (mirrors UPDATE … WHERE consumed_at IS NULL
      // + the c12_idempotency_guard write-once column rule — a consumed key can never be re-consumed).
      if (!r || r.consumedAt !== null) return { consumed: false };
      r.consumedAt = now();
      return { consumed: true };
    },

    async isConsumed(key: string): Promise<boolean> {
      const r = intents.get(key);
      return !!r && r.consumedAt !== null;
    },

    // ── 5) dead_letter (APPEND-ONLY) ────────────────────────────────────────────────────────────────────────
    async recordDeadLetter(d: DeadLetterInput): Promise<string> {
      const id = randomUUID();
      deadLetters.push({
        id,
        stepId: d.stepId,
        runId: d.runId ?? null,
        goalId: d.goalId ?? null,
        reason: d.reason,
        // mirror the adapter's jsonb round-trip (undefined/null → null) without changing structure.
        payload: d.payload === undefined || d.payload === null ? null : JSON.parse(JSON.stringify(d.payload)),
        createdAt: now(),
      });
      return id;
    },

    // ── 6) portfolio_cost_ledger (APPEND-ONLY; per-goal serialized cumulative) ───────────────────────────────
    async appendCost(c: CostInput): Promise<{ cumulativeCostCents: number }> {
      // per-goal cumulative = prior MAX(cumulative) for the goal + this charge. The pg_advisory_xact_lock that
      // serializes concurrent same-goal appends in Postgres is unnecessary here (single-threaded JS is serialized).
      const priorMax = costLedger.filter((r) => r.goalId === c.goalId).reduce((m, r) => Math.max(m, r.cumulativeCostCents), 0);
      const cumulative = priorMax + c.costCents;
      costLedger.push({
        id: randomUUID(),
        goalId: c.goalId,
        runId: c.runId ?? null,
        costCents: c.costCents,
        cumulativeCostCents: cumulative,
        currency: c.currency ?? "EUR",
        ts: now(),
      });
      return { cumulativeCostCents: cumulative };
    },

    async readCumulativeCost(goalId: string): Promise<number> {
      return costLedger.filter((r) => r.goalId === goalId).reduce((m, r) => Math.max(m, r.cumulativeCostCents), 0);
    },
  };
}
