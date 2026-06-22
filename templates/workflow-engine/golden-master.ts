// Golden-master / CI cage for the workflow engine's state machine (the engine's plumbing, travels with it).
// This is the harness that PINS the state machine. Fixture-driven: it asserts EVERY legal transition is
// allowed and EVERY illegal edge is refused (fail-closed). It also asserts the in-code validator
// (state-machine.ts LEGAL_RUN_EDGES / LEGAL_STEP_EDGES) and the DB trigger whitelist (the engine migration
// set) describe the SAME graph — drift between them is the exact failure this cage exists to catch.
//
// Path resolution: by default the cage reads the CANONICAL engine migration set alongside it
// (./migrations/0001_engine_core.sql + ./migrations/0002_engine_await_loop.sql). An installer that applies
// renumbered instance migrations can point the cage at its own DDL via ENGINE_MIGRATIONS_DIR +
// ENGINE_CORE_SQL / ENGINE_AWAIT_SQL env overrides (so the cage runs against the APPLIED instance locally).
//
// Zero DB required: the validator portion is pure. Run: tsx golden-master.ts
// Exit 0 = PINNED (all assertions hold); exit 1 = the state machine changed without updating the cage.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  RUN_STATES,
  LEGAL_RUN_EDGES,
  isLegalRunTransition,
  assertLegalRunTransition,
  IllegalTransitionError,
  type RunState,
  STEP_STATES,
  LEGAL_STEP_EDGES,
  isLegalStepTransition,
  assertLegalStepTransition,
  IllegalStepTransitionError,
  type StepState,
} from "./state-machine.js";

