// Governance Engine — Goal Supervisor (C7) REGRESSION self-test, ported VERBATIM from the VERIFIED admin
// harness (`rumah-admin/.qa-reverify4-c7/harness.ts`) and run against the INVERTED organ + the IN-MEMORY ports.
//
// THE PROOF THIS FILE EXISTS TO MAKE: the 5-pass-hardened GS decision logic is BYTE-FOR-BYTE UNCHANGED in
// behavior under the port. Every invariant-table cell + ε-sweep case below is copied verbatim from the admin
// QA harness; the ONLY edit is the import path (`../goal-supervisor.js` instead of `../src/goal-supervisor-c7.js`)
// and, for the real-path cases, the durable store is now the injected `RuntimeStoresPort` (a fake or the real
// in-memory adapter) instead of the DB-backed `runtimeStoresAdapter`. Same inputs ⇒ same verdicts.
//
// Run:  tsx goal-supervisor-self-test.ts   ·   exit 0 = the inverted logic matches the verified logic · 1 = drift.

import {
  evaluateGoalSupervision,
  composeHaltAndFap,
  runGoalSupervision,
  runtimeStoresPortToSupervisionStore,
  createGoalSupervisor,
  DEFAULT_GRACE_FLOOR,
  DEFAULT_WINDOW,
  type GoalSupervisionFacts,
  type SupervisionStore,
} from "../goal-supervisor.js";
import { createInMemoryRuntimeStores, createInMemoryGoalContractStore } from "./in-memory-store.js";
import { createGoalContractOrgan } from "../goal-contract.js";

const budget = { max_turns: 100, max_cost_cents: 10000 };
const spent = { attempts: 90, cumulativeCostCents: 9000, budgetCap: budget }; // 90% — well past grace
const base = (over: Partial<GoalSupervisionFacts> = {}): GoalSupervisionFacts => ({
  goalId: "qa-rv4",
  window: DEFAULT_WINDOW,
  epsilon: 1e-6,
  graceFloor: DEFAULT_GRACE_FLOOR,
  progressSeries: [],
  externalReprobe: { ok: true, value: 0, cycle: 4 },
  effort: spent,
  acceptance: { op: ">=", target: 1.0, direction: "increase" },
  contractState: "EXECUTING",
  readable: { progress: true, effort: true },
  ...over,
});
const flat = (v: number) => [0, 1, 2, 3].map((c) => ({ cycle: c, value: v }));

let pass = 0, fail = 0;
const probes: Array<{ id: string; ok: boolean; got: string; note: string }> = [];
const expect = (id: string, want: "CONTINUE" | "HALT_AND_SUMMON", facts: GoalSupervisionFacts, note = "") => {
  const v = evaluateGoalSupervision(facts);
  const ok = v.verdict === want;
  ok ? pass++ : fail++;
  probes.push({ id, ok, got: `${v.verdict} dGoal=${v.dGoal} confirmed=${v.details.progressConfirmed} eps=${v.details.epsilon} clamped=${v.details.epsilonClamped}`, note });
};

