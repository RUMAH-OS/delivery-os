// =============================================================================
// WORKER EXECUTOR — the guard rails around a P4 spawned session (Frozen §10.3, roadmap G-60).
// =============================================================================
// The SpawnPort knows how to run one deep-reasoning session. The EXECUTOR is the disciplined shell around it
// that makes the tier safe to run unattended. It enforces, fail-closed, five properties the raw port does not:
//
//   1. BUDGET      — a job that would exceed the remaining token budget is REFUSED before any spawn. Fail-closed:
//                    no session is launched, no output is invented; the successful session's usage is then
//                    charged against the ledger.
//   2. TIMEOUT     — the job is raced against its wall-clock cap. On overrun the executor returns a timeout
//                    error and RETURNS (never hangs); the underlying process is killed by the port's spawn
//                    timeout, and any late rejection is swallowed.
//   3. ISOLATION   — when a WorktreeManager is injected, the executor owns the worktree lifecycle: it creates an
//                    isolated worktree before the spawn and destroys it in a `finally`, so a failed/timed-out
//                    job leaks NO worktree. (The real ClaudeCliSpawnPort also self-isolates when used standalone;
//                    this seam lets the guarantee live — and be observed — at the executor layer.)
//   4. IDEMPOTENCY — keyed by workerId. Through a WorkerPool, a repeated or still-in-flight workerId returns the
//                    SAME result instead of re-spawning.
//   5. CONCURRENCY — a WorkerPool caps how many sessions run at once (a small pool), so fan-out cannot stampede.
//
// On ANY failure the executor returns `{ ok:false, error }` — it never fabricates output (honesty invariant).

import type { SpawnPort, WorkerJob, WorkerResult } from "./spawn-port.js";
import type { WorktreeHandle, WorktreeManager } from "./worktree.js";

/**
 * A token budget the executor charges against. `remaining()` is checked BEFORE a spawn (fail-closed refusal);
 * `charge(tokensUsed)` is applied AFTER a successful session. An in-memory implementation is provided below;
 * production can back it with a durable ledger.
 */
export interface BudgetLedger {
  remaining(): number;
  charge(tokensUsed: number): void;
}

/** A simple process-local budget ledger. Not durable — a real deployment swaps in a persisted one. */
export class InMemoryBudgetLedger implements BudgetLedger {
  private used = 0;
  constructor(private readonly total: number) {}
  remaining(): number {
    return Math.max(0, this.total - this.used);
  }
  charge(tokensUsed: number): void {
    if (tokensUsed > 0) this.used += tokensUsed;
  }
}

export interface ExecuteWorkerOptions {
  /** The spawn port that actually runs the session (real ClaudeCliSpawnPort or a test StubSpawnPort). */
  readonly spawnPort: SpawnPort;
  /** Optional budget the job is checked against (fail-closed) and charged to on success. */
  readonly budgetLedger?: BudgetLedger;
  /** Optional worktree manager. When set AND the job has a repoPath, the executor isolates + cleans up. */
  readonly worktree?: WorktreeManager;
  /** Optional pool providing concurrency cap + workerId idempotency across calls. */
  readonly pool?: WorkerPool;
  /** Wall-clock timeout override (ms); default = job.timeoutMs. */
  readonly timeoutMs?: number;
  /** Clock seam for deterministic ms measurement in tests; default Date.now. */
  readonly now?: () => number;
}

const TIMEOUT = Symbol("worker-timeout");

/**
 * Execute ONE worker job under the executor's guarantees. Never throws — every failure path (over-budget,
 * timeout, spawn error, worktree error) returns a fail-closed `{ ok:false, error }`.
 */
export function executeWorker(job: WorkerJob, opts: ExecuteWorkerOptions): Promise<WorkerResult> {
  const run = () => runOnce(job, opts);
  // Idempotency + concurrency are pool concerns; without a pool each call runs directly.
  return opts.pool ? opts.pool.run(job, run) : run();
}

