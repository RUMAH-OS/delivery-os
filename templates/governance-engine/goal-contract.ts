// Governance Engine — the GoalContract ORGAN (port-injected; DB-agnostic; the portable enforcement layer).
//
// This is the platform's re-typed mirror of `rumah-admin/src/goal-contract.ts`. The admin module imports
// `./db/client.js` and issues raw SQL; THIS module imports a `GoalContractStorePort` and issues NO SQL — every
// durable read/write crosses the injected port (the residency invariant, enforced by `residency-guard.mjs`).
//
// THE DEFENSE-IN-DEPTH MOVE (the reason this organ exists at all):
//   admin's `transition()` is a CAS UPDATE that relies WHOLLY on the 0053 DB trigger for legality — there is no
//   TS check. A vendored package that only re-types the port would therefore carry the *signatures but none of
//   the enforcement*: an imperfect adapter or a non-Postgres DB would let illegal edges succeed in silence.
//   `createGoalContractOrgan` closes that gap: it wraps the store port and runs the TS validator
//   (`state-machine.ts`) FIRST, fail-closed, BEFORE delegating the persist to the port. So:
//       TS validator (this organ, every consumer)  AND  the 0053 trigger (Postgres consumers only)
//   both refuse an illegal edge — and the golden-master cage pins the two to the SAME legal-edge set.

import type { GoalContractStorePort, CreateGoalContractInput, GoalContractRow } from "./ports.js";
import {
  type GoalState,
  assertLegalGoalTransition,
  computeNextPrevState,
  RESUMABLE_GOAL_STATES,
} from "./state-machine.js";

/**
 * Wrap a raw `GoalContractStorePort` (the consumer's adapter) with the portable §4.3 enforcement layer. The
 * returned object IS a `GoalContractStorePort` (drop-in), but `transition()` / `resume()` now run the TS legal-
 * edge validator FIRST (fail-closed) before touching the store. `createContract` / `readContract` /
 * `persistContract` pass straight through (they do not move the lifecycle state).
 *
 * Usage (mirrors how admin composes the C11 engine over its adapter):
 *   const contract = createGoalContractOrgan(postgresGoalContractStore);   // admin: TS guard + 0053 trigger
 *   const contract = createGoalContractOrgan(inMemoryGoalContractStore);   // any consumer: TS guard is the floor
 */
export function createGoalContractOrgan(store: GoalContractStorePort): GoalContractStorePort {
  const organ: GoalContractStorePort = {
    createContract: (input: CreateGoalContractInput) => store.createContract(input),
    readContract: (goalId: string) => store.readContract(goalId),
    persistContract: (input: CreateGoalContractInput & { goalId: string }) => store.persistContract(input),

    // ── transition: TS validator FIRST (fail-closed, portable), THEN persist via the port. ──
    async transition(goalId: string, to: GoalState): Promise<GoalContractRow> {
      const current = await store.readContract(goalId);
      if (!current) throw new Error(`goal_contract ${goalId} not found`);

      // Portable enforcement: refuse an illegal §4.3 edge in TypeScript, before the persist. The prev_state the
      // store WILL write is computed by the shared bookkeeping rule (computeNextPrevState) so the validator's
      // resume guard sees the same context the 0053 trigger would.
      assertLegalGoalTransition(current.state, to, { prevState: current.prevState });

      // Then persist (the adapter does the CAS; on Postgres the 0053 trigger is the owner-proof backstop).
      const row = await store.transition(goalId, to);
      return row;
    },

    // ── resume: a SUSPENDED contract back to its captured prior state (§4.3). ──
    async resume(goalId: string): Promise<GoalContractRow> {
      const current = await store.readContract(goalId);
      if (!current) throw new Error(`goal_contract ${goalId} not found`);
      if (current.state !== "SUSPENDED" || !current.prevState || !RESUMABLE_GOAL_STATES.includes(current.prevState)) {
        throw new Error(
          `goal_contract ${goalId}: not SUSPENDED with a valid resume target (state=${current.state}, prev=${current.prevState})`,
        );
      }
      // Validate the resume edge (SUSPENDED -> prev_state) before delegating.
      assertLegalGoalTransition(current.state, current.prevState, { prevState: current.prevState });
      return store.resume(goalId);
    },
  };
  return organ;
}

// Re-export the bookkeeping helper so a store ADAPTER can share the exact prev_state rule the organ validates
// against (one source of truth — no drift between what is validated and what is persisted).
export { computeNextPrevState };
