// Governance Engine — the §4.3 GoalContract lifecycle state machine + transition validator.
//
// PURPOSE (the load-bearing fact this file fixes):
//   The §4.3 GoalContract legality currently exists ONLY as a Postgres PL/pgSQL BEFORE-UPDATE trigger
//   (rumah-admin migration 0053, `goal_contract_state_machine_guard`). There is NO TypeScript mirror — so a
//   `GoalContractStorePort` that carries only the function signatures would ship the *signatures but none of the
//   enforcement*: an illegal edge (EXECUTING→DONE skipping REVIEWING, resurrecting a terminal FAILED, a resume
//   to a non-captured state) would SILENTLY SUCCEED for any consumer with an imperfect adapter, an imperfect
//   migration, or a non-Postgres DB. (PLATFORM-EXTRACTION-CHALLENGE-2026-06-29 §"single most dangerous coupling".)
//
//   This module is the portable, fail-closed mirror of that trigger — the governance analogue of the C11
//   engine's `templates/workflow-engine/state-machine.ts`. It is the APP-LEVEL guard; the 0053 DB trigger is the
//   owner-proof backstop (it fires for every role, even a raw SQL UPDATE). BOTH must agree on the SAME legal-edge
//   set — that equality is the invariant the golden-master cage (`golden-master.ts`) pins. Defense-in-depth: a
//   consumer is protected by the TS validator even before its DB trigger fires, AND off Postgres entirely.
//
//   This file imports NOTHING. It is pure, deterministic, DB-agnostic (the residency invariant).

// ── The 11 §4.3 PO-lifecycle states (mirrors goal_contract_state_chk in 0053) ──────────────────────────────
export const GOAL_STATES = [
  "CREATED", // contract drafted; not yet submitted
  "FEASIBILITY", // pre-flight: is the goal reachable?
  "ACTIVE", // admitted; the PO loop owns it
  "PLANNING", // a sprint is being planned
  "EXECUTING", // a sprint is running
  "REVIEWING", // work posted; completion adjudication
  "DONE", // TERMINAL — acceptance met
  "HALTED", // founder-gated junction (redirect / accept-lower-bar / kill)
  "FAILED", // TERMINAL — H1 budget cap tripped
  "SUSPENDED", // founder-freeze (prev_state captures the resume target)
  "CLOSED", // TERMINAL — founder killed it
] as const;
export type GoalState = (typeof GOAL_STATES)[number];

// Terminal states have NO outgoing edge (mirrors `OLD.state IN ('DONE','FAILED','CLOSED')` in 0053).
export const TERMINAL_GOAL_STATES: readonly GoalState[] = ["DONE", "FAILED", "CLOSED"];
export function isTerminalGoalState(s: GoalState): boolean {
  return TERMINAL_GOAL_STATES.includes(s);
}

// The states a SUSPENDED contract may resume INTO (mirrors goal_contract_prev_state_chk in 0053). A founder-
// freeze captures the prior state in prev_state; a resume targets exactly that captured state.
export const RESUMABLE_GOAL_STATES: readonly GoalState[] = [
  "CREATED",
  "FEASIBILITY",
  "ACTIVE",
  "PLANNING",
  "EXECUTING",
  "REVIEWING",
  "HALTED",
];

// ── The explicit FORWARD lifecycle edges (mirrors the enumerated branches in 0053) ─────────────────────────
// The three dynamic edge FAMILIES (→FAILED, →SUSPENDED, SUSPENDED→resume) are expressed as rules below, NOT in
// this table, because their legality depends on context (prev_state) — exactly as the trigger expresses them.
export const FORWARD_GOAL_EDGES: ReadonlyArray<readonly [GoalState, GoalState]> = [
  ["CREATED", "FEASIBILITY"], // submit / contract-drafted
  ["FEASIBILITY", "ACTIVE"], // pre-flight: reachable
  ["FEASIBILITY", "HALTED"], // pre-flight: unreachable
  ["ACTIVE", "PLANNING"], // tick / no-open-sprint
  ["PLANNING", "EXECUTING"], // sprint planned
  ["EXECUTING", "REVIEWING"], // all work posted | GS early-trip
  ["REVIEWING", "DONE"], // acceptance met
  ["REVIEWING", "PLANNING"], // incomplete but reachable → re-plan
  ["REVIEWING", "HALTED"], // unreachable → founder junction
  ["HALTED", "PLANNING"], // founder: redirect
  ["HALTED", "REVIEWING"], // founder: accept lower bar
  ["HALTED", "CLOSED"], // founder: kill
];

const FORWARD_EDGE_SET = new Set(FORWARD_GOAL_EDGES.map(([a, b]) => `${a}->${b}`));

/**
 * The context a transition validation may need. Only `prevState` is load-bearing — it is required to validate a
 * SUSPENDED→resume edge (the resume target MUST equal the captured prev_state), mirroring the trigger's
 * `OLD.state = 'SUSPENDED' AND NEW.state = OLD.prev_state` guard.
 */
export interface GoalTransitionContext {
  /** the contract's CURRENT prev_state (OLD.prev_state) — the captured resume target when SUSPENDED. */
  prevState?: GoalState | null;
}

