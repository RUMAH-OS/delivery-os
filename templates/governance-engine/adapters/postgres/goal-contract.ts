// =============================================================================
// governance-engine — REFERENCE POSTGRES ADAPTER · GoalContractStorePort (the durable PO contract).
// =============================================================================
// This is admin's `src/goal-contract.ts` BODY, re-homed as the consumer adapter behind `GoalContractStorePort`.
// The SQL is lifted VERBATIM — the create + ledger-ref backfill, the metadata upsert, and crucially the
// `transition()` that asks the DB to move the state via a CAS `UPDATE … WHERE state = <observed>`. The §4.3
// legality is NOT re-implemented here: in Postgres the `goal_contract_state_machine_trg` trigger (migration 0053 /
// the de-admin'd `migrations/0001_goal_contract.sql`) is the owner-proof backstop that throws on an illegal edge
// for every role. ONLY the shape changed: `sql` is INJECTED into a factory, not a module-level import.
//
// NOTE on the two enforcement floors a consumer gets:
//   * the PORTABLE TS validator runs FIRST — the engine wraps this adapter with `createGoalContractOrgan` in
//     `createGovernanceRuntime`, so an illegal edge is refused in TS BEFORE the SQL even fires (and on planes with
//     no trigger, the TS validator is the whole floor).
//   * the DB trigger is the owner-proof backstop — it catches a raw SQL UPDATE that bypasses the organ entirely.
// This adapter is the raw storage operation between those two floors.
// =============================================================================

import type {
  GoalContractStorePort,
  CreateGoalContractInput,
  GoalContractRow,
  GoalState,
  BudgetCap,
} from "../../ports.js";
import type { Sql } from "./connection.js";

// ── row mapper (verbatim from admin goal-contract.ts) ───────────────────────────────────────────────────────
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
    state: r.state as GoalState,
    prevState: (r.prev_state ?? null) as GoalState | null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

/**
 * Build a Postgres-backed `GoalContractStorePort` over an injected postgres-js client. Every method body is
 * admin's verbatim SQL; the only change is `sql` is the injected client, not a module-level import.
 */
export function createPostgresGoalContractStore(sql: Sql): GoalContractStorePort {
  // readContract is referenced by transition()/resume() below, so it is defined once and reused.
  async function readContract(goalId: string): Promise<GoalContractRow | null> {
    const [r] = await sql`SELECT * FROM goal_contract WHERE goal_id = ${goalId}`;
    return r ? mapRow(r) : null;
  }

  async function transition(goalId: string, to: GoalState): Promise<GoalContractRow> {
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

    const [r] = await sql`
      UPDATE goal_contract
        SET state = ${to}, prev_state = ${newPrev}, updated_at = now()
        WHERE goal_id = ${goalId} AND state = ${current.state}
        RETURNING *`;
    if (!r) {
      // The trigger throws on an illegal edge (so we never reach here for that); a missing row here means the
      // CAS lost — the state changed under us between the read and the write.
      throw new Error(`goal_contract ${goalId}: transition ${current.state} -> ${to} lost the CAS (state moved concurrently)`);
    }
    return mapRow(r);
  }

  return {
    async createContract(input: CreateGoalContractInput): Promise<GoalContractRow> {
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
          COALESCE(${ledgerRef}::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
          'CREATED')
        RETURNING *`;
      // Backfill the ledger ref to the generated goal_id when the caller didn't supply one (the common case).
      // A no-state-change UPDATE → the state-machine trigger allows it.
      if (!ledgerRef) {
        const [u] = await sql`
          UPDATE goal_contract SET goal_delta_ledger_ref = goal_id, updated_at = now()
          WHERE goal_id = ${r!.goal_id} RETURNING *`;
        return mapRow(u);
      }
      return mapRow(r);
    },

    readContract,

    async persistContract(input: CreateGoalContractInput & { goalId: string }): Promise<GoalContractRow> {
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
    },

    transition,

    async resume(goalId: string): Promise<GoalContractRow> {
      const current = await readContract(goalId);
      if (!current) throw new Error(`goal_contract ${goalId} not found`);
      if (current.state !== "SUSPENDED" || !current.prevState) {
        throw new Error(`goal_contract ${goalId}: not SUSPENDED with a resume target (state=${current.state}, prev=${current.prevState})`);
      }
      return transition(goalId, current.prevState);
    },
  };
}