const here = dirname(fileURLToPath(import.meta.url));
// the migration DDL to pin against (canonical by default; installer-overridable for the applied instance).
const migDir = process.env.ENGINE_MIGRATIONS_DIR ?? join(here, "migrations");
const coreSqlPath = process.env.ENGINE_CORE_SQL ?? join(migDir, "0001_engine_core.sql");
const awaitSqlPath = process.env.ENGINE_AWAIT_SQL ?? join(migDir, "0002_engine_await_loop.sql");

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`);
  } else {
    console.error(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
    failures++;
  }
}

console.log("workflow-engine golden-master cage\n");

// ── 1. The pinned legal-edge fixture (the EXACT graph, hand-listed — the source of truth the cage protects).
// If you change LEGAL_RUN_EDGES you MUST change this fixture too; that is the deliberate friction.
const PINNED_LEGAL_EDGES: ReadonlyArray<readonly [RunState, RunState]> = [
  ["queued", "planned"],
  ["queued", "failed"],
  ["planned", "executing"],
  ["executing", "executing"],
  ["executing", "blocked"],
  ["executing", "completed"],
  ["executing", "failed"],
  ["blocked", "executing"],
  ["blocked", "failed"],
  ["failed", "executing"],
  ["executing", "recovered"],
];

console.log("[1] app validator matches the pinned legal-edge fixture");
const appSet = new Set(LEGAL_RUN_EDGES.map(([a, b]) => `${a}->${b}`));
const pinnedSet = new Set(PINNED_LEGAL_EDGES.map(([a, b]) => `${a}->${b}`));
check("same edge count", appSet.size === pinnedSet.size, `app=${appSet.size} pinned=${pinnedSet.size}`);
for (const e of pinnedSet) check(`legal edge present: ${e}`, appSet.has(e));
for (const e of appSet) check(`no extra app edge: ${e}`, pinnedSet.has(e));

// ── 2. Every LEGAL edge is allowed by isLegalRunTransition + assertLegalRunTransition does NOT throw.
console.log("\n[2] every LEGAL transition is allowed (fail-open on the whitelist only)");
for (const [from, to] of PINNED_LEGAL_EDGES) {
  let allowed = isLegalRunTransition(from, to);
  if (allowed) {
    try { assertLegalRunTransition(from, to); } catch { allowed = false; }
  }
  check(`allow ${from} -> ${to}`, allowed);
}

// ── 3. Every ILLEGAL edge (the full Cartesian complement) is REFUSED + assert throws IllegalTransitionError.
console.log("\n[3] every ILLEGAL transition is refused (fail-closed)");
let illegalChecked = 0;
for (const from of RUN_STATES) {
  for (const to of RUN_STATES) {
    if (pinnedSet.has(`${from}->${to}`)) continue; // skip the legal ones
    illegalChecked++;
    let refused = !isLegalRunTransition(from, to);
    let threw = false;
    try { assertLegalRunTransition(from, to); } catch (e) { threw = e instanceof IllegalTransitionError; }
    check(`refuse ${from} -> ${to}`, refused && threw);
  }
}
check("illegal-edge coverage is the full complement", illegalChecked === RUN_STATES.length * RUN_STATES.length - pinnedSet.size, `${illegalChecked} illegal edges`);

// ── 4. Specific catastrophic edges are explicitly refused (the ones the founder/critic care about).
console.log("\n[4] catastrophic edges explicitly refused");
const catastrophic: ReadonlyArray<readonly [RunState, RunState]> = [
  ["completed", "executing"], // un-completing a finished run
  ["completed", "queued"],
  ["recovered", "executing"], // un-recovering
  ["failed", "completed"], // skipping the recovery edge to fake success
  ["queued", "executing"], // skipping planning
  ["queued", "completed"], // skipping everything
  ["planned", "completed"], // completing without executing a step
  ["blocked", "completed"], // completing while blocked
];
for (const [from, to] of catastrophic) check(`refuse catastrophic ${from} -> ${to}`, !isLegalRunTransition(from, to));

// ── 5. The DB trigger whitelist (engine core migration) describes the SAME graph as the app validator.
// Parse the OLD.state/NEW.state pairs out of the trigger function and compare sets. Drift = FAIL.
console.log("\n[5] DB trigger (engine core) whitelist == app validator whitelist (no drift)");
const sqlText = readFileSync(coreSqlPath, "utf8");
const triggerEdges = new Set<string>();
const re = /OLD\.state\s*=\s*'(\w+)'\s+AND\s+NEW\.state\s*=\s*'(\w+)'/g;
let m: RegExpExecArray | null;
while ((m = re.exec(sqlText)) !== null) triggerEdges.add(`${m[1]}->${m[2]}`);
// The trigger permits ALL same-state writes via its `NEW.state = OLD.state => RETURN NEW` branch (the
// executing->executing multi-step self-loop is a same-state write, not a whitelisted state CHANGE). So
// compare only the genuine state-CHANGE edges (from != to) — the trigger's explicit whitelist.
const appChangeSet = new Set([...appSet].filter((e) => { const [a, b] = e.split("->"); return a !== b; }));
check("trigger handles same-state writes (executing->executing self-loop)", /NEW\.state\s*=\s*OLD\.state/.test(sqlText));
check("trigger change-edge count matches app", triggerEdges.size === appChangeSet.size, `trigger=${triggerEdges.size} app-change=${appChangeSet.size}`);
for (const e of appChangeSet) check(`trigger has app change-edge: ${e}`, triggerEdges.has(e));
for (const e of triggerEdges) check(`app has trigger change-edge: ${e}`, appSet.has(e));

// ── 6. STEP state machine (Slice 1) — the step legal-edge whitelist + DB step-trigger parity. ──
console.log("\n[6] STEP machine: app step-whitelist matches the pinned fixture + the await-loop DB step trigger");
const PINNED_LEGAL_STEP_EDGES: ReadonlyArray<readonly [StepState, StepState]> = [
  ["ready", "leased"],
  ["leased", "done"],
  ["leased", "failed"],
  ["leased", "blocked"],
  ["leased", "ready"],
  ["failed", "leased"],
  ["done", "ready"],
  ["ready", "done"],
  ["ready", "blocked"],
  ["blocked", "done"],
  ["blocked", "failed"],
];
const appStepSet = new Set(LEGAL_STEP_EDGES.map(([a, b]) => `${a}->${b}`));
const pinnedStepSet = new Set(PINNED_LEGAL_STEP_EDGES.map(([a, b]) => `${a}->${b}`));
check("same step-edge count", appStepSet.size === pinnedStepSet.size, `app=${appStepSet.size} pinned=${pinnedStepSet.size}`);
for (const e of pinnedStepSet) check(`legal step-edge present: ${e}`, appStepSet.has(e));
for (const e of appStepSet) check(`no extra app step-edge: ${e}`, pinnedStepSet.has(e));

// every legal step-edge is allowed; every illegal step-edge (Cartesian complement) is refused + throws.
for (const [from, to] of PINNED_LEGAL_STEP_EDGES) {
  let allowed = isLegalStepTransition(from, to);
  if (allowed) { try { assertLegalStepTransition(from, to); } catch { allowed = false; } }
  check(`allow step ${from} -> ${to}`, allowed);
}
for (const from of STEP_STATES) {
  for (const to of STEP_STATES) {
    if (pinnedStepSet.has(`${from}->${to}`)) continue;
    let refused = !isLegalStepTransition(from, to);
    let threw = false;
    try { assertLegalStepTransition(from, to); } catch (e) { threw = e instanceof IllegalStepTransitionError; }
    check(`refuse step ${from} -> ${to}`, refused && threw);
  }
}
// the two new cross-process edges the founder/critic care about are present (S1/D2 completer; back-edge).
check("step edge present: blocked -> done (the completer advance, D2)", appStepSet.has("blocked->done"));
check("step edge present: done -> ready (the loop back-edge, D3)", appStepSet.has("done->ready"));
check("step edge present: leased -> blocked (await yields, R1)", appStepSet.has("leased->blocked"));

// DB step-trigger (await-loop migration) describes the SAME step graph. Parse OLD/NEW pairs out of the guard.
const sql37 = readFileSync(awaitSqlPath, "utf8");
const stepFnMatch = sql37.match(/workflow_step_transition_guard\(\)\s*RETURNS trigger[\s\S]*?\$\$ LANGUAGE plpgsql;/);
const stepFnText = stepFnMatch ? stepFnMatch[0] : "";
const stepTriggerEdges = new Set<string>();
const re37 = /OLD\.state\s*=\s*'(\w+)'\s+AND\s+NEW\.state\s*=\s*'(\w+)'/g;
let m37: RegExpExecArray | null;
while ((m37 = re37.exec(stepFnText)) !== null) stepTriggerEdges.add(`${m37[1]}->${m37[2]}`);
check("step trigger handles same-state writes (bookkeeping)", /NEW\.state\s*=\s*OLD\.state/.test(stepFnText));
check("step-trigger edge count matches app", stepTriggerEdges.size === appStepSet.size, `trigger=${stepTriggerEdges.size} app=${appStepSet.size}`);
for (const e of appStepSet) check(`step trigger has app step-edge: ${e}`, stepTriggerEdges.has(e));
for (const e of stepTriggerEdges) check(`app has step-trigger step-edge: ${e}`, appStepSet.has(e));

// ── 7. The RUN machine is UNCHANGED by Slice 1 (no regression — the run whitelist is the same graph). ──
console.log("\n[7] Slice 1 did NOT regress the RUN machine (run whitelist unchanged)");
check("run-edge count still 11 (no run edges added/removed by Slice 1)", appSet.size === 11, `count=${appSet.size}`);

// ── verdict ──────────────────────────────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? "PINNED — state machine cage holds (exit 0)" : `BROKEN — ${failures} assertion(s) failed (exit 1)`}`);
process.exit(failures === 0 ? 0 : 1);
