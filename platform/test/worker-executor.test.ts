// =============================================================================
// WORKER EXECUTOR PROOF (P4 slice 9, roadmap G-60 realWorkerQueueSpawn).
// =============================================================================
// Proves the P4 deep-reasoning executor's guard rails END-TO-END for free — with the StubSpawnPort ONLY: no
// real process spawn, no network, no real git worktree. The REAL ClaudeCliSpawnPort is untested BY DESIGN
// (live spawning is a wiring/ops step, gated on `claude`+git+a provisioned model). What is proven here:
//   (a) BUDGET      — an over-budget job is refused fail-closed BEFORE any spawn (the port is never called);
//                     a successful session's usage is charged against the ledger.
//   (b) TIMEOUT     — a session that never resolves yields a timeout error and RETURNS (it does not hang).
//   (c) ISOLATION   — the injected worktree manager's cleanup runs even when the job FAILS or TIMES OUT (spy).
//   (d) IDEMPOTENCY — a repeated/in-flight workerId returns the same result; the port spawns exactly once.
//   (e) CONCURRENCY — a WorkerPool caps how many sessions run at once.

import { describe, it, expect, vi } from "vitest";
import {
  executeWorker,
  WorkerPool,
  InMemoryBudgetLedger,
  type BudgetLedger,
} from "../src/reasoning/workers/worker-executor.js";
import { StubSpawnPort, cannedOk, type WorkerJob, type WorkerResult } from "../src/reasoning/workers/spawn-port.js";
import type { WorktreeManager, WorktreeHandle } from "../src/reasoning/workers/worktree.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────────────────────────────

function job(over: Partial<WorkerJob> = {}): WorkerJob {
  return {
    class: "REPO_ANALYSIS",
    task: "read the repo",
    budgetTokens: 100,
    timeoutMs: 1_000,
    workerId: "w-1",
    ...over,
  };
}

/** An in-memory worktree manager with create/cleanup spies — NEVER touches real git. */
function fakeWorktree(): { mgr: WorktreeManager; create: ReturnType<typeof vi.fn>; cleanup: ReturnType<typeof vi.fn> } {
  const create = vi.fn(async (repoPath: string, workerId: string): Promise<WorktreeHandle> => ({
    path: `/tmp/fake-wt/${workerId}`,
    repoPath,
    workerId,
    scratchDir: `/tmp/fake-wt`,
  }));
  const cleanup = vi.fn(async (_h: WorktreeHandle) => {});
  return { mgr: { create, cleanup }, create, cleanup };
}

const NEVER: () => Promise<WorkerResult> = () => new Promise<WorkerResult>(() => {}); // never resolves

// ── (a) BUDGET ────────────────────────────────────────────────────────────────────────────────────────

describe("worker-executor — budget (fail-closed)", () => {
  it("refuses an over-budget job WITHOUT spawning", async () => {
    const port = new StubSpawnPort(cannedOk("should not run"));
    const ledger = new InMemoryBudgetLedger(50); // remaining 50 < job needs 100
    const r = await executeWorker(job({ budgetTokens: 100 }), { spawnPort: port, budgetLedger: ledger });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/budget_exceeded/);
    expect(port.calls).toHaveLength(0); // NO spawn happened
  });

  it("charges actual usage against the ledger on success", async () => {
    const port = new StubSpawnPort(() => ({ ok: true, output: "done", tokensUsed: 30, ms: 5 }));
    const ledger = new InMemoryBudgetLedger(100);
    const r = await executeWorker(job({ budgetTokens: 40 }), { spawnPort: port, budgetLedger: ledger });
    expect(r.ok).toBe(true);
    expect(ledger.remaining()).toBe(70); // 100 - 30 charged
  });

  it("allows a job exactly at the remaining budget", async () => {
    const port = new StubSpawnPort(cannedOk("ok"));
    const ledger = new InMemoryBudgetLedger(100);
    const r = await executeWorker(job({ budgetTokens: 100 }), { spawnPort: port, budgetLedger: ledger });
    expect(r.ok).toBe(true);
    expect(port.calls).toHaveLength(1);
  });
});

// ── (b) TIMEOUT ───────────────────────────────────────────────────────────────────────────────────────

describe("worker-executor — timeout (never hangs)", () => {
  it("returns a timeout error when the session never resolves", async () => {
    const port = new StubSpawnPort(NEVER);
    const r = await executeWorker(job(), { spawnPort: port, timeoutMs: 15 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timeout_exceeded/);
  });

  it("uses job.timeoutMs when no override is given", async () => {
    const port = new StubSpawnPort(NEVER);
    const r = await executeWorker(job({ timeoutMs: 15 }), { spawnPort: port });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timeout_exceeded: 15ms/);
  });
});

// ── (c) ISOLATION — worktree cleanup even on failure ────────────────────────────────────────────────────

