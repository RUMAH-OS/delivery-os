// =============================================================================
// GoalContract (C2-STATE) — the thin access / transition layer (RS-DOS-v1 §4.1/§4.3, migration 0053).
// =============================================================================
// Sprint 1.6, first slice. This is the ONLY application-side door to the durable GoalContract — the record
// that "owns" a project (the Project Owner's accountability locus). It is RECONCILED STATE, not a daemon: the
// reconciler loop (C2-LOOP) that advances the state each tick is Sprint 3.3 and is NOT built here. This layer
// only CREATEs / PERSISTs / READs the contract and performs a LEGAL state transition.
//
// ── Where the invariants live (the load-bearing fact) ──
//   The §4.3 state-machine legality is enforced IN THE DATABASE by an owner-proof trigger
//   (goal_contract_state_machine_trg, 0053) — NOT here. This layer asks the DB to move the state; an illegal
//   edge is REJECTED by the trigger (it throws), for every role, even a raw SQL UPDATE. So transition() cannot
//   smuggle an illegal edge past the DB, and the state survives a fresh-connection restart (OM-INV-5): it is
//   durable rows only, this module holds NO in-memory state.
//
// Connection: the shared postgres-js client (src/db/client.ts), SESSION pooler (5432) — never :6543.
import { sql } from "./db/client.js";

// ── Types ────────────────────────────────────────────────────────────────────────────────────────────────
export type GoalState =
  | "CREATED" | "FEASIBILITY" | "ACTIVE" | "PLANNING" | "EXECUTING" | "REVIEWING"
  | "DONE" | "HALTED" | "FAILED" | "SUSPENDED" | "CLOSED";

export type DataClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII" | "SECRET";

/** The H1 budget cap envelope (§4.1 budget). All fields optional — an unset bound is "uncapped on that axis"
 *  (the H1 cap composes from whatever axes are present). Stored as jsonb. */
export interface BudgetCap {
  max_turns?: number;
  max_wallclock_seconds?: number;
  max_cost_cents?: number;
  [k: string]: unknown;
}

export interface CreateGoalContractInput {
  /** Optional explicit goal_id (else the DB generates one). */
  goalId?: string;
  objective: string;
  acceptanceMetric: string;
  /** §4.1 acceptance.metric_source — a REGISTERED MetricProbe (src/metric-probe.ts) probe_id + PINNED version. */
  metricSourceProbeId: string;
  metricSourceVersion: number;
  dataClass: DataClass;
  budgetCap?: BudgetCap;
  /** Logical ref into goal_delta_ledger (0052). Defaults to the contract's own goal_id (the ledger scope key). */
  goalDeltaLedgerRef?: string;
}

