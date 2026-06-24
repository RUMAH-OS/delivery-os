// INDEPENDENT QA probe (author != verifier, Delivery OS Sec.3/Sec.12) — written by the verifying QA, NOT the slice author.
// Purpose: empirically disprove the "rubber-stamp" hypothesis for the C2 T1 verifier (demo.agent-result-verifier).
// It directly invokes the verifier's verify() against inputs that have NO valid recorded agent result and asserts it
// returns verdict==='fail'. It does NOT touch impl; it only exercises the SHIPPED verifier as a black box.
//
// Run from examples/engine-demo-app:  npx tsx tests/verifier-rigor.probe.ts   (requires the throwaway DB up + migrated)

import { randomUUID } from "node:crypto";
import { db, sql } from "../src/engine-app/db.js";
import { workflowRun, workflowStep } from "../src/engine-app/tables.js";
import { DEMO_AGENT_PACK, AGENT_RESULT_SEQ } from "../src/demo-pack/demo-agent.js";

const verifier = DEMO_AGENT_PACK.verifiers!.find((v) => v.id === "demo.agent-result-verifier")!;

let pass = true;
function check(label: string, ok: boolean, detail: string): void {
  console.log(`PROBE ${label.padEnd(54)} -> ${ok ? "PASS" : "FAIL"} (${detail})`);
  if (!ok) pass = false;
}

async function main(): Promise<void> {
  // (1) candidate with NO runId at all -> must fail (no_run_ref_in_candidate). A rubber-stamp would pass.
  const r1 = await verifier.verify({ tx: db as never, candidate: {} as never, attempt: 0 });
  check("no runId in candidate", r1.verdict === "fail", `verdict=${r1.verdict} reasons=${JSON.stringify(r1.reasons)}`);

  // (2) candidate pointing at a NON-EXISTENT run -> no seq-1 row -> must fail (agent_result_step_missing).
  const r2 = await verifier.verify({ tx: db as never, candidate: { runId: randomUUID() } as never, attempt: 0 });
  check("non-existent run (no agent-result row)", r2.verdict === "fail", `verdict=${r2.verdict} reasons=${JSON.stringify(r2.reasons)}`);

  // (3) a run that DID reach the agent-result step but where NO agent ran: seq-1 has the dispatch payload only
  //     (no producedBy marker) and agent_id is NULL. This is exactly the "no agent result" state. Must fail.
  //     We fabricate the minimal rows directly (this is a verifier black-box probe, not an engine run).
  const runId = randomUUID();
  await db.insert(workflowRun).values({ id: runId, definitionKey: "demo-agent", state: "executing", input: {}, idempotencyKey: `probe-${runId}` } as never);
  await db.insert(workflowStep).values({
    runId, seq: AGENT_RESULT_SEQ, stepType: "demo.agent-await-result", owner: "engine-demo-app",
    handler: "demo-agent.await-result", effect: "await-callback", state: "blocked",
    result: { dispatched: true, task: { goal: "produce-demo-artifact" } }, // dispatch payload — NO producedBy marker
    agentId: null, // NO agent recorded
  } as never);
  const r3 = await verifier.verify({ tx: db as never, candidate: { runId } as never, attempt: 0 });
  const r3marker = (r3.reasons ?? []).includes("agent_result_marker_missing");
  const r3agent = (r3.reasons ?? []).includes("agent_id_not_recorded");
  check("blocked agent-result, no agent ran", r3.verdict === "fail" && r3marker && r3agent, `verdict=${r3.verdict} reasons=${JSON.stringify(r3.reasons)}`);

  // (4) POSITIVE control: same row but with the marker + recorded agent_id -> must PASS (proves it is not a NO-op fail).
  await db.update(workflowStep)
    .set({ result: { producedBy: "demo-agent-sim", value: "ok" }, agentId: "demo-agent" } as never)
    .where((await import("drizzle-orm")).and((await import("drizzle-orm")).eq(workflowStep.runId, runId), (await import("drizzle-orm")).eq(workflowStep.seq, AGENT_RESULT_SEQ)));
  const r4 = await verifier.verify({ tx: db as never, candidate: { runId } as never, attempt: 0 });
  check("recorded marker + agent_id (positive control)", r4.verdict === "pass", `verdict=${r4.verdict} reasons=${JSON.stringify(r4.reasons)}`);

  console.log(`\nVERIFIER-RIGOR PROBE: ${pass ? "PASS — verifier discriminates (NOT a rubber-stamp)" : "FAIL — verifier did not discriminate"}`);
  await sql.end();
  process.exit(pass ? 0 : 1);
}

main().catch(async (e) => { console.error("probe FAILED", e); try { await sql.end(); } catch { /* noop */ } process.exit(1); });