// ── CRITERION 1: ε-boundary closed (Bug A) ──────────────────────────────────────────
expect("1a ε=0 flat 0.5 spent", "HALT_AND_SUMMON", base({ epsilon: 0, progressSeries: flat(0.5), externalReprobe: { ok: true, value: 0.5, cycle: 4 } }));
expect("1b ε<0 (-0.5) regressing 0.8→0.5 spent", "HALT_AND_SUMMON", base({ epsilon: -0.5, progressSeries: [{cycle:0,value:0.8},{cycle:1,value:0.7},{cycle:2,value:0.6},{cycle:3,value:0.55}], externalReprobe: { ok: true, value: 0.5, cycle: 4 } }));
expect("1c ε=NaN flat spent", "HALT_AND_SUMMON", base({ epsilon: Number.NaN, progressSeries: flat(0.5), externalReprobe: { ok: true, value: 0.5, cycle: 4 } }));
expect("1d ε=+Infinity flat spent", "HALT_AND_SUMMON", base({ epsilon: Number.POSITIVE_INFINITY, progressSeries: flat(0.5), externalReprobe: { ok: true, value: 0.5, cycle: 4 } }));
expect("1e integer metric stuck @5 dGoal=0 spent", "HALT_AND_SUMMON", base({ acceptance: { op: ">=", target: 10, direction: "increase" }, progressSeries: flat(5), externalReprobe: { ok: true, value: 5, cycle: 4 } }));
expect("1e' boolean metric stuck @0 dGoal=0 spent", "HALT_AND_SUMMON", base({ acceptance: { op: ">=", target: 1, direction: "increase" }, progressSeries: flat(0), externalReprobe: { ok: true, value: 0, cycle: 4 } }));
// NO over-correction:
expect("1f integer +4 (5→9) at ε=0 spent", "CONTINUE", base({ epsilon: 0, acceptance: { op: ">=", target: 10, direction: "increase" }, progressSeries: [{cycle:0,value:5},{cycle:1,value:6},{cycle:2,value:7},{cycle:3,value:8}], externalReprobe: { ok: true, value: 9, cycle: 4 } }));
expect("1g float moving >ε (0.2→0.6) spent", "CONTINUE", base({ progressSeries: [{cycle:0,value:0.2},{cycle:1,value:0.35},{cycle:2,value:0.5},{cycle:3,value:0.55}], externalReprobe: { ok: true, value: 0.6, cycle: 4 } }));

// ── CRITERION 2: comparators consistent at exactly dGoal=ε ───────────────────────────
expect("2a dGoal == ε exactly (0→0.5, ε=0.5) spent", "HALT_AND_SUMMON", base({ epsilon: 0.5, progressSeries: [{cycle:0,value:0.0},{cycle:1,value:0.0},{cycle:2,value:0.0},{cycle:3,value:0.0}], externalReprobe: { ok: true, value: 0.5, cycle: 4 } }));
expect("2b dGoal just below ε (0→0.4999999, ε=0.5) spent", "HALT_AND_SUMMON", base({ epsilon: 0.5, progressSeries: flat(0.0), externalReprobe: { ok: true, value: 0.4999999, cycle: 4 } }));
expect("2c dGoal just above ε (0→0.5000001, ε=0.5) spent", "CONTINUE", base({ epsilon: 0.5, progressSeries: flat(0.0), externalReprobe: { ok: true, value: 0.5000001, cycle: 4 } }));

// ── CRITERION 3: Bug B acceptance consistency ────────────────────────────────────────
expect("3a op<= + dir increase, rising AWAY 0.2→0.6 spent", "HALT_AND_SUMMON", base({ acceptance: { op: "<=", target: 0.1, direction: "increase" }, progressSeries: [{cycle:0,value:0.2},{cycle:1,value:0.3},{cycle:2,value:0.4},{cycle:3,value:0.5}], externalReprobe: { ok: true, value: 0.6, cycle: 4 } }));
expect("3a' op>= + dir decrease (reverse contradiction), falling 0.6→0.2 spent", "HALT_AND_SUMMON", base({ acceptance: { op: ">=", target: 1.0, direction: "decrease" }, progressSeries: [{cycle:0,value:0.6},{cycle:1,value:0.5},{cycle:2,value:0.4},{cycle:3,value:0.3}], externalReprobe: { ok: true, value: 0.2, cycle: 4 } }));
expect("3b op== gap NOT shrinking (0.2→0.8, target 0.5) spent", "HALT_AND_SUMMON", base({ acceptance: { op: "==", target: 0.5 }, progressSeries: [{cycle:0,value:0.2},{cycle:1,value:0.3},{cycle:2,value:0.6},{cycle:3,value:0.7}], externalReprobe: { ok: true, value: 0.8, cycle: 4 } }));
expect("3b' op== gap symmetric overshoot (1.0→0.0, target 0.5, gap unchanged) spent", "HALT_AND_SUMMON", base({ acceptance: { op: "==", target: 0.5 }, progressSeries: flat(1.0), externalReprobe: { ok: true, value: 0.0, cycle: 4 } }));
expect("3c consistent op== gap SHRINKING (1.0→0.55, target 0.5) spent", "CONTINUE", base({ acceptance: { op: "==", target: 0.5 }, progressSeries: [{cycle:0,value:1.0},{cycle:1,value:0.8},{cycle:2,value:0.65},{cycle:3,value:0.58}], externalReprobe: { ok: true, value: 0.55, cycle: 4 } }));
expect("3c' consistent op<= + dir decrease, genuinely falling 0.5→0.15 spent", "CONTINUE", base({ acceptance: { op: "<=", target: 0.05, direction: "decrease" }, progressSeries: [{cycle:0,value:0.5},{cycle:1,value:0.4},{cycle:2,value:0.3},{cycle:3,value:0.22}], externalReprobe: { ok: true, value: 0.15, cycle: 4 } }));