export interface GoalContractRow {
  goalId: string;
  objective: string;
  acceptanceMetric: string;
  metricSourceProbeId: string;
  metricSourceVersion: number;
  dataClass: DataClass;
  budgetCap: BudgetCap;
  goalDeltaLedgerRef: string;
  state: GoalState;
  prevState: GoalState | null;
  /** I11 tenant-isolation partition (single-tenant 'RUMAH' today; 0055 G-02). */
  tenantId: string;
  /** I11 per-scope stream partition ('default' today; 0055 G-02). */
  streamId: string;
  /** I12 platform self-versioning — the state-machine version this goal is pinned to (1 today; 0055 G-04). */
  stateMachineVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(r: any): GoalContractRow {
  return {
    goalId: r.goal_id,
    objective: r.objective,
    acceptanceMetric: r.acceptance_metric,
    metricSourceProbeId: r.metric_source_probe_id,
    metricSourceVersion: r.metric_source_version,
    dataClass: r.data_class,
    budgetCap: (r.budget_cap ?? {}) as BudgetCap,
    goalDeltaLedgerRef: r.goal_delta_ledger_ref,
    state: r.state,
    prevState: r.prev_state ?? null,
    // 0055 additive columns — default to the single-tenant/v1 values on any pre-0055 row shape.
    tenantId: r.tenant_id ?? "RUMAH",
    streamId: r.stream_id ?? "default",
    stateMachineVersion: r.state_machine_version ?? 1,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

/** The event-schema identity for a GoalContract lifecycle transition (I13 stamp). */
export const GOAL_CONTRACT_TRANSITION_SCHEMA_ID = "goal_contract.transition";
export const GOAL_CONTRACT_TRANSITION_SCHEMA_VERSION = 1;
/** The default actor recorded on a transition event: the sole mutator (the C2 reconciler, §4.2/I1). */
export const DEFAULT_TRANSITION_ACTOR = "po-reconciler-c2";

// ── create ───────────────────────────────────────────────────────────────────────────────────────────────
// Create a new GoalContract at the initial PO state CREATED (§4.3). The goal-delta ledger ref defaults to the
// contract's own goal_id (the scope key of its ProgressSample stream in goal_delta_ledger). Returns the
// durable row. The state can only leave CREATED via a legal transition (transition()).
export async function createContract(input: CreateGoalContractInput): Promise<GoalContractRow> {
  const goalId = input.goalId ?? null;
  const ledgerRef = input.goalDeltaLedgerRef ?? null; // when null we backfill = goal_id below
  const budget = JSON.stringify(input.budgetCap ?? {});
  const [r] = await sql`
    INSERT INTO goal_contract
      (goal_id, objective, acceptance_metric, metric_source_probe_id, metric_source_version,
       data_class, budget_cap, goal_delta_ledger_ref, state)
    VALUES (
      COALESCE(${goalId}::uuid, gen_random_uuid()),
      ${input.objective}, ${input.acceptanceMetric}, ${input.metricSourceProbeId}, ${input.metricSourceVersion},
      ${input.dataClass}, ${budget}::jsonb,
      -- ledger ref defaults to the row's own goal_id (CTE-free: resolve via a second statement is avoidable by
      -- using the same COALESCE'd id) — handled by the UPDATE below when not supplied.
      COALESCE(${ledgerRef}::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
      'CREATED')
    RETURNING *`;
  // Backfill the ledger ref to the generated goal_id when the caller didn't supply one (the common case: the
  // contract's own goal_id IS the ledger scope key). A no-state-change UPDATE → the state-machine trigger allows it.
  if (!ledgerRef) {
    const [u] = await sql`
      UPDATE goal_contract SET goal_delta_ledger_ref = goal_id, updated_at = now()
      WHERE goal_id = ${r!.goal_id} RETURNING *`;
    return mapRow(u);
  }
  return mapRow(r);
}

// ── read ─────────────────────────────────────────────────────────────────────────────────────────────────
// Read the durable GoalContract by goal_id (null if none). This is what a fresh reconciler tick reads after a
// restart — the contract + its state live on disk, so killing the reconciler/session loses no progress (OM-INV-5).
export async function readContract(goalId: string): Promise<GoalContractRow | null> {
  const [r] = await sql`SELECT * FROM goal_contract WHERE goal_id = ${goalId}`;
  return r ? mapRow(r) : null;
}

// ── persist ──────────────────────────────────────────────────────────────────────────────────────────────
// Write-through the contract's MUTABLE metadata (objective / acceptance metric / probe ref / data_class /
// budget cap / ledger ref). Idempotent upsert keyed on goal_id. It DOES NOT touch `state` — state moves ONLY
// through transition() (the §4.3 machine). On an existing row this is a no-state-change UPDATE → the
// state-machine trigger allows it. Useful for the HALTED→PLANNING "amended contract" redirect (§4.3).
export async function persistContract(input: CreateGoalContractInput & { goalId: string }): Promise<GoalContractRow> {
  const budget = JSON.stringify(input.budgetCap ?? {});
  const ledgerRef = input.goalDeltaLedgerRef ?? input.goalId;
  const [r] = await sql`
    INSERT INTO goal_contract
      (goal_id, objective, acceptance_metric, metric_source_probe_id, metric_source_version,
       data_class, budget_cap, goal_delta_ledger_ref, state)
    VALUES (${input.goalId}, ${input.objective}, ${input.acceptanceMetric}, ${input.metricSourceProbeId},
            ${input.metricSourceVersion}, ${input.dataClass}, ${budget}::jsonb, ${ledgerRef}, 'CREATED')
    ON CONFLICT (goal_id) DO UPDATE SET
      objective              = EXCLUDED.objective,
      acceptance_metric      = EXCLUDED.acceptance_metric,
      metric_source_probe_id = EXCLUDED.metric_source_probe_id,
      metric_source_version  = EXCLUDED.metric_source_version,
      data_class             = EXCLUDED.data_class,
      budget_cap             = EXCLUDED.budget_cap,
      goal_delta_ledger_ref  = EXCLUDED.goal_delta_ledger_ref,
      updated_at             = now()
      -- NB: state is deliberately NOT in the SET list — metadata persistence never moves the lifecycle state.
    RETURNING *`;
  return mapRow(r);
}

// ── transition-legally ───────────────────────────────────────────────────────────────────────────────────
// Move the contract's PO lifecycle state to `to`. LEGALITY IS ENFORCED BY THE DB TRIGGER (0053): an illegal
// edge throws (owner-proof) — this function does not re-implement the state machine, it asks the DB to move
// and surfaces the rejection. CAS on the observed `from` state (optimistic concurrency): the UPDATE only
// fires WHERE state = the state we read, so two concurrent transitions cannot both win.
//
// Founder-freeze / resume bookkeeping (§4.3):
//   * to == 'SUSPENDED'              → prev_state is set to the current state (the resume target).
//   * from == 'SUSPENDED' (resuming) → prev_state is cleared (NULL).
//   * otherwise                      → prev_state is preserved.
// The DB trigger independently re-validates these (it requires SUSPENDED's prev_state = the prior state, and a
// resume target = prev_state), so this bookkeeping cannot be subverted into an illegal edge.
//
// ── DUAL-WRITE (0055 G-03 / I13): in the SAME db transaction as the CAS state update, INSERT exactly ONE
// stamped, append-only event into goal_contract_event. The reconciled goal_contract row stays the fast read
// model; the event stream is the retained system-of-record history (the B4 invariant-auditor + the event-log
// SoR promotion read it later). The event is written ONLY on a real state move:
//   * an ILLEGAL edge → the 0053/0055 trigger RAISES inside the tx → the whole tx rolls back → NO event, NO
//     state change (property (d)).
//   * a NO-OP / CAS-lost move (no row matched) → we throw inside the tx → rollback → NO event.
// So exactly one correctly-stamped event is captured per successful transition, and none otherwise. transition()
// remains the SOLE mutator (§4.2/I1): this adds an event INSERT *inside its own transaction*, not a 2nd mutator.
//
// Returns the post-transition durable row. Throws if the edge is illegal (the trigger) or if the contract is
// gone / the CAS lost (no row matched). `actor` records who caused the move (defaults to the sole mutator).
export async function transition(goalId: string, to: GoalState, actor: string = DEFAULT_TRANSITION_ACTOR): Promise<GoalContractRow> {
  const current = await readContract(goalId);
  if (!current) throw new Error(`goal_contract ${goalId} not found`);

  let newPrev: GoalState | null;
  if (to === "SUSPENDED") {
    newPrev = current.state; // capture where to resume to
  } else if (current.state === "SUSPENDED") {
    newPrev = null; // resuming — clear the marker
  } else {
    newPrev = current.prevState; // unchanged
  }

  // One transaction: CAS state update (trigger-guarded) + the single stamped event INSERT. Either both land or
  // neither does — a rejected/lost transition leaves no event and no state change.
  const row = await sql.begin(async (tx) => {
    const [r] = await tx`
      UPDATE goal_contract
        SET state = ${to}, prev_state = ${newPrev}, updated_at = now()
        WHERE goal_id = ${goalId} AND state = ${current.state}
        RETURNING *`;
    if (!r) {
      // The trigger throws on an illegal edge (so we never reach here for that); a missing row here means the
      // CAS lost — the state changed under us between the read and the write. Throwing rolls back the tx.
      throw new Error(`goal_contract ${goalId}: transition ${current.state} -> ${to} lost the CAS (state moved concurrently)`);
    }
    // Dual-write the append-only transition event. seq = next per-contract monotonic value (computed under the
    // row lock the UPDATE above holds, so it cannot race). Partition (tenant/stream) is copied from the row.
    await tx`
      INSERT INTO goal_contract_event
        (goal_contract_id, tenant_id, stream_id, seq, from_state, to_state, actor, schema_id, schema_version, payload)
      VALUES (
        ${r.goal_id}, ${r.tenant_id}, ${r.stream_id},
        (SELECT COALESCE(MAX(seq), 0) + 1 FROM goal_contract_event WHERE goal_contract_id = ${r.goal_id}),
        ${current.state}, ${to}, ${actor},
        ${GOAL_CONTRACT_TRANSITION_SCHEMA_ID}, ${GOAL_CONTRACT_TRANSITION_SCHEMA_VERSION},
        ${JSON.stringify({
          state_machine_version: r.state_machine_version,
          prev_state_before: current.prevState,
          prev_state_after: newPrev,
        })}::jsonb)`;
    return r;
  });
  return mapRow(row);
}

// Convenience: founder-resume a SUSPENDED contract back to its captured prior state (§4.3). No-op-throws if the
// contract is not SUSPENDED or has no prev_state.
export async function resume(goalId: string): Promise<GoalContractRow> {
  const current = await readContract(goalId);
  if (!current) throw new Error(`goal_contract ${goalId} not found`);
  if (current.state !== "SUSPENDED" || !current.prevState) {
    throw new Error(`goal_contract ${goalId}: not SUSPENDED with a resume target (state=${current.state}, prev=${current.prevState})`);
  }
  return transition(goalId, current.prevState);
}
