// THE N=2 PROOF run script. A genuinely SEPARATE app drives ONE workflow through the INSTALLED engine, GREEN.
//   (1) migrate the throwaway DB (app applies the canonical engine DDL),
//   (2) enqueue("demo-ping", …) via the runtime composed by createCapabilityRuntime (the step-2 contract),
//   (3) drive tick()s to a fixed point,
//   (4) QUERY + PRINT the evidence (run.status, step states, the verify verdict, the outbox events),
//   (5) ASSERT run.state === completed AND the verify verdict === pass; exit non-zero otherwise.
// Imports ONLY the app's own code + the vendored engine. ZERO rumah-admin imports.

import { eq, asc } from "drizzle-orm";
import { db, sql } from "./src/engine-app/db.js";
import { workflowRun, workflowStep, outbox } from "./src/engine-app/tables.js";
import { enqueue, tick, enqueueKeys } from "./src/engine-app/runtime.js";
import { migrate } from "./scripts/migrate.js";

function line() { console.log("─".repeat(78)); }

async function main(): Promise<void> {
  line();
  console.log("ENGINE-DEMO-APP — N=2 platform proof (a 2nd app runs a workflow through the installed engine)");
  line();

  // (1) MIGRATE the throwaway plane.
  console.log("[1] migrate throwaway DB (app applies the canonical engine DDL per-plane):");
  await migrate();
  console.log(`    enqueue allow-list DERIVED from registered packs: [${enqueueKeys.join(", ")}]`);

  // (2) ENQUEUE one demo-ping run via the runtime composed by createCapabilityRuntime.
  console.log("\n[2] enqueue('demo-ping', …):");
  const { runId, created } = await enqueue("demo-ping", { who: "n2-proof" }, "demo-ping-n2-001");
  console.log(`    runId=${runId} created=${created}`);

  // (3) DRIVE tick()s to a fixed point (a trivial heartbeat loop; the engine advances ONE transition per tick).
  console.log("\n[3] drive tick()s (each advances ONE transition):");
  let ticks = 0;
  for (; ticks < 25; ticks++) {
    const r = await tick();
    if (r.advanced) console.log(`    tick ${ticks}: ${r.from ?? "-"} -> ${r.to ?? "-"}  (${r.detail ?? ""})`);
    // stop once the run is terminal AND no further tick advances anything.
    const [run] = await db.select({ state: workflowRun.state }).from(workflowRun).where(eq(workflowRun.id, runId)).limit(1);
    if (run && (run.state === "completed" || run.state === "failed" || run.state === "recovered") && !r.advanced) break;
  }

  // (4) QUERY + PRINT the evidence.
  line();
  console.log("EVIDENCE");
  line();
  const [run] = await db
    .select({ id: workflowRun.id, definitionKey: workflowRun.definitionKey, state: workflowRun.state, wasInterrupted: workflowRun.wasInterrupted, terminalAt: workflowRun.terminalAt })
    .from(workflowRun).where(eq(workflowRun.id, runId)).limit(1);
  console.log("run:", JSON.stringify(run));

  const steps = await db
    .select({ seq: workflowStep.seq, handler: workflowStep.handler, state: workflowStep.state, result: workflowStep.result, verdict: workflowStep.verdict })
    .from(workflowStep).where(eq(workflowStep.runId, runId)).orderBy(asc(workflowStep.seq));
  console.log("steps:");
  for (const s of steps) console.log("  ", JSON.stringify(s));

  const events = await db
    .select({ type: outbox.type, payload: outbox.payload })
    .from(outbox).where(eq(outbox.aggregateId, runId)).orderBy(asc(outbox.createdAt));
  console.log("outbox events (in order):");
  for (const e of events) console.log("  ", JSON.stringify(e));

  // (5) ASSERT the green conditions.
  line();
  const verifyStep = steps.find((s) => s.handler === "engine.verify");
  const verdict = (verifyStep?.verdict as { verdict?: string } | null)?.verdict;
  const completed = run?.state === "completed";
  const verifiedPass = verdict === "pass";
  const sawPing = events.some((e) => e.type === "demo.ping");
  const sawCompleted = events.some((e) => e.type === "workflow.run.completed");

  console.log(`ASSERT run.state === 'completed'          -> ${completed ? "PASS" : "FAIL"} (got '${run?.state}')`);
  console.log(`ASSERT verify verdict === 'pass'          -> ${verifiedPass ? "PASS" : "FAIL"} (got '${verdict}')`);
  console.log(`ASSERT outbox has 'demo.ping'             -> ${sawPing ? "PASS" : "FAIL"}`);
  console.log(`ASSERT outbox has 'workflow.run.completed'-> ${sawCompleted ? "PASS" : "FAIL"}`);
  line();

  const green = completed && verifiedPass && sawPing && sawCompleted;
  if (green) {
    console.log("RESULT: GREEN — a SECOND app ran a workflow through the INSTALLED Delivery OS engine.");
  } else {
    console.error("RESULT: RED — the demo workflow did not reach the green end state.");
  }
  await sql.end();
  process.exit(green ? 0 : 1);
}

main().catch(async (e) => {
  console.error("run-demo: FAILED", e);
  try { await sql.end(); } catch { /* noop */ }
  process.exit(1);
});