// ── CRITERION 4: FINAL creative attack ───────────────────────────────────────────────
expect("4a flat AT target (value==target==1.0) spent", "HALT_AND_SUMMON", base({ acceptance: { op: ">=", target: 1.0, direction: "increase" }, progressSeries: flat(1.0), externalReprobe: { ok: true, value: 1.0, cycle: 4 } }));
expect("4b op== already-at-target flat (gap 0, no shrink) spent", "HALT_AND_SUMMON", base({ acceptance: { op: "==", target: 0.5 }, progressSeries: flat(0.5), externalReprobe: { ok: true, value: 0.5, cycle: 4 } }));
expect("4c multi-axis, max_turns=NaN + cost spent past, flat", "HALT_AND_SUMMON", base({ effort: { attempts: 90, cumulativeCostCents: 9000, budgetCap: { max_turns: Number.NaN, max_cost_cents: 10000 } }, progressSeries: flat(0.5), externalReprobe: { ok: true, value: 0.5, cycle: 4 } }));
expect("4d absurd huge re-read 1e9 on increase goal spent", "CONTINUE", base({ progressSeries: flat(0.5), externalReprobe: { ok: true, value: 1e9, cycle: 4 } }));
expect("4d' absurd huge re-read 1e9 on op== gap goal spent", "HALT_AND_SUMMON", base({ acceptance: { op: "==", target: 0.5 }, progressSeries: flat(0.5), externalReprobe: { ok: true, value: 1e9, cycle: 4 } }));
expect("4e float rounding (0.2→0.3, dGoal≈0.0999999998, ε=0.1) spent", "HALT_AND_SUMMON", base({ epsilon: 0.1, progressSeries: flat(0.2), externalReprobe: { ok: true, value: 0.3, cycle: 4 } }));
expect("4f subnormal tiny dGoal (0→5e-324) ε=1e-6 spent", "HALT_AND_SUMMON", base({ progressSeries: flat(0), externalReprobe: { ok: true, value: 5e-324, cycle: 4 } }));
expect("4g decrease to negative target (-2→-8 toward -10) spent", "CONTINUE", base({ acceptance: { op: "<=", target: -10, direction: "decrease" }, progressSeries: [{cycle:0,value:-2},{cycle:1,value:-4},{cycle:2,value:-6},{cycle:3,value:-7}], externalReprobe: { ok: true, value: -8, cycle: 4 } }));
expect("4h decrease goal regressing (-8→-2, rising away from -10) spent", "HALT_AND_SUMMON", base({ acceptance: { op: "<=", target: -10, direction: "decrease" }, progressSeries: [{cycle:0,value:-8},{cycle:1,value:-6},{cycle:2,value:-4},{cycle:3,value:-3}], externalReprobe: { ok: true, value: -2, cycle: 4 } }));
expect("4i op== with NO target, flat spent", "HALT_AND_SUMMON", base({ acceptance: { op: "==" }, progressSeries: flat(0.5), externalReprobe: { ok: true, value: 0.5, cycle: 4 } }));
expect("4j op== target=NaN, 'shrinking' spent", "HALT_AND_SUMMON", base({ acceptance: { op: "==", target: Number.NaN }, progressSeries: [{cycle:0,value:1.0},{cycle:1,value:0.8},{cycle:2,value:0.7},{cycle:3,value:0.6}], externalReprobe: { ok: true, value: 0.55, cycle: 4 } }));
expect("4k 2 samples flat spent (sample-count + strict)", "HALT_AND_SUMMON", base({ progressSeries: [{cycle:0,value:0.5},{cycle:1,value:0.5}], externalReprobe: { ok: true, value: 0.5, cycle: 2 } }));
expect("4l ε=1e9 huge, real +100 move, spent", "HALT_AND_SUMMON", base({ epsilon: 1e9, progressSeries: [{cycle:0,value:0},{cycle:1,value:30},{cycle:2,value:60},{cycle:3,value:90}], externalReprobe: { ok: true, value: 100, cycle: 4 } }));
expect("4m no acceptance shape, flat spent", "HALT_AND_SUMMON", base({ acceptance: undefined, progressSeries: flat(0.5), externalReprobe: { ok: true, value: 0.5, cycle: 4 } }));
expect("4n reprobe ok value=null, flat ledger spent", "HALT_AND_SUMMON", base({ externalReprobe: { ok: true, value: null, cycle: 4 }, progressSeries: flat(0.5) }));