async function runOnce(job: WorkerJob, opts: ExecuteWorkerOptions): Promise<WorkerResult> {
  const now = opts.now ?? Date.now;
  const started = now();

  // (1) BUDGET — fail-closed refusal BEFORE any spawn or worktree creation.
  if (opts.budgetLedger) {
    const remaining = opts.budgetLedger.remaining();
    if (job.budgetTokens > remaining) {
      return {
        ok: false,
        tokensUsed: 0,
        ms: now() - started,
        error: `budget_exceeded: job needs ${job.budgetTokens} > remaining ${remaining}`,
      };
    }
  }

  // (3) ISOLATION — create the sandbox (only after the budget check passed).
  let handle: WorktreeHandle | undefined;
  try {
    let effectiveJob = job;
    if (opts.worktree && job.repoPath) {
      try {
        handle = await opts.worktree.create(job.repoPath, job.workerId);
        effectiveJob = { ...job, repoPath: handle.path };
      } catch (e) {
        return { ok: false, tokensUsed: 0, ms: now() - started, error: `worktree_create_failed: ${msg(e)}` };
      }
    }

    // (2) TIMEOUT — race the spawn against the wall-clock cap. A never-resolving session cannot hang us.
    const timeoutMs = opts.timeoutMs ?? job.timeoutMs;
    const spawnP = opts.spawnPort.spawn(effectiveJob);
    spawnP.catch(() => {}); // swallow a late rejection after a timeout so it is never unhandled
    const raced = await raceTimeout(spawnP, timeoutMs);
    if (raced === TIMEOUT) {
      return { ok: false, tokensUsed: 0, ms: now() - started, error: `timeout_exceeded: ${timeoutMs}ms` };
    }

    // (1) BUDGET — charge the actual usage of a successful session.
    if (raced.ok && opts.budgetLedger) opts.budgetLedger.charge(raced.tokensUsed);
    return raced;
  } catch (e) {
    // Defensive: the port contract returns fail-closed, but a throw must still not leak or fabricate.
    return { ok: false, tokensUsed: 0, ms: now() - started, error: `executor_error: ${msg(e)}` };
  } finally {
    // (3) ISOLATION — destroy the sandbox even on failure / timeout. Cleanup never masks the result.
    if (handle && opts.worktree) await opts.worktree.cleanup(handle).catch(() => {});
  }
}

/** Race a promise against a timeout without leaking a timer. Returns TIMEOUT sentinel on overrun. */
function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// =============================================================================
// WORKER POOL — concurrency cap + workerId idempotency across executeWorker calls.
// =============================================================================

export interface WorkerPoolOptions {
  /** Max sessions in flight at once (a small pool). Default 4. */
  readonly maxConcurrent?: number;
}

/**
 * Holds the two cross-call guarantees: a semaphore (concurrency cap) and a workerId map (idempotency). A
 * repeated or in-flight workerId short-circuits to the SAME result — the session is never spawned twice.
 */
export class WorkerPool {
  private readonly sem: Semaphore;
  private readonly inflight = new Map<string, Promise<WorkerResult>>();
  private readonly done = new Map<string, WorkerResult>();

  constructor(opts: WorkerPoolOptions = {}) {
    this.sem = new Semaphore(Math.max(1, opts.maxConcurrent ?? 4));
  }

  run(job: WorkerJob, task: () => Promise<WorkerResult>): Promise<WorkerResult> {
    const cached = this.done.get(job.workerId);
    if (cached) return Promise.resolve(cached); // idempotent replay of a completed job
    const existing = this.inflight.get(job.workerId);
    if (existing) return existing; // idempotent join of an in-flight job

    const p = this.sem
      .run(task)
      .then((r) => {
        this.done.set(job.workerId, r);
        this.inflight.delete(job.workerId);
        return r;
      })
      .catch((e) => {
        this.inflight.delete(job.workerId);
        throw e;
      });
    this.inflight.set(job.workerId, p);
    return p;
  }
}

/** A minimal counting semaphore: at most `max` tasks run concurrently; the rest queue FIFO. */
class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly max: number) {}
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

/**
 * Run `fn` over `items` with at most `max` in flight, preserving input order in the output. Shared by the
 * fan-out helper; kept here next to the pool so all bounded-concurrency logic lives in one module.
 */
export async function mapBounded<A, B>(items: readonly A[], max: number, fn: (item: A, index: number) => Promise<B>): Promise<B[]> {
  const results = new Array<B>(items.length);
  const width = Math.max(1, Math.min(max, items.length));
  let next = 0;
  const runner = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as A, i);
    }
  };
  await Promise.all(Array.from({ length: width }, runner));
  return results;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
