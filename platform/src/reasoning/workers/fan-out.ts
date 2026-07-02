// =============================================================================
// FAN-OUT — breadth for REPO_ANALYSIS + a synthesize seam (Frozen §10.3, roadmap G-60).
// =============================================================================
// A single REPO_ANALYSIS question is often answered by MANY readers in parallel — one worker per area — whose
// findings are then SYNTHESIZED by a follow-up CODE/INVESTIGATE worker. This helper runs the breadth with
// bounded concurrency (never a stampede) and is tolerant of partial failure: a sub-job that fails becomes
// `null` in the result array at its index, and the fan-out as a WHOLE still returns — one dead reader must not
// sink the batch. The caller decides whether the surviving readers are enough to synthesize.
//
// Every sub-job runs through executeWorker, so it inherits the full guard rails (budget, timeout, worktree
// isolation + cleanup, idempotency). The concurrency here is a SECOND, batch-level cap layered over any pool.

import { executeWorker, mapBounded, type BudgetLedger, type WorkerPool } from "./worker-executor.js";
import type { SpawnPort, WorkerJob, WorkerResult } from "./spawn-port.js";
import type { WorktreeManager } from "./worktree.js";

export interface FanOutOptions {
  readonly spawnPort: SpawnPort;
  /** Max sub-jobs in flight at once for THIS fan-out batch. */
  readonly maxConcurrent: number;
  readonly budgetLedger?: BudgetLedger;
  readonly worktree?: WorktreeManager;
  /** Optional shared pool (adds workerId idempotency + a global concurrency cap across batches). */
  readonly pool?: WorkerPool;
  readonly now?: () => number;
}

/**
 * Run many worker jobs with bounded concurrency, order-preserving. A sub-job that FAILS (`ok:false`) or throws
 * lands as `null` at its index — the batch never fails as a whole. Returns one slot per input job.
 */
export async function fanOut(jobs: readonly WorkerJob[], opts: FanOutOptions): Promise<(WorkerResult | null)[]> {
  const exec = { spawnPort: opts.spawnPort, budgetLedger: opts.budgetLedger, worktree: opts.worktree, pool: opts.pool, now: opts.now };
  return mapBounded(jobs, opts.maxConcurrent, async (job) => {
    try {
      const r = await executeWorker(job, exec);
      return r.ok ? r : null; // partial-failure tolerance: a failed reader → null, batch survives
    } catch {
      return null;
    }
  });
}

export interface FanOutSynthesizeOptions extends FanOutOptions {
  /**
   * The SYNTHESIZE seam: build the follow-up job (a CODE/INVESTIGATE worker) from the fan-out results. The
   * caller decides how to fold the surviving (non-null) readers into the synthesis task. Return `null` to
   * SKIP synthesis (e.g. too few readers survived) — fail-closed, no fabricated synthesis.
   */
  readonly synthesize: (results: (WorkerResult | null)[]) => WorkerJob | null;
}

/** The result of a fan-out-then-synthesize: the breadth results plus the (optional) synthesis outcome. */
export interface FanOutSynthesizeResult {
  readonly fanOut: (WorkerResult | null)[];
  /** The synthesis worker's result, or `null` if the seam chose to skip synthesis. */
  readonly synthesis: WorkerResult | null;
}

/**
 * Fan out the readers, then run the follow-up synthesis worker the `synthesize` seam builds from their
 * results. The synthesis job runs through executeWorker too (same guard rails). If the seam returns null,
 * synthesis is skipped and `synthesis` is null — the breadth results are still returned.
 */
export async function fanOutAndSynthesize(jobs: readonly WorkerJob[], opts: FanOutSynthesizeOptions): Promise<FanOutSynthesizeResult> {
  const results = await fanOut(jobs, opts);
  const synthJob = opts.synthesize(results);
  if (!synthJob) return { fanOut: results, synthesis: null };
  const synthesis = await executeWorker(synthJob, {
    spawnPort: opts.spawnPort,
    budgetLedger: opts.budgetLedger,
    worktree: opts.worktree,
    pool: opts.pool,
    now: opts.now,
  });
  return { fanOut: results, synthesis };
}
