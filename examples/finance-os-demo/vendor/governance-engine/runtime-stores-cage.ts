// Governance Engine — the C12 RuntimeStores invariant CAGE (the slice-2 analogue of the §4.3 golden-master).
//
// THE LOAD-BEARING DELIVERABLE for slice 2. This cage pins the C12 store invariants that the in-memory
// `RuntimeStoresPort` adapter MUST honor against the 0052 DDL that enforces them in Postgres — so an organ (the
// Goal Supervisor) behaves identically off Postgres. Two kinds of invariant, handled two ways:
//
//   (1) APPEND-ONLY (goal_delta_ledger · attempt_ledger · dead_letter · portfolio_cost_ledger) — STRUCTURAL.
//       The 0052 `c12_append_only_guard` BEFORE UPDATE OR DELETE trigger forbids mutation for every role. In the
//       PORT this is structural: the interface exposes ONLY an append + read method for each of these stores —
//       there is NO update/delete method to call. The cage proves (a) the DDL attaches the append-only trigger
//       to exactly those four tables and grants no UPDATE/DELETE RLS policy on them, AND (b) the in-memory
//       adapter has NO mutation path — a re-append is a no-op/throw, never an overwrite; history only grows.
//
//   (2) NON-STRUCTURAL (the two MUTABLE stores) — proven BEHAVIORALLY against the adapter, mirroring the cage:
//       * idempotency_store WRITE-ONCE (`c12_idempotency_guard`): a consumed key can never be re-consumed; a
//         reserve is a PK race (exactly one winner).
//       * circuit_breaker DURABLE COOLDOWN: closed→open at the threshold with a cooldown; open→half_open ONLY
//         once the cooldown elapses; close resets. (A `now()` injectable makes the cooldown deterministic.)
//
// It GENUINELY PARSES the 0052 DDL — it does not hard-code an assumed shape. Path resolution mirrors the §4.3
// cage: default = the shipped `./migrations/0002_runtime_durable_stores.sql` (always present → the core proof
// always runs); optional provenance cross-check against admin's real `0052_runtime_durable_stores.sql`.
//
// Zero DB required. Run:  tsx runtime-stores-cage.ts   ·   exit 0 = PINNED · exit 1 = an invariant drifted.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInMemoryRuntimeStores } from "./scripts/in-memory-store.js";

const here = dirname(fileURLToPath(import.meta.url));
const shippedSqlPath =
  process.env.GOVERNANCE_RUNTIME_STORES_SQL ?? join(here, "migrations", "0002_runtime_durable_stores.sql");
const adminSqlPath =
  process.env.ADMIN_RUNTIME_STORES_SQL ?? join(here, "..", "..", "..", "rumah-admin", "migrations", "0052_runtime_durable_stores.sql");

