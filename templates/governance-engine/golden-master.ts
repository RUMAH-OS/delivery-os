// Governance Engine — the golden-master CAGE for the §4.3 GoalContract state machine.
//
// THE LOAD-BEARING DELIVERABLE. This cage PINS the TypeScript validator (`state-machine.ts`) byte-for-byte
// against the §4.3 DB trigger's allowed-edge set — the governance analogue of the C11 engine's golden-master
// (`templates/workflow-engine/golden-master.ts`). If the TS mirror and the DB trigger ever DIVERGE, this cage
// FAILS (exit 1). That equality is what makes the enforcement portable AND honest: a consumer is protected by
// the TS validator (every plane) and the DB trigger (Postgres), and neither may silently drift from the other.
//
// It GENUINELY PARSES the trigger — it does NOT hard-code an assumed edge set. It reconstructs the trigger's
// allowed transitions by parsing:
//   * the state universe          (goal_contract_state_chk CHECK)
//   * the terminal states         (the `IF OLD.state IN (...)` guard line)
//   * the resumable states        (goal_contract_prev_state_chk CHECK)
//   * the FAILED fan-in branch     `(NEW.state = 'FAILED')`
//   * the SUSPEND fan-in branch    `NEW.state = 'SUSPENDED' AND OLD.state <> 'SUSPENDED' ...`
//   * the resume fan-out branch    `OLD.state = 'SUSPENDED' AND ... NEW.state = OLD.prev_state`
//   * the enumerated forward edges `OLD.state = 'X' AND NEW.state = 'Y' | IN (...)`
// …then EXPANDS those branch families to a concrete edge set and compares it to the TS validator's enumeration.
//
// Path resolution (mirrors the engine cage's env-overridable design so it runs in ANY checkout):
//   * Default: parse the SHIPPED `./migrations/0001_goal_contract.sql` (always present → the core TS⇄DB proof
//     ALWAYS runs, even in single-repo CI — it never self-disables).
//   * PROVENANCE cross-check: if admin's real `0053_goal_contract.sql` is reachable (the sibling repo or the
//     ADMIN_GOAL_CONTRACT_SQL env override), ALSO parse it and assert its edge set == the shipped copy's — proof
//     the vendored DDL has not drifted from the canonical admin trigger. Absent ⇒ that one cross-check is SKIPPED
//     (reported), the core proof still runs in full.
//   * GOVERNANCE_GOAL_CONTRACT_SQL overrides the shipped path (point the cage at an applied instance migration).
//
// Zero DB required. Run:  tsx golden-master.ts   ·   exit 0 = PINNED · exit 1 = the machine drifted.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  GOAL_STATES,
  RESUMABLE_GOAL_STATES,
  isLegalGoalTransition,
  assertLegalGoalTransition,
  enumerateLegalGoalEdges,
  IllegalGoalTransitionError,
  type GoalState,
} from "./state-machine.js";

const here = dirname(fileURLToPath(import.meta.url));
const shippedSqlPath =
  process.env.GOVERNANCE_GOAL_CONTRACT_SQL ?? join(here, "migrations", "0001_goal_contract.sql");
