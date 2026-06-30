// Governance Engine — self-test: the GoalContractStorePort lifecycle over the IN-MEMORY adapter.
//
// Proves three things the platform claim rests on:
//   (1) The TS validator accepts EVERY legal §4.3 edge and rejects EVERY illegal one (delegated to the cage's
//       enumeration so this stays in lock-step with the trigger parse).
//   (2) A FULL GoalContract lifecycle (CREATED→…→DONE, and a separate →HALTED→CLOSED, and a SUSPEND/resume)
//       runs end-to-end against an IN-MEMORY store — zero Postgres, proving the port is genuinely DB-agnostic.
//   (3) The portable enforcement is REAL: the in-memory adapter has NO trigger, so when the organ wraps it an
//       illegal edge is refused BY THE TS VALIDATOR alone — and the RAW (unwrapped) store would have let it
//       through. That gap is exactly the "signatures-but-no-enforcement" hazard this slice exists to close.
//
// Run:  tsx self-test.ts   ·   exit 0 = all proofs hold · exit 1 = a proof failed.

import { createGoalContractOrgan } from "../goal-contract.js";
import { createInMemoryGoalContractStore } from "./in-memory-store.js";
import {
  GOAL_STATES,
  enumerateLegalGoalEdges,
  isLegalGoalTransition,
  IllegalGoalTransitionError,
  type GoalState,
} from "../state-machine.js";
import type { CreateGoalContractInput } from "../ports.js";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`);
  else {
    console.error(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
    failures++;
  }
}

const SAMPLE: CreateGoalContractInput = {
  objective: "raise qualified-leads-count to 50/week",
  acceptanceMetric: "qualified-leads-count >= 50",
  metricSourceProbeId: "qualified-leads-count",
  metricSourceVersion: 1,
  dataClass: "INTERNAL",
  budgetCap: { max_turns: 200, max_cost_cents: 50_000 },
};

async function main() {
  console.log("governance-engine self-test — GoalContractStorePort over the in-memory adapter\n");

  // ── 1. validator accepts every legal edge / rejects every illegal edge (pure, no store). ──
  console.log("[1] TS validator: accept every legal edge, reject every illegal edge");
  const legal = new Set(enumerateLegalGoalEdges().map(([a, b]) => `${a}->${b}`));
  let legalOk = true;
  for (const e of legal) {
    const [from, to] = e.split("->") as [GoalState, GoalState];
    const ctx = from === "SUSPENDED" ? { prevState: to } : {};
    if (!isLegalGoalTransition(from, to, ctx)) legalOk = false;
  }
  check("every legal edge accepted", legalOk, `${legal.size} legal edges`);
  let illegalOk = true;
  let illegalCount = 0;
  for (const from of GOAL_STATES)
    for (const to of GOAL_STATES) {
      if (from === to) continue;
      if (legal.has(`${from}->${to}`)) continue;
      illegalCount++;
      const ctx = from === "SUSPENDED" ? { prevState: to } : {};
      if (isLegalGoalTransition(from, to, ctx)) illegalOk = false;
    }
  check("every illegal edge rejected", illegalOk, `${illegalCount} illegal edges`);

  // ── 2. full happy-path lifecycle CREATED → … → DONE over the in-memory store. ──
  console.log("\n[2] full lifecycle CREATED → FEASIBILITY → ACTIVE → PLANNING → EXECUTING → REVIEWING → DONE");
  const contract = createGoalContractOrgan(createInMemoryGoalContractStore());
  const c1 = await contract.createContract(SAMPLE);
  check("created at CREATED", c1.state === "CREATED", `state=${c1.state}`);
  const happy: GoalState[] = ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING", "REVIEWING", "DONE"];
  let cur = c1;
  for (const to of happy) {
    cur = await contract.transition(c1.goalId, to);
    check(`-> ${to}`, cur.state === to, `state=${cur.state}`);
  }
  check("DONE is terminal — DONE->PLANNING refused by the TS organ", await refused(() => contract.transition(c1.goalId, "PLANNING")));

  // ── 3. founder junction: REVIEWING → HALTED → CLOSED. ──
  console.log("\n[3] founder junction lifecycle … REVIEWING → HALTED → CLOSED");
  const c2 = await contract.createContract(SAMPLE);
  for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING", "REVIEWING", "HALTED", "CLOSED"] as GoalState[]) {
    const r = await contract.transition(c2.goalId, to);
    check(`-> ${to}`, r.state === to, `state=${r.state}`);
  }

  // ── 4. founder-freeze + resume: ACTIVE → SUSPENDED → (resume) ACTIVE. ──
  console.log("\n[4] founder-freeze + resume: … ACTIVE → SUSPENDED → resume(ACTIVE)");
  const c3 = await contract.createContract(SAMPLE);
  await contract.transition(c3.goalId, "FEASIBILITY");
  await contract.transition(c3.goalId, "ACTIVE");
  const susp = await contract.transition(c3.goalId, "SUSPENDED");
  check("SUSPENDED captured prev_state=ACTIVE", susp.state === "SUSPENDED" && susp.prevState === "ACTIVE", `prev=${susp.prevState}`);
  const resumed = await contract.resume(c3.goalId);
  check("resume restored ACTIVE + cleared prev_state", resumed.state === "ACTIVE" && resumed.prevState === null, `state=${resumed.state} prev=${resumed.prevState}`);
  check("resume to the WRONG target is refused (SUSPENDED->PLANNING when prev=ACTIVE)", await refused(async () => {
    const c4 = await contract.createContract(SAMPLE);
    await contract.transition(c4.goalId, "FEASIBILITY");
    await contract.transition(c4.goalId, "ACTIVE");
    await contract.transition(c4.goalId, "SUSPENDED"); // prev_state=ACTIVE
    return contract.transition(c4.goalId, "PLANNING"); // illegal: resume target must equal prev_state
  }));

  // ── 5. portable enforcement is REAL: the organ refuses an illegal edge the RAW store would accept. ──
  console.log("\n[5] portable enforcement: TS organ refuses what the trigger-less raw store accepts");
  const rawStore = createInMemoryGoalContractStore();
  const organ = createGoalContractOrgan(rawStore);
  const c5 = await organ.createContract(SAMPLE);
  // organ path: illegal CREATED->DONE is refused in TypeScript (no DB trigger present at all).
  let organThrew = false;
  try {
    await organ.transition(c5.goalId, "DONE");
  } catch (e) {
    organThrew = e instanceof IllegalGoalTransitionError;
  }
  check("organ refuses illegal CREATED->DONE (TS validator, no trigger)", organThrew);
  check("organ left the state untouched at CREATED", (await organ.readContract(c5.goalId))!.state === "CREATED");
  // raw path: the same illegal edge SUCCEEDS against the bare store — proving the TS layer is load-bearing.
  const c6 = await rawStore.createContract(SAMPLE);
  await rawStore.transition(c6.goalId, "DONE"); // no guard on the raw store
  check("raw store (no organ, no trigger) WOULD accept the illegal edge — the TS organ is what closes the gap", (await rawStore.readContract(c6.goalId))!.state === "DONE");

  console.log(`\n${failures === 0 ? "ALL PROOFS HOLD (exit 0)" : `FAILED — ${failures} assertion(s) (exit 1)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

async function refused(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof IllegalGoalTransitionError;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