describe("worker-executor — worktree isolation + cleanup", () => {
  it("creates then cleans up the worktree on SUCCESS, passing the sandbox path to the port", async () => {
    const wt = fakeWorktree();
    let seenRepoPath: string | undefined;
    const port = new StubSpawnPort((j) => {
      seenRepoPath = j.repoPath;
      return { ok: true, output: "ok", tokensUsed: 1, ms: 1 };
    });
    await executeWorker(job({ repoPath: "/repo", workerId: "wt-ok" }), { spawnPort: port, worktree: wt.mgr });
    expect(wt.create).toHaveBeenCalledOnce();
    expect(wt.cleanup).toHaveBeenCalledOnce();
    expect(seenRepoPath).toBe("/tmp/fake-wt/wt-ok"); // the port ran in the sandbox, not /repo
  });

  it("cleans up the worktree even when the session FAILS", async () => {
    const wt = fakeWorktree();
    const port = new StubSpawnPort(() => ({ ok: false, tokensUsed: 0, ms: 1, error: "boom" }));
    const r = await executeWorker(job({ repoPath: "/repo", workerId: "wt-fail" }), { spawnPort: port, worktree: wt.mgr });
    expect(r.ok).toBe(false);
    expect(wt.cleanup).toHaveBeenCalledOnce(); // no leaked worktree on failure
  });

  it("cleans up the worktree even when the session TIMES OUT", async () => {
    const wt = fakeWorktree();
    const port = new StubSpawnPort(NEVER);
    const r = await executeWorker(job({ repoPath: "/repo", workerId: "wt-timeout" }), { spawnPort: port, worktree: wt.mgr, timeoutMs: 15 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timeout_exceeded/);
    // cleanup runs in the finally after the timeout returns.
    expect(wt.cleanup).toHaveBeenCalledOnce();
  });

  it("does NOT create a worktree for an over-budget job (refused before isolation)", async () => {
    const wt = fakeWorktree();
    const port = new StubSpawnPort(cannedOk("x"));
    const ledger: BudgetLedger = new InMemoryBudgetLedger(10);
    const r = await executeWorker(job({ repoPath: "/repo", budgetTokens: 100 }), { spawnPort: port, worktree: wt.mgr, budgetLedger: ledger });
    expect(r.ok).toBe(false);
    expect(wt.create).not.toHaveBeenCalled();
    expect(wt.cleanup).not.toHaveBeenCalled();
  });
});

// ── (d) IDEMPOTENCY ───────────────────────────────────────────────────────────────────────────────────

describe("worker-executor — idempotency by workerId", () => {
  it("replays the same result for a repeated workerId without re-spawning", async () => {
    let spawns = 0;
    const port = new StubSpawnPort(() => {
      spawns++;
      return { ok: true, output: `run-${spawns}`, tokensUsed: 1, ms: 1 };
    });
    const pool = new WorkerPool({ maxConcurrent: 4 });
    const r1 = await executeWorker(job({ workerId: "same" }), { spawnPort: port, pool });
    const r2 = await executeWorker(job({ workerId: "same" }), { spawnPort: port, pool });
    expect(spawns).toBe(1);
    expect(r1.output).toBe("run-1");
    expect(r2.output).toBe("run-1"); // same cached result
  });

  it("joins an in-flight workerId instead of spawning twice", async () => {
    let spawns = 0;
    let release!: (r: WorkerResult) => void;
    const port = new StubSpawnPort(() => {
      spawns++;
      return new Promise<WorkerResult>((res) => (release = res));
    });
    const pool = new WorkerPool();
    const p1 = executeWorker(job({ workerId: "join" }), { spawnPort: port, pool });
    const p2 = executeWorker(job({ workerId: "join" }), { spawnPort: port, pool });
    release({ ok: true, output: "shared", tokensUsed: 1, ms: 1 });
    const [a, b] = await Promise.all([p1, p2]);
    expect(spawns).toBe(1);
    expect(a.output).toBe("shared");
    expect(b.output).toBe("shared");
  });
});

// ── (e) CONCURRENCY ───────────────────────────────────────────────────────────────────────────────────

describe("worker-executor — concurrency cap via WorkerPool", () => {
  it("never runs more than maxConcurrent sessions at once", async () => {
    let active = 0;
    let peak = 0;
    // Each session overlaps its peers by holding the slot for a tick; the semaphore is the only thing that
    // bounds how many run the behavior at once.
    const port = new StubSpawnPort(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { ok: true, output: "ok", tokensUsed: 1, ms: 1 };
    });
    const pool = new WorkerPool({ maxConcurrent: 2 });
    const jobs = Array.from({ length: 6 }, (_, i) => job({ workerId: `c-${i}` }));
    const results = await Promise.all(jobs.map((j) => executeWorker(j, { spawnPort: port, pool })));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(peak).toBeLessThanOrEqual(2); // never exceeded the cap
    expect(peak).toBeGreaterThan(1); // but did reach it (sessions genuinely overlapped)
  });
});