// ── CRITERION 5: nothing weakened — soundness core + inertness via real runGoalSupervision (faulted ports) ──
async function realPath() {
  // injected RuntimeStoresPort whose effort read THROWS → effortSound=false → SUMMON (fail-closed).
  const throwingEffort: SupervisionStore = {
    appendProgressSample: async () => true,
    readProgressSeries: async () => flat(0.5),
    countAttempts: async () => { throw new Error("DB blip"); },
    readCumulativeCost: async () => 9000,
  };
  const r1 = await runGoalSupervision(
    { goalId: "qa-rv4-real", cycle: 4, probeId: "p", probeVersion: 1, budgetCap: budget, contractState: "EXECUTING", config: { acceptance: { op: ">=", target: 1, direction: "increase" } } },
    async () => ({ value: 0.5 }),
    throwingEffort,
  );
  const okEffort = r1.verdict.verdict === "HALT_AND_SUMMON" && r1.verdict.details.effortSound === false;
  probes.push({ id: "5a real-path effort store THROWS → effortSound=false → SUMMON", ok: okEffort, got: `${r1.verdict.verdict} effortSound=${r1.verdict.details.effortSound}`, note: "fail-closed" });
  okEffort ? pass++ : fail++;

  // loop-can't-lie: ledger says 0.99 latest, GS re-read says 0.40 (flat truth) → SUMMON, currentValue=0.40
  const lyingStore: SupervisionStore = {
    appendProgressSample: async () => true,
    readProgressSeries: async () => [{cycle:0,value:0.40},{cycle:1,value:0.40},{cycle:2,value:0.40},{cycle:3,value:0.99}],
    countAttempts: async () => 90,
    readCumulativeCost: async () => 9000,
  };
  const r2 = await runGoalSupervision(
    { goalId: "qa-rv4-lie", cycle: 4, probeId: "p", probeVersion: 1, budgetCap: budget, config: { acceptance: { op: ">=", target: 1, direction: "increase" } } },
    async () => ({ value: 0.40 }), // GS independent re-read: truth is flat
    lyingStore,
  );
  const okLie = r2.verdict.verdict === "HALT_AND_SUMMON" && r2.verdict.details.currentValue === 0.40 && r2.halt?.halt.executed === false;
  probes.push({ id: "5b loop-can't-lie: GS re-read 0.40 drives dGoal, not ledger 0.99 → SUMMON, executed:false", ok: okLie, got: `${r2.verdict.verdict} currentValue=${r2.verdict.details.currentValue} executed=${r2.halt?.halt.executed}`, note: "external + inert" });
  okLie ? pass++ : fail++;

  // thrown re-probe → progressSound=false → SUMMON
  const r3 = await runGoalSupervision(
    { goalId: "qa-rv4-throw", cycle: 4, probeId: "p", probeVersion: 1, budgetCap: budget, config: { acceptance: { op: ">=", target: 1, direction: "increase" } } },
    async () => { throw new Error("probe down"); },
    lyingStore,
  );
  const okThrow = r3.verdict.verdict === "HALT_AND_SUMMON" && r3.verdict.details.progressSound === false;
  probes.push({ id: "5c re-probe THROWS → progressSound=false → SUMMON", ok: okThrow, got: `${r3.verdict.verdict} progressSound=${r3.verdict.details.progressSound}`, note: "fail-closed" });
  okThrow ? pass++ : fail++;

  // trip inertness: a flat-spent trip drafts but executes nothing, pages nothing
  const tripFacts = base({ progressSeries: flat(0.5), externalReprobe: { ok: true, value: 0.5, cycle: 4 } });
  const v = evaluateGoalSupervision(tripFacts);
  const hf = composeHaltAndFap(tripFacts, v, { cycle: 4, enforce: true, pagingConfigured: false });
  const okInert = v.trip === true && hf.halt.executed === false && hf.paging.mode === "SHADOW" && hf.halt.to === "HALTED";
  probes.push({ id: "5d nothing-live-halted: trip drafts executed:false, paging SHADOW even with enforce:true", ok: okInert, got: `trip=${v.trip} executed=${hf.halt.executed} paging=${hf.paging.mode}`, note: "inert" });
  okInert ? pass++ : fail++;
}