const APPEND_ONLY_STORES = ["goal_delta_ledger", "attempt_ledger", "dead_letter", "portfolio_cost_ledger"];
const MUTABLE_STORES = ["circuit_breaker", "idempotency_store"];

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`);
  else {
    console.error(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
    failures++;
  }
}

// ── The 0052 parser — reconstructs the C12 invariant SHAPE from the SQL text (genuine parse). ──────────────
interface ParsedStores {
  tables: string[];
  appendOnlyTriggerTables: string[];       // tables with a BEFORE UPDATE OR DELETE → c12_append_only_guard trigger
  idempotencyGuardTables: string[];        // tables with the BEFORE UPDATE → c12_idempotency_guard trigger
  appendGuardRaises: boolean;              // c12_append_only_guard RAISES (the immutability enforcement)
  idempotencyWriteOnce: boolean;           // c12_idempotency_guard enforces consumed_at write-once
  idempotencyImmutableCols: boolean;       // c12_idempotency_guard pins key/created_at/ttl/expires_at immutable
  breakerStates: string[];                 // circuit_breaker_state_chk allowed states
  uniqueIndexes: Record<string, string>;   // table -> the unique-index column list
  mutatingPolicyOnAppendOnly: string[];    // any UPDATE/DELETE RLS policy on an append-only store (must be EMPTY)
}

function parseStores(sql: string): ParsedStores {
  const tables = [...sql.matchAll(/CREATE TABLE (\w+)/g)].map((m) => m[1]);

  const appendOnlyTriggerTables = [
    ...sql.matchAll(/CREATE TRIGGER \w+\s+BEFORE UPDATE OR DELETE ON (\w+)\s+FOR EACH ROW EXECUTE FUNCTION c12_append_only_guard\(\)/g),
  ].map((m) => m[1]);

  const idempotencyGuardTables = [
    ...sql.matchAll(/CREATE TRIGGER \w+\s+BEFORE UPDATE ON (\w+)\s+FOR EACH ROW EXECUTE FUNCTION c12_idempotency_guard\(\)/g),
  ].map((m) => m[1]);

  // isolate the two guard FUNCTION bodies (so we parse the enforcement, not the prose header).
  const appendFn = sql.match(/CREATE OR REPLACE FUNCTION c12_append_only_guard\(\) RETURNS trigger AS \$\$([\s\S]*?)\$\$ LANGUAGE plpgsql;/);
  const appendGuardRaises = !!appendFn && /RAISE EXCEPTION/.test(appendFn[1]) && /history is immutable/.test(appendFn[1]);

  const idemFn = sql.match(/CREATE OR REPLACE FUNCTION c12_idempotency_guard\(\) RETURNS trigger AS \$\$([\s\S]*?)\$\$ LANGUAGE plpgsql;/);
  const idemBody = idemFn ? idemFn[1] : "";
  const idempotencyWriteOnce = /OLD\.consumed_at IS NOT NULL\s+AND\s+NEW\.consumed_at IS DISTINCT FROM OLD\.consumed_at/.test(idemBody);
  const idempotencyImmutableCols =
    /NEW\.idempotency_key <> OLD\.idempotency_key/.test(idemBody) &&
    /NEW\.created_at\s+<> OLD\.created_at/.test(idemBody) &&
    /NEW\.ttl_seconds\s+<> OLD\.ttl_seconds/.test(idemBody) &&
    /NEW\.expires_at\s+<> OLD\.expires_at/.test(idemBody);

  const breakerM = sql.match(/circuit_breaker_state_chk CHECK \(breaker_state IN \(([^)]*)\)\)/);
  const breakerStates = breakerM ? breakerM[1].split(",").map((s) => s.trim().replace(/^'/, "").replace(/'$/, "")).filter(Boolean) : [];

  const uniqueIndexes: Record<string, string> = {};
  for (const m of sql.matchAll(/CREATE UNIQUE INDEX \w+\s+ON (\w+)\(([^)]*)\)/g)) {
    uniqueIndexes[m[1]] = m[2].replace(/\s+/g, " ").trim();
  }

  // any UPDATE/DELETE RLS policy targeting an append-only store is a drift (it would re-open mutation).
  const mutatingPolicyOnAppendOnly: string[] = [];
  for (const m of sql.matchAll(/CREATE POLICY \w+ ON (\w+) FOR (UPDATE|DELETE)/g)) {
    if (APPEND_ONLY_STORES.includes(m[1])) mutatingPolicyOnAppendOnly.push(`${m[1]}:${m[2]}`);
  }

  return {
    tables,
    appendOnlyTriggerTables,
    idempotencyGuardTables,
    appendGuardRaises,
    idempotencyWriteOnce,
    idempotencyImmutableCols,
    breakerStates,
    uniqueIndexes,
    mutatingPolicyOnAppendOnly,
  };
}

console.log("governance-engine runtime-stores cage — C12 store invariants (in-memory adapter ⇄ 0052 DDL)\n");

// ── 1. Parse the shipped 0052 DDL and prove the invariant shape is structurally complete. ─────────────────
console.log(`[1] parse the shipped C12 DDL  (${shippedSqlPath})`);
if (!existsSync(shippedSqlPath)) {
  console.error(`  FAIL  shipped C12 DDL not found at ${shippedSqlPath}`);
  process.exit(1);
}
const shipped = parseStores(readFileSync(shippedSqlPath, "utf8"));
check("six C12 tables present", shipped.tables.length === 6, `tables=${shipped.tables.join(",")}`);
check("the 4 append-only stores all carry the append-only guard trigger",
  APPEND_ONLY_STORES.every((t) => shipped.appendOnlyTriggerTables.includes(t)) && shipped.appendOnlyTriggerTables.length === 4,
  `triggered=${shipped.appendOnlyTriggerTables.join(",")}`);
check("the 2 MUTABLE stores carry NO append-only trigger", MUTABLE_STORES.every((t) => !shipped.appendOnlyTriggerTables.includes(t)));
check("append-only guard RAISES (history is immutable)", shipped.appendGuardRaises);
check("idempotency_store carries the write-once guard trigger", shipped.idempotencyGuardTables.includes("idempotency_store"));
check("idempotency guard enforces consumed_at write-once", shipped.idempotencyWriteOnce);
check("idempotency guard pins key/created_at/ttl/expires_at immutable", shipped.idempotencyImmutableCols);
check("circuit_breaker state CHECK = closed/open/half_open", shipped.breakerStates.slice().sort().join(",") === "closed,half_open,open", `states=${shipped.breakerStates.join(",")}`);
check("goal_delta_ledger idempotent on (goal_id, cycle)", (shipped.uniqueIndexes.goal_delta_ledger ?? "").replace(/\s/g, "") === "goal_id,cycle");
check("attempt_ledger unique on (step_id, attempt)", (shipped.uniqueIndexes.attempt_ledger ?? "").replace(/\s/g, "") === "step_id,attempt");
check("NO UPDATE/DELETE RLS policy on any append-only store (RLS append-only)", shipped.mutatingPolicyOnAppendOnly.length === 0, `offenders=${shipped.mutatingPolicyOnAppendOnly.join(",") || "none"}`);

// ── 2. STRUCTURAL append-only proof: the in-memory adapter has NO mutation path; history only grows. ──────
console.log("\n[2] STRUCTURAL append-only: the RuntimeStoresPort adapter cannot mutate the 4 append-only stores");
// The port surface itself proves it: there is no updateProgressSample / deleteAttempt / mutateDeadLetter /
// editCost method to call. The four append-only stores expose ONLY {append, read}. We prove the behavioral
// consequence: every "re-write" is a no-op or a throw — never an overwrite — and the series only grows.
async function appendOnlyProof() {
  const s = createInMemoryRuntimeStores();
  const g = "11111111-1111-1111-1111-111111111111";

  // goal_delta_ledger: a re-append of a recorded (goal,cycle) is a NO-OP (false); the first value is unchanged.
  const ins1 = await s.appendProgressSample({ goalId: g, cycle: 0, value: 0.5 });
  const ins2 = await s.appendProgressSample({ goalId: g, cycle: 0, value: 0.9 }); // would-be overwrite
  const series = await s.readProgressSeries(g);
  check("goal_delta_ledger: re-append same (goal,cycle) is a no-op, value NOT overwritten",
    ins1 === true && ins2 === false && series.length === 1 && series[0]!.value === 0.5,
    `ins1=${ins1} ins2=${ins2} len=${series.length} v=${series[0]?.value}`);

  // attempt_ledger: a duplicate (step,attempt) THROWS (mirrors 23505) — never silently overwrites history.
  const st = "22222222-2222-2222-2222-222222222222";
  await s.recordAttempt({ stepId: st, attempt: 1, outcome: "flat", goalId: g });
  await s.recordAttempt({ stepId: st, attempt: 2, outcome: "flat", goalId: g });
  let dupThrew = false;
  try { await s.recordAttempt({ stepId: st, attempt: 1, outcome: "progressed", goalId: g }); } catch { dupThrew = true; }
  check("attempt_ledger: duplicate (step,attempt) throws — history not overwritten", dupThrew && (await s.countAttempts(g)) === 2, `count=${await s.countAttempts(g)}`);

  // dead_letter + portfolio_cost_ledger: append-only — each append yields a fresh row; the ledgers only grow.
  await s.recordDeadLetter({ stepId: st, reason: "breaker-exhausted", goalId: g });
  const c1 = await s.appendCost({ goalId: g, costCents: 100 });
  const c2 = await s.appendCost({ goalId: g, costCents: 50 });
  check("portfolio_cost_ledger: cumulative grows monotonically (100 → 150)", c1.cumulativeCostCents === 100 && c2.cumulativeCostCents === 150 && (await s.readCumulativeCost(g)) === 150);

  // The decisive structural fact: there is no method on the port to UPDATE or DELETE any of the four stores.
  // (If one were ever added, residency-guard would still pass but THIS proof's premise would change — the cage
  // would need a new assertion; the no-mutation-method shape is the enforcement.)
  const portMethods = Object.keys(s);
  const forbidden = portMethods.filter((m) => /^(update|delete|edit|mutate|overwrite|remove)/i.test(m));
  check("the RuntimeStoresPort exposes NO update/delete/mutate method", forbidden.length === 0, `methods=${portMethods.join(",")}`);
}

// ── 3. NON-STRUCTURAL: idempotency_store write-once + PK-race (behavioral against the adapter). ────────────
console.log("\n[3] idempotency_store: reserve = PK race (exactly one winner), consume = write-once");
async function idempotencyProof() {
  const s = createInMemoryRuntimeStores();
  const key = "outreach:lead-42:connect";
  const r1 = await s.reserveIntent(key, { scope: "outreach" });
  const r2 = await s.reserveIntent(key, { scope: "outreach" }); // PK race — must lose
  check("reserve PK race: exactly one winner (first reserved, second not)", r1.reserved === true && r2.reserved === false, `r1=${r1.reserved} r2=${r2.reserved}`);
  const con1 = await s.consumeIntent(key);
  const con2 = await s.consumeIntent(key); // write-once — must be a no-op
  check("consume write-once: first consumes, second is a no-op", con1.consumed === true && con2.consumed === false, `c1=${con1.consumed} c2=${con2.consumed}`);
  check("isConsumed stays true after the duplicate consume (cannot un-consume)", (await s.isConsumed(key)) === true);
  check("consuming a never-reserved key is a no-op (false)", (await s.consumeIntent("never-reserved")).consumed === false);
}

// ── 4. NON-STRUCTURAL: circuit_breaker durable cooldown (behavioral, deterministic clock). ─────────────────
console.log("\n[4] circuit_breaker: closed→open at threshold w/ cooldown; open→half_open only after cooldown; close resets");
async function breakerProof() {
  let nowMs = 1_000_000;
  const s = createInMemoryRuntimeStores({ now: () => new Date(nowMs) });
  const step = "33333333-3333-3333-3333-333333333333";

  const f1 = await s.recordFailure(step, { threshold: 3, cooldownMs: 60_000 });
  const f2 = await s.recordFailure(step, { threshold: 3, cooldownMs: 60_000 });
  check("below threshold stays closed (count 1, 2)", f1.breakerState === "closed" && f2.breakerState === "closed" && f2.breakerCount === 2);
  const f3 = await s.recordFailure(step, { threshold: 3, cooldownMs: 60_000 });
  check("at threshold OPENs with a cooldown set", f3.breakerState === "open" && f3.breakerCount === 3 && f3.breakerCooldownUntil != null);

  // cooldown NOT yet elapsed → coolBreaker is a no-op (stays open) — a restart re-reads OPEN, does NOT reset.
  nowMs += 30_000; // < 60s cooldown
  const c0 = await s.coolBreaker(step);
  check("coolBreaker before cooldown elapses is a no-op (stays open)", c0!.breakerState === "open");
  const durable = await s.getBreaker(step);
  check("durable breaker survives 'restart' — still OPEN (count 3)", durable!.breakerState === "open" && durable!.breakerCount === 3);

  // cooldown elapsed → coolBreaker moves OPEN → half_open (a single trial permitted).
  nowMs += 31_000; // now > 60s past the open
  const c1 = await s.coolBreaker(step);
  check("coolBreaker after cooldown elapses → half_open", c1!.breakerState === "half_open");

  // close resets (count 0, cooldown cleared).
  const cl = await s.closeBreaker(step);
  check("closeBreaker resets (closed, count 0, cooldown null)", cl!.breakerState === "closed" && cl!.breakerCount === 0 && cl!.breakerCooldownUntil === null);

  // threshold === 1 opens on the very first failure (the fresh-insert re-open path).
  const s2 = createInMemoryRuntimeStores({ now: () => new Date(2_000_000) });
  const t1 = await s2.recordFailure("44444444-4444-4444-4444-444444444444", { threshold: 1, cooldownMs: 1000 });
  check("threshold=1 opens on the first failure (fresh-insert re-open path)", t1.breakerState === "open" && t1.breakerCooldownUntil != null);
}

// ── 5. PROVENANCE cross-check — the shipped DDL invariant shape == admin's canonical 0052. ────────────────
function provenanceProof() {
  console.log("\n[5] provenance: shipped C12 DDL invariants == admin's canonical 0052 (if reachable)");
  if (!existsSync(adminSqlPath)) {
    console.log(`  SKIP  admin 0052 not reachable (${adminSqlPath}) — core shipped-DDL ⇄ adapter proof above still ran in full`);
    return;
  }
  const admin = parseStores(readFileSync(adminSqlPath, "utf8"));
  check("admin 0052 has the same 6 tables", admin.tables.slice().sort().join(",") === shipped.tables.slice().sort().join(","), `admin=${admin.tables.join(",")}`);
  check("admin append-only trigger set == shipped", admin.appendOnlyTriggerTables.slice().sort().join(",") === shipped.appendOnlyTriggerTables.slice().sort().join(","));
  check("admin idempotency write-once + immutable-cols == shipped", admin.idempotencyWriteOnce === shipped.idempotencyWriteOnce && admin.idempotencyImmutableCols === shipped.idempotencyImmutableCols);
  check("admin breaker states == shipped", admin.breakerStates.slice().sort().join(",") === shipped.breakerStates.slice().sort().join(","));
  check("admin unique indexes == shipped", JSON.stringify(admin.uniqueIndexes) === JSON.stringify(shipped.uniqueIndexes), `admin=${JSON.stringify(admin.uniqueIndexes)}`);
  check("admin grants NO UPDATE/DELETE policy on append-only stores (== shipped)", admin.mutatingPolicyOnAppendOnly.length === 0);
}

async function main() {
  await appendOnlyProof();
  await idempotencyProof();
  await breakerProof();
  provenanceProof();

  console.log(`\n${failures === 0 ? "PINNED — the in-memory RuntimeStoresPort honors the SAME C12 invariants the 0052 DDL enforces (exit 0)" : `BROKEN — ${failures} assertion(s) failed (exit 1)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
