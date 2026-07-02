// =============================================================================
// GOAL-CONTRACT INVESTIGATE SOURCE — C0-INVESTIGATE over the LIVE governance spine (Frozen §10.2, I17).
// =============================================================================
// A REAL C0-INVESTIGATE source at N=1: when a goalId is in scope, it reads that GoalContract's DURABLE state
// through the goal-contract read API (readContract — the ONLY application-side door, §4.1) and emits CITED
// findings the reasoning call can think from ("the goal is EXECUTING, previous state PLANNING, objective …").
// Each finding is cited `goal_contract:<goalId>` — provenance into the actual row (I4). No goalId in scope ⇒
// nothing to investigate here ⇒ [] (honest).
//
// ADDITIVE / READ-ONLY (bar): it only READS via the existing exported read API — it never mutates the
// contract, never adds a migration, never touches transition()/the reconciler. The DB reader is INJECTED
// (default = the real readContract) so the assembler stays DB-free and testable: tests pass a fake reader.

import type { Finding, InvestigateQuery, InvestigateSource } from "../context-brief.js";
import { readContract, type GoalContractRow } from "../../../goal-contract.js";

/** The read seam this source depends on — the existing goal-contract read API (injectable for tests). */
export type GoalContractReader = (goalId: string) => Promise<GoalContractRow | null>;

/** Source id — stable, for audit/dedup. */
export const GOAL_CONTRACT_SOURCE_ID = "goal-contract";

/**
 * Build the goal-contract investigate source. `read` defaults to the real `readContract`; inject a fake in
 * tests to keep the assembler DB-free. When a goalId is present it reads the durable contract and turns its
 * load-bearing fields into cited findings; when absent, or when no such contract exists, it returns [].
 */
export function goalContractInvestigateSource(read: GoalContractReader = readContract): InvestigateSource {
  return {
    id: GOAL_CONTRACT_SOURCE_ID,
    async investigate(query: InvestigateQuery): Promise<Finding[]> {
      if (!query.goalId) return []; // nothing in scope to investigate here
      const row = await read(query.goalId);
      if (!row) return []; // honestly nothing: no such contract
      return contractFindings(row);
    },
  };
}

/** Turn a durable GoalContract row into CITED findings (the live state a consequential thought must know). */
export function contractFindings(row: GoalContractRow): Finding[] {
  const source = `goal_contract:${row.goalId}`;
  const observedAt = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : undefined;
  const findings: Finding[] = [
    { id: "goal.state", claim: `Goal ${row.goalId} is in lifecycle state ${row.state}.`, source, observedAt },
    { id: "goal.objective", claim: `Objective: ${row.objective}`, source, observedAt },
    { id: "goal.acceptance", claim: `Acceptance metric: ${row.acceptanceMetric}`, source, observedAt },
  ];
  if (row.prevState) {
    findings.push({
      id: "goal.prev_state",
      claim: `Previous state was ${row.prevState} (e.g. the resume target if suspended).`,
      source,
      observedAt,
    });
  }
  const budgetAxes = Object.keys(row.budgetCap ?? {});
  if (budgetAxes.length > 0) {
    findings.push({
      id: "goal.budget",
      claim: `Budget cap set on axes: ${budgetAxes.join(", ")}.`,
      source,
      observedAt,
    });
  }
  return findings;
}