/**
 * Compute the prev_state to WRITE on a transition (NEW.prev_state), mirroring goal-contract.ts bookkeeping:
 *   * → SUSPENDED          → capture the current state as the resume target.
 *   * SUSPENDED → (resume) → clear the marker (NULL).
 *   * otherwise            → preserve the current prev_state unchanged.
 * Exported so a store adapter and the validator share ONE bookkeeping rule (no drift).
 */
export function computeNextPrevState(
  from: GoalState,
  to: GoalState,
  currentPrev: GoalState | null,
): GoalState | null {
  if (to === "SUSPENDED") return from; // capture resume target
  if (from === "SUSPENDED") return null; // resuming — clear marker
  return currentPrev; // unchanged
}

// ── The fail-closed validator (the portable mirror of the 0053 trigger's allowed transitions) ──────────────
/**
 * Is `from -> to` a LEGAL §4.3 transition? Fail-closed: any edge not explicitly permitted is REFUSED. Mirrors
 * `goal_contract_state_machine_guard` branch-for-branch:
 *   1. A same-state write (from === to) is allowed (an updated_at touch / metadata amendment — not a state change).
 *   2. A terminal state (DONE/FAILED/CLOSED) has NO outgoing CHANGE edge.
 *   3. ANY non-terminal → FAILED (the H1 cap tripped).
 *   4. ANY non-terminal (not already SUSPENDED) → SUSPENDED (founder-freeze; prev_state captures the resume target).
 *   5. SUSPENDED → its captured prev_state (founder-resume) — requires ctx.prevState === to.
 *   6. The enumerated forward lifecycle edges (FORWARD_GOAL_EDGES).
 */
export function isLegalGoalTransition(from: GoalState, to: GoalState, ctx: GoalTransitionContext = {}): boolean {
  // (1) same-state write — allowed (no-op metadata write; not a state CHANGE).
  if (from === to) return true;

  // (2) terminal states have no outgoing change edge.
  if (isTerminalGoalState(from)) return false;

  // (3) ANY non-terminal → FAILED.
  if (to === "FAILED") return true;

  // (4) ANY non-terminal (not already SUSPENDED) → SUSPENDED.
  if (to === "SUSPENDED") return from !== "SUSPENDED";

  // (5) SUSPENDED → the captured prev_state (resume). The resume target MUST equal the captured prev_state.
  if (from === "SUSPENDED") {
    return ctx.prevState != null && to === ctx.prevState && RESUMABLE_GOAL_STATES.includes(to);
  }

  // (6) the enumerated forward lifecycle.
  return FORWARD_EDGE_SET.has(`${from}->${to}`);
}

/** Fail-closed assert — throws IllegalGoalTransitionError on any illegal edge (the organ never advances one). */
export function assertLegalGoalTransition(from: GoalState, to: GoalState, ctx: GoalTransitionContext = {}): void {
  if (!isLegalGoalTransition(from, to, ctx)) {
    throw new IllegalGoalTransitionError(from, to, ctx.prevState ?? null);
  }
}

export class IllegalGoalTransitionError extends Error {
  readonly from: GoalState;
  readonly to: GoalState;
  readonly prevState: GoalState | null;
  constructor(from: GoalState, to: GoalState, prevState: GoalState | null) {
    super(
      `illegal goal_contract transition ${from} -> ${to}` +
        (prevState ? ` (prev_state=${prevState})` : "") +
        ` (fail-closed; not a §4.3 legal edge — mirrors the 0053 state-machine trigger)`,
    );
    this.name = "IllegalGoalTransitionError";
    this.from = from;
    this.to = to;
    this.prevState = prevState;
  }
}

// ── Concrete edge ENUMERATION (the cage compares THIS set against the parsed trigger) ──────────────────────
/**
 * Enumerate EVERY concrete legal state-CHANGE edge (from !== to) that CAN be legal under SOME context — i.e.
 * the structural edge set, ignoring the prev_state guard predicate (the resume edges are enumerated against the
 * RESUMABLE_GOAL_STATES universe, which is exactly what prev_state may hold). This is the set the golden-master
 * cage pins byte-for-byte against the parsed 0053 trigger. Same-state self-writes are excluded (the trigger
 * permits them via its `NEW.state = OLD.state => RETURN NEW` branch — a write, not a graph edge).
 */
export function enumerateLegalGoalEdges(): Array<[GoalState, GoalState]> {
  const edges = new Set<string>();
  const nonTerminal = GOAL_STATES.filter((s) => !isTerminalGoalState(s));

  // (3) ANY non-terminal → FAILED.
  for (const from of nonTerminal) edges.add(`${from}->FAILED`);

  // (4) ANY non-terminal (≠ SUSPENDED) → SUSPENDED.
  for (const from of nonTerminal) if (from !== "SUSPENDED") edges.add(`${from}->SUSPENDED`);

  // (5) SUSPENDED → each resumable state.
  for (const to of RESUMABLE_GOAL_STATES) edges.add(`SUSPENDED->${to}`);

  // (6) the enumerated forward lifecycle.
  for (const [a, b] of FORWARD_GOAL_EDGES) edges.add(`${a}->${b}`);

  return [...edges].map((e) => e.split("->") as [GoalState, GoalState]);
}
