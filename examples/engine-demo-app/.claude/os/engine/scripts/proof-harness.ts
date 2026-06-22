// Workflow Engine — the GENERIC proof harness MECHANISM (travels with the engine; fixtures stay in the app).
// The Slice-0 / Slice-1 proofs are domain-specific (they need an app's seed data + an app's verifier). What
// is GENERIC — and therefore lives here — is the harness scaffolding: the assert counter, the tick-driver
// loops, and the run/step readers expressed over an injected EngineContext + Engine. An app's proof script
// imports these, supplies its own fixtures (seed rows) + its own registered definitions, and asserts its
// domain post-conditions. The engine carries ZERO domain knowledge.

import type { Engine, EngineContext } from "../engine.js";

export interface ProofHarness {
  fails: number;
  assert(name: string, cond: boolean, detail?: string): void;
  // run/step readers over the injected ctx (raw SQL kept in the app; these use the drizzle client).
  runState(runId: string): Promise<string>;
  // drive the engine to quiescence; fast-forwards any backoff so a proof never wall-clock-waits.
  driveToQuiescent(maxTicks?: number): Promise<string[]>;
}

export interface HarnessDeps {
  ctx: EngineContext;
  engine: Engine;
  // an app-supplied "fast-forward due retries" hook (raw SQL over the app's throwaway DB). Returns the
  // number of rows it bumped; 0 means genuinely nothing left to do. Optional — omit to skip fast-forward.
  fastForwardBackoff?: () => Promise<number>;
}

export function createProofHarness(deps: HarnessDeps): ProofHarness {
  const { ctx, engine } = deps;
  const { db } = ctx;
  const { workflowRun } = ctx.tables;

  const h: ProofHarness = {
    fails: 0,
    assert(name: string, cond: boolean, detail = ""): void {
      // eslint-disable-next-line no-console
      console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
      if (!cond) h.fails++;
    },
    async runState(runId: string): Promise<string> {
      const { eq } = await import("drizzle-orm");
      const [r] = await db.select({ state: workflowRun.state }).from(workflowRun).where(eq(workflowRun.id, runId)).limit(1);
      return (r?.state ?? "unknown") as string;
    },
    async driveToQuiescent(maxTicks = 60): Promise<string[]> {
      const log: string[] = [];
      for (let i = 0; i < maxTicks; i++) {
        const r = await engine.tick();
        if (!r.advanced) {
          if (deps.fastForwardBackoff) {
            const n = await deps.fastForwardBackoff();
            if (n === 0) break;
            continue;
          }
          break;
        }
        log.push(`${r.from ?? "-"} -> ${r.to ?? "-"} : ${r.detail ?? ""}`);
      }
      return log;
    },
  };
  return h;
}
