// =============================================================================
// WORKER FAN-OUT PROOF (P4 slice 9, roadmap G-60 realWorkerQueueSpawn).
// =============================================================================
// Proves the REPO_ANALYSIS breadth helper with StubSpawnPort ONLY (no process spawn, no network, no real git):
//   (a) ORDER + RESULTS   — one output slot per input job, order-preserving.
//   (b) BOUNDED CONCURRENCY — never more than maxConcurrent readers run at once.
//   (c) PARTIAL FAILURE    — a failing (or throwing) reader becomes null; the batch still returns all others.
//   (d) SYNTHESIZE SEAM    — a follow-up worker consumes the surviving readers; returning null SKIPS synthesis.

import { describe, it, expect } from "vitest";
import { fanOut, fanOutAndSynthesize } from "../src/reasoning/workers/fan-out.js";
import { StubSpawnPort, type WorkerJob, type WorkerResult } from "../src/reasoning/workers/spawn-port.js";

function reader(id: string, over: Partial<WorkerJob> = {}): WorkerJob {
  return { class: "REPO_ANALYSIS", task: `read ${id}`, budgetTokens: 10, timeoutMs: 1_000, workerId: id, ...over };
}

// ── (a) ORDER + RESULTS ───────────────────────────────────────────────────────────────────────────────

describe("fan-out — results are order-preserving", () => {
  it("returns one slot per job, in input order", async () => {
    const port = new StubSpawnPort((j) => ({ ok: true, output: j.task, tokensUsed: 1, ms: 1 }));
    const jobs = ["a", "b", "c", "d"].map((id) => reader(id));
    const results = await fanOut(jobs, { spawnPort: port, maxConcurrent: 2 });
    expect(results.map((r) => r?.output)).toEqual(["read a", "read b", "read c", "read d"]);
  });
});

// ── (b) BOUNDED CONCURRENCY ───────────────────────────────────────────────────────────────────────────

describe("fan-out — bounded concurrency", () => {
  it("never runs more than maxConcurrent readers at once", async () => {
    let active = 0;
    let peak = 0;
    const port = new StubSpawnPort(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { ok: true, output: "ok", tokensUsed: 1, ms: 1 };
    });
    const jobs = Array.from({ length: 8 }, (_, i) => reader(`r-${i}`));
    await fanOut(jobs, { spawnPort: port, maxConcurrent: 3 });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });
});

// ── (c) PARTIAL FAILURE TOLERANCE ─────────────────────────────────────────────────────────────────────

describe("fan-out — partial-failure tolerance", () => {
  it("maps a failing reader to null and keeps the rest", async () => {
    const port = new StubSpawnPort((j): WorkerResult => (j.workerId === "bad" ? { ok: false, tokensUsed: 0, ms: 1, error: "boom" } : { ok: true, output: j.task, tokensUsed: 1, ms: 1 }));
    const jobs = [reader("ok1"), reader("bad"), reader("ok2")];
    const results = await fanOut(jobs, { spawnPort: port, maxConcurrent: 3 });
    expect(results[0]?.output).toBe("read ok1");
    expect(results[1]).toBeNull(); // the failed reader
    expect(results[2]?.output).toBe("read ok2");
  });

  it("maps a THROWING reader to null (the batch still returns)", async () => {
    const port = new StubSpawnPort((j) => {
      if (j.workerId === "throws") throw new Error("kaboom");
      return { ok: true, output: j.task, tokensUsed: 1, ms: 1 };
    });
    const jobs = [reader("ok"), reader("throws")];
    const results = await fanOut(jobs, { spawnPort: port, maxConcurrent: 2 });
    expect(results[0]?.output).toBe("read ok");
    expect(results[1]).toBeNull();
  });
});

// ── (d) SYNTHESIZE SEAM ───────────────────────────────────────────────────────────────────────────────

describe("fan-out — synthesize seam", () => {
  it("runs a follow-up worker over the surviving readers", async () => {
    const port = new StubSpawnPort((j) => {
      if (j.class === "CODE") {
        return { ok: true, output: `SYNTHESIS(${j.task})`, tokensUsed: 5, ms: 1 };
      }
      return j.workerId === "bad" ? { ok: false, tokensUsed: 0, ms: 1, error: "x" } : { ok: true, output: j.task, tokensUsed: 1, ms: 1 };
    });
    const jobs = [reader("f1"), reader("bad"), reader("f2")];
    const out = await fanOutAndSynthesize(jobs, {
      spawnPort: port,
      maxConcurrent: 3,
      synthesize: (results) => {
        const survived = results.filter((r): r is WorkerResult => r !== null).map((r) => r.output);
        return { class: "CODE", task: `merge:${survived.join(",")}`, budgetTokens: 20, timeoutMs: 1_000, workerId: "synth" };
      },
    });
    expect(out.fanOut[1]).toBeNull(); // the failed reader dropped
    expect(out.synthesis?.ok).toBe(true);
    expect(out.synthesis?.output).toBe("SYNTHESIS(merge:read f1,read f2)");
  });

  it("SKIPS synthesis (null) when the seam decides too few readers survived", async () => {
    const port = new StubSpawnPort(() => ({ ok: false, tokensUsed: 0, ms: 1, error: "all dead" }));
    const jobs = [reader("d1"), reader("d2")];
    const out = await fanOutAndSynthesize(jobs, {
      spawnPort: port,
      maxConcurrent: 2,
      synthesize: (results) => {
        const survived = results.filter((r) => r !== null);
        return survived.length >= 1 ? { class: "INVESTIGATE", task: "x", budgetTokens: 1, timeoutMs: 1, workerId: "s" } : null;
      },
    });
    expect(out.fanOut.every((r) => r === null)).toBe(true);
    expect(out.synthesis).toBeNull(); // fail-closed: no fabricated synthesis
    expect(port.calls.every((c) => c.class === "REPO_ANALYSIS")).toBe(true); // no synthesis job spawned
  });
});