// admin's canonical 0053 (the source of truth) — for the optional provenance cross-check.
const adminSqlPath =
  process.env.ADMIN_GOAL_CONTRACT_SQL ?? join(here, "..", "..", "..", "rumah-admin", "migrations", "0053_goal_contract.sql");

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`);
  else {
    console.error(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
    failures++;
  }
}

// ── The trigger parser — reconstructs the DB's allowed-edge SET from the SQL text (genuine parse). ─────────
function parseList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().replace(/^'/, "").replace(/'$/, ""))
    .filter(Boolean);
}

interface ParsedTrigger {
  states: string[];
  terminal: string[];
  resumable: string[];
  /** every concrete state-CHANGE edge (`from->to`) the trigger permits, expanded from its branch families. */
  edges: Set<string>;
  /** which branch families were detected (so a DELETED branch fails the cage rather than silently shrinking). */
  branches: { failedFanIn: boolean; suspendFanIn: boolean; resumeFanOut: boolean; sameStateWrite: boolean };
}

function parseTrigger(sqlText: string): ParsedTrigger {
  // state universe (from the table CHECK constraint).
  const stateM = sqlText.match(/goal_contract_state_chk\s+CHECK\s*\(\s*state IN \(([^)]*)\)/);
  const states = stateM ? parseList(stateM[1]) : [];

  // resumable states (the prev_state CHECK constraint).
  const prevM = sqlText.match(/goal_contract_prev_state_chk[\s\S]*?prev_state IN \(([^)]*)\)/);
  const resumable = prevM ? parseList(prevM[1]) : [];

  // isolate the guard FUNCTION body (so we parse the enforcement, not the prose header).
  const fnMatch = sqlText.match(
    /CREATE OR REPLACE FUNCTION goal_contract_state_machine_guard\(\) RETURNS trigger AS \$\$([\s\S]*?)\$\$ LANGUAGE plpgsql;/,
  );
  const fn = fnMatch ? fnMatch[1] : "";

  // terminal states (the `IF OLD.state IN (...) THEN` guard).
  const termM = fn.match(/IF OLD\.state IN \(([^)]*)\)\s+THEN/);
  const terminal = termM ? parseList(termM[1]) : [];

  const nonTerminal = states.filter((s) => !terminal.includes(s));
  const edges = new Set<string>();

  // (A) FAILED fan-in: `(NEW.state = 'FAILED')` ⇒ every non-terminal → FAILED.
  const failedFanIn = /NEW\.state\s*=\s*'FAILED'/.test(fn);
  if (failedFanIn) for (const from of nonTerminal) edges.add(`${from}->FAILED`);

  // (B) SUSPEND fan-in: `NEW.state = 'SUSPENDED' AND OLD.state <> 'SUSPENDED' ...` ⇒ non-terminal(≠SUSPENDED) → SUSPENDED.
  const suspendFanIn = /NEW\.state\s*=\s*'SUSPENDED'\s+AND\s+OLD\.state\s*<>\s*'SUSPENDED'/.test(fn);
  if (suspendFanIn) for (const from of nonTerminal) if (from !== "SUSPENDED") edges.add(`${from}->SUSPENDED`);

  // (C) resume fan-out: `OLD.state = 'SUSPENDED' AND ... NEW.state = OLD.prev_state` ⇒ SUSPENDED → each resumable.
  const resumeFanOut =
    /OLD\.state\s*=\s*'SUSPENDED'\s+AND\s+OLD\.prev_state IS NOT NULL\s+AND\s+NEW\.state\s*=\s*OLD\.prev_state/.test(fn);
  if (resumeFanOut) for (const to of resumable) edges.add(`SUSPENDED->${to}`);

  // (D) the enumerated forward edges: `OLD.state = 'X' AND NEW.state = 'Y'` | `... NEW.state IN ('Y','Z')`.
  const fwd = /OLD\.state\s*=\s*'(\w+)'\s+AND\s+NEW\.state\s*(?:=\s*'(\w+)'|IN\s*\(([^)]*)\))/g;
  let m: RegExpExecArray | null;
  while ((m = fwd.exec(fn)) !== null) {
    const from = m[1];
    const tos = m[2] ? [m[2]] : parseList(m[3]);
    for (const to of tos) edges.add(`${from}->${to}`);
  }

  const sameStateWrite = /NEW\.state\s*=\s*OLD\.state/.test(fn);
  return { states, terminal, resumable, edges, branches: { failedFanIn, suspendFanIn, resumeFanOut, sameStateWrite } };
}

console.log("governance-engine golden-master cage — §4.3 GoalContract state machine (TS validator ⇄ DB trigger)\n");

// ── 1. Parse the SHIPPED trigger DDL and prove the parse is structurally complete. ────────────────────────
console.log(`[1] parse the shipped trigger DDL  (${shippedSqlPath})`);
if (!existsSync(shippedSqlPath)) {
  console.error(`  FAIL  shipped trigger DDL not found at ${shippedSqlPath}`);
  process.exit(1);
}
const shipped = parseTrigger(readFileSync(shippedSqlPath, "utf8"));
check("state universe parsed (11 states)", shipped.states.length === 11, `states=${shipped.states.length}`);
check("terminal set parsed (DONE/FAILED/CLOSED)", shipped.terminal.slice().sort().join(",") === "CLOSED,DONE,FAILED");
check("resumable set parsed (7)", shipped.resumable.length === 7, `resumable=${shipped.resumable.length}`);
check("FAILED fan-in branch present", shipped.branches.failedFanIn);
check("SUSPEND fan-in branch present", shipped.branches.suspendFanIn);
check("resume fan-out branch present", shipped.branches.resumeFanOut);
check("same-state-write branch present", shipped.branches.sameStateWrite);
check("trigger expands to 34 concrete change-edges", shipped.edges.size === 34, `edges=${shipped.edges.size}`);

// ── 2. THE CAGE: the TS validator's edge set == the parsed trigger's edge set (no drift, either direction). ─
console.log("\n[2] TS validator enumeration == DB trigger edge set  (THE PIN)");
const tsEdges = new Set(enumerateLegalGoalEdges().map(([a, b]) => `${a}->${b}`));
check("same edge count", tsEdges.size === shipped.edges.size, `ts=${tsEdges.size} trigger=${shipped.edges.size}`);
for (const e of shipped.edges) check(`TS has trigger edge: ${e}`, tsEdges.has(e));
for (const e of tsEdges) check(`trigger has TS edge: ${e}`, shipped.edges.has(e));

// ── 3. Every LEGAL edge is allowed by isLegalGoalTransition + assert does NOT throw. ──────────────────────
console.log("\n[3] every LEGAL edge is allowed (fail-open on the whitelist only)");
for (const e of shipped.edges) {
  const [from, to] = e.split("->") as [GoalState, GoalState];
  // resume edges (SUSPENDED -> X) need the prev_state context; every other edge needs none.
  const ctx = from === "SUSPENDED" ? { prevState: to } : {};
  let allowed = isLegalGoalTransition(from, to, ctx);
  if (allowed) {
    try {
      assertLegalGoalTransition(from, to, ctx);
    } catch {
      allowed = false;
    }
  }
  check(`allow ${from} -> ${to}`, allowed);
}

// ── 4. Every ILLEGAL change-edge (the full Cartesian complement) is REFUSED + assert throws. ──────────────
console.log("\n[4] every ILLEGAL change-edge is refused (fail-closed)");
let illegalChecked = 0;
for (const from of GOAL_STATES) {
  for (const to of GOAL_STATES) {
    if (from === to) continue; // same-state writes are allowed (not a change edge)
    if (shipped.edges.has(`${from}->${to}`)) continue; // skip the legal ones
    illegalChecked++;
    // give the resume context the BENEFIT of the doubt (prev_state = to) — an illegal edge must STILL refuse.
    const ctx = from === "SUSPENDED" ? { prevState: to } : {};
    let refused = !isLegalGoalTransition(from, to, ctx);
    let threw = false;
    try {
      assertLegalGoalTransition(from, to, ctx);
    } catch (e) {
      threw = e instanceof IllegalGoalTransitionError;
    }
    check(`refuse ${from} -> ${to}`, refused && threw);
  }
}
check(
  "illegal-edge coverage is the full complement",
  illegalChecked === GOAL_STATES.length * GOAL_STATES.length - GOAL_STATES.length - shipped.edges.size,
  `${illegalChecked} illegal change-edges`,
);

// ── 5. Catastrophic edges the founder/critic care about are explicitly refused. ──────────────────────────
console.log("\n[5] catastrophic edges explicitly refused");
const catastrophic: ReadonlyArray<readonly [GoalState, GoalState]> = [
  ["EXECUTING", "DONE"], // skipping REVIEWING to fake completion
  ["PLANNING", "DONE"], // completing without executing
  ["CREATED", "DONE"], // skipping the whole lifecycle
  ["CREATED", "EXECUTING"], // skipping feasibility + planning
  ["ACTIVE", "EXECUTING"], // skipping planning
  ["DONE", "EXECUTING"], // un-completing a finished goal
  ["DONE", "PLANNING"], // resurrecting a terminal success
  ["FAILED", "EXECUTING"], // resurrecting a terminal failure
  ["FAILED", "REVIEWING"],
  ["CLOSED", "PLANNING"], // resurrecting a closed goal
  ["FEASIBILITY", "EXECUTING"], // skipping ACTIVE + PLANNING
];
for (const [from, to] of catastrophic)
  check(`refuse catastrophic ${from} -> ${to}`, !isLegalGoalTransition(from, to, { prevState: to }));

// ── 6. GUARD semantics — the prev_state predicates (not just the coarse edge set) match the trigger. ──────
console.log("\n[6] prev_state guard semantics (resume target must equal the captured prev_state)");
check("resume SUSPENDED->ACTIVE legal when prev_state=ACTIVE", isLegalGoalTransition("SUSPENDED", "ACTIVE", { prevState: "ACTIVE" }));
check("resume SUSPENDED->ACTIVE ILLEGAL when prev_state=PLANNING", !isLegalGoalTransition("SUSPENDED", "ACTIVE", { prevState: "PLANNING" }));
check("resume SUSPENDED->ACTIVE ILLEGAL when prev_state absent", !isLegalGoalTransition("SUSPENDED", "ACTIVE", {}));
check("resume SUSPENDED->DONE ILLEGAL (DONE not a resumable target)", !isLegalGoalTransition("SUSPENDED", "DONE", { prevState: "DONE" as GoalState }));
check("suspend EXECUTING->SUSPENDED legal", isLegalGoalTransition("EXECUTING", "SUSPENDED"));
check("suspend SUSPENDED->SUSPENDED is a no-op write (same-state) not a re-suspend edge", !tsEdges.has("SUSPENDED->SUSPENDED"));
check("ANY non-terminal -> FAILED legal (CREATED->FAILED)", isLegalGoalTransition("CREATED", "FAILED"));
check("terminal has no outgoing (DONE->PLANNING illegal)", !isLegalGoalTransition("DONE", "PLANNING"));
check("RESUMABLE_GOAL_STATES matches the trigger prev_state CHECK", RESUMABLE_GOAL_STATES.slice().sort().join(",") === shipped.resumable.slice().sort().join(","));

// ── 7. PROVENANCE cross-check — the shipped DDL has not drifted from admin's canonical 0053. ──────────────
console.log("\n[7] provenance: shipped DDL == admin's canonical 0053 trigger (if reachable)");
if (existsSync(adminSqlPath)) {
  const admin = parseTrigger(readFileSync(adminSqlPath, "utf8"));
  check("admin 0053 expands to 34 edges", admin.edges.size === 34, `admin=${admin.edges.size}`);
  check("admin edge count == shipped edge count", admin.edges.size === shipped.edges.size);
  let drift = 0;
  for (const e of admin.edges) if (!shipped.edges.has(e)) drift++;
  for (const e of shipped.edges) if (!admin.edges.has(e)) drift++;
  check("ZERO drift between shipped DDL and admin 0053", drift === 0, `drift=${drift} edges`);
  check("admin terminal set == shipped terminal set", admin.terminal.slice().sort().join(",") === shipped.terminal.slice().sort().join(","));
} else {
  console.log(`  SKIP  admin 0053 not reachable (${adminSqlPath}) — core TS⇄shipped-DDL proof above still ran in full`);
}

// ── verdict ──────────────────────────────────────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? "PINNED — TS validator and the §4.3 DB trigger describe the SAME machine (exit 0)" : `BROKEN — ${failures} assertion(s) failed (exit 1)`}`);
process.exit(failures === 0 ? 0 : 1);