// ── CRITERION 6 (slice-2 NEW): the organ runs end-to-end on the REAL in-memory ports — ZERO Postgres. ──────
// The decisive extraction proof: the inverted GS, composed onto the in-memory RuntimeStoresPort + the
// GoalContractStorePort via createGoalSupervisor, produces the SAME verdicts the verified logic produces — with
// no DB anywhere. The budget envelope + lifecycle state are SOURCED from the durable contract (the port
// composition), and the GS's own append-only ProgressSample write lands in the in-memory ledger.
async function portCompositionPath() {
  // (i) FLAT-spent goal driven through the real in-memory stores → SUMMON. We pre-seed effort + a flat series
  //     in the durable ledger, then run multiple GS cycles (each appends the GS's own external re-read).
  const store = createInMemoryRuntimeStores();
  const contract = createGoalContractOrgan(createInMemoryGoalContractStore());
  const goal = await contract.createContract({
    objective: "raise X to 1.0",
    acceptanceMetric: "X >= 1.0",
    metricSourceProbeId: "x-probe",
    metricSourceVersion: 1,
    dataClass: "INTERNAL",
    budgetCap: { max_turns: 100, max_cost_cents: 10000 },
  });
  // move the contract to EXECUTING (the GS's `from` state) via the legal lifecycle.
  for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as const) await contract.transition(goal.goalId, to);
  // pre-seed dEffort: 90 attempts + 9000¢ of cost (well past grace) on the SAME goal.
  for (let i = 1; i <= 90; i++) await store.recordAttempt({ goalId: goal.goalId, stepId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`, attempt: 1, outcome: "flat" });
  await store.appendCost({ goalId: goal.goalId, costCents: 9000 });

  const gs = createGoalSupervisor({ store, contract });
  // run 4 cycles, each the GS re-reads a FLAT 0.5 (no movement) → its own samples accumulate in the ledger.
  let last;
  for (let cycle = 0; cycle < 4; cycle++) {
    last = await gs.superviseGoal(
      { goalId: goal.goalId, cycle, probeId: "x-probe", probeVersion: 1, config: { acceptance: { op: ">=", target: 1.0, direction: "increase" } } },
      async () => ({ value: 0.5 }),
    );
  }
  const series = await store.readProgressSeries(goal.goalId);
  const okFlat =
    last!.verdict.verdict === "HALT_AND_SUMMON" &&
    last!.verdict.details.currentValue === 0.5 &&
    series.length === 4 &&                       // the GS appended its own sample each cycle (append-only ledger)
    last!.halt?.halt.executed === false &&        // SHADOW — nothing transitioned
    last!.halt?.halt.from === "EXECUTING";        // contractState SOURCED from the durable contract via the port
  probes.push({ id: "6a end-to-end on REAL in-memory ports (flat, spent) → SUMMON, executed:false, from EXECUTING", ok: okFlat, got: `${last!.verdict.verdict} cur=${last!.verdict.details.currentValue} samples=${series.length} from=${last!.halt?.halt.from}`, note: "zero Postgres" });
  okFlat ? pass++ : fail++;

  // (ii) CONFIRMED-MOVING goal on the real ports → CONTINUE. A rising external re-read each cycle.
  const store2 = createInMemoryRuntimeStores();
  const contract2 = createGoalContractOrgan(createInMemoryGoalContractStore());
  const goal2 = await contract2.createContract({
    objective: "raise X", acceptanceMetric: "X >= 1.0", metricSourceProbeId: "x-probe", metricSourceVersion: 1,
    dataClass: "INTERNAL", budgetCap: { max_turns: 100, max_cost_cents: 10000 },
  });
  for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as const) await contract2.transition(goal2.goalId, to);
  for (let i = 1; i <= 90; i++) await store2.recordAttempt({ goalId: goal2.goalId, stepId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`, attempt: 1, outcome: "progressed" });
  await store2.appendCost({ goalId: goal2.goalId, costCents: 9000 });
  const gs2 = createGoalSupervisor({ store: store2, contract: contract2 });
  const rising = [0.2, 0.4, 0.6, 0.8, 1.0];
  let last2;
  for (let cycle = 0; cycle < rising.length; cycle++) {
    last2 = await gs2.superviseGoal(
      { goalId: goal2.goalId, cycle, probeId: "x-probe", probeVersion: 1, config: { acceptance: { op: ">=", target: 1.0, direction: "increase" } } },
      async () => ({ value: rising[cycle]! }),
    );
  }
  const okRising = last2!.verdict.verdict === "CONTINUE" && last2!.verdict.details.progressConfirmed === true && last2!.halt === null;
  probes.push({ id: "6b end-to-end on REAL in-memory ports (rising re-read, spent) → CONTINUE (progress confirmed)", ok: okRising, got: `${last2!.verdict.verdict} confirmed=${last2!.verdict.details.progressConfirmed}`, note: "zero Postgres" });
  okRising ? pass++ : fail++;

  // (iii) the GS append is IDEMPOTENT on (goal,cycle): a re-run of the same cycle does not duplicate a sample.
  const before = (await store2.readProgressSeries(goal2.goalId)).length;
  await gs2.superviseGoal(
    { goalId: goal2.goalId, cycle: 0, probeId: "x-probe", probeVersion: 1, config: { acceptance: { op: ">=", target: 1.0, direction: "increase" } } },
    async () => ({ value: 0.99 }),
  );
  const after = (await store2.readProgressSeries(goal2.goalId)).length;
  probes.push({ id: "6c GS append idempotent on (goal,cycle): re-running cycle 0 adds no duplicate sample", ok: after === before, got: `before=${before} after=${after}`, note: "append-only idempotent" });
  after === before ? pass++ : fail++;
}

async function main() {
  await realPath();
  await portCompositionPath();

  for (const p of probes) console.log(`${p.ok ? "PASS" : "FAIL"}  ${p.id}  ::  ${p.got}`);
  console.log(`\ngovernance-engine GS self-test (verbatim invariant table + ε-sweep + port composition): ${pass}/${pass + fail} passed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
