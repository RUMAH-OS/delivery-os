// =============================================================================
// Goal Supervisor (C7) — TYPE SURFACE ONLY (M1 re-home slice).
// =============================================================================
// The full Goal Supervisor organ (the no-progress watch, dEffort/dGoal computation, loop-fingerprint) stays
// in rumah-admin and MOVES to the OS runtime in M2 (see PLATFORM-HOME-EXTRACTION.md §4.2). The M1 boot slice
// vendors ONLY the reconciler (po-reconciler-c2.ts, the SOLE MUTATOR) which imports these TYPES from the GS.
// These declarations are copied VERBATIM from rumah-admin/src/goal-supervisor-c7.ts so the vendored reconciler
// type-checks byte-for-byte against the real shapes — no behavior lives here, only the contract the reconciler
// consumes (it reads gsVerdict.trip / .verdict / .details.currentValue; on a bare OS the verdict is null).
// =============================================================================

/** The GS verdict label. trip === (verdict === "HALT_AND_SUMMON"). */
export type GoalVerdict = "CONTINUE" | "HALT_AND_SUMMON";

/** One sample from the goal_delta_ledger (the GS's dGoal input — runtime-stores.readProgressSeries). */
export interface ProgressPoint {
  cycle: number;
  value: number | null;
  predicted?: number | null;
  fixRef?: string | null;
}

/** The structured acceptance {op,target,direction} (C2-MIND-derived; consumed by the GS / C6 / reconciler). */
export interface AcceptanceShape {
  op?: ">=" | "<=" | ">" | "<" | "==";
  target?: number;
  direction?: "increase" | "decrease";
}

/** The grace floor — the minimum spend before a stall may be judged at all (NOT just-started). */
export interface GraceFloor {
  minCycles: number;
  minAttempts: number;
  minEffortFraction: number;
  minCostCents: number;
}

/** dEffort breakdown — the MAX consumed-fraction across the present budget axes (the binding H1 pressure). */
export interface EffortBreakdown {
  fraction: number;
  byAxis: Record<string, { consumed: number; cap: number; fraction: number }>;
  attempts: number;
  cumulativeCostCents: number;
}

/** The loop-fingerprint (a repeated fixRef strengthens a stall verdict). */
export interface LoopFingerprint {
  repeated: boolean;
  fixRef: string | null;
  count: number;
}

/** The GS's drafted verdict — CONSUMED by the reconciler, never recomputed. */
export interface GoalSupervisionVerdict {
  goalId: string;
  /** trip === (verdict === "HALT_AND_SUMMON"). */
  trip: boolean;
  verdict: GoalVerdict;
  reason: string;
  /** the acceptance-metric movement over the window (null when uncomputable — itself a fail-closed signal). */
  dGoal: number | null;
  dEffort: EffortBreakdown;
  details: {
    startValue: number | null;
    currentValue: number | null;
    currentSource: string;
    observedCycles: number;
    pastGrace: boolean;
    progressConfirmed: boolean;
    effortSound: boolean;
    progressSound: boolean;
    dataUnreadable: boolean;
    fingerprint: LoopFingerprint;
    epsilon: number;
    epsilonClamped: boolean;
    graceFloor: GraceFloor;
  };
}
