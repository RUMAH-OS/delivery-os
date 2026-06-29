#!/usr/bin/env node
// =============================================================================
// Delivery OS — Readiness SHADOW gate. RS-DOS §57.5. Sprint 1.3.
// =============================================================================
// The thin binding that makes config/secret READINESS a NAMED precondition of the
// three existing gates — C9 Pre-flight · D7 Deploy · C13 Startup (§57.5) — WITHOUT
// yet blocking anything. Given a gate + the capabilities a goal/work-package uses +
// a target env, it:
//
//   1. resolves the required keys     (capability-config-resolver.mjs, §57.3)
//   2. asks the readiness oracle       (i-config.mjs, §57.4 — REUSED, not reimplemented)
//   3. LOGS the gate-appropriate readiness verdict to the founder audit sink.
//
// ───────────────────────────────────────────────────────────────────────────
// SHADOW / REPORT-ONLY — THE LOAD-BEARING CONSTRAINT OF THIS SLICE.
//   The default posture NEVER blocks. Whatever the verdict (MISSING/INVALID/
//   DRIFTED included), exit code is 0 and the live engine is NEVER failed closed.
//   This is the "build, do not enforce" slice (DEV-RELEASE-BLUEPRINT): the Runtime
//   now KNOWS and DETECTS its readiness, but the gates still pass.
//
//   --enforce exists ONLY to PROVE the fail-closed CAPABILITY is wired (exit 1 on a
//   blocking verdict). It is OFF by default and prints a loud banner that the
//   enforce-FLIP is a separately-gated event (Sprint 2.2 proving ground) — turning
//   it on for the live engine is OUT OF SCOPE here and forbidden by this slice.
// ───────────────────────────────────────────────────────────────────────────
//
// Per gate (§57.5), the SAME verdict drives a different stated consequence (logged,
// not taken, in shadow):
//   C9  pre-flight   — a goal whose required config is MISSING/INVALID is statically
//                      UNREACHABLE → would HALT(config-missing FAP) at hour 0.
//   D7  deploy       — promotion to the env would be FAIL-CLOSED on any MISSING/INVALID.
//   C13 startup      — before the FIRST dispatch, would HALT-AND-SUMMON rather than
//                      spawn an agent into a mis-configured env.
//
// USAGE:
//   node readiness-shadow.mjs --gate <C9|D7|C13> --caps <id|file>[,...] --env <env>
//        [--registry <path>] [--caps-dir <path>] [--enforce] [--json] [--self-test] [-h]
//
// EXIT: 0 ALWAYS in shadow (default). With --enforce: 0 ready · 1 a required key
//   MISSING/INVALID (capability proof only) · 2 = harness error.
// Zero runtime dependencies (Node >= 18 built-ins only).
// =============================================================================

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESOLVER = resolve(HERE, "capability-config-resolver.mjs");
const ORACLE = resolve(HERE, "i-config.mjs");
const BLOCKING = new Set(["MISSING", "INVALID"]); // the §57.4 blocking verdicts (DRIFTED surfaced, not blocking by default)

const GATE_META = {
  C9: { name: "C9 Pre-flight (reachability)", shadow_action: "would HALT(config-missing FAP) at hour 0 — goal statically unreachable", spec: "§7.3 / §57.5" },
  D7: { name: "D7 Deploy (state invariant)", shadow_action: "would FAIL-CLOSED on promotion to this env — deploy blocked until required config is PRESENT/valid", spec: "§11 / §57.5" },
  C13: { name: "C13 Startup (startup invariant)", shadow_action: "would HALT-AND-SUMMON before the first dispatch — refuses to spawn an agent into a mis-configured env", spec: "§7.1 / §57.5" },
};

// --- arg parsing -------------------------------------------------------------
function parseArgs(argv) {
  const o = { gate: null, caps: [], env: null, registry: null, capsDir: null, enforce: false, json: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--gate") o.gate = String(argv[++i] || "").toUpperCase();
    else if (a === "--caps") o.caps = String(argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--env") o.env = argv[++i];
    else if (a === "--registry") o.registry = argv[++i];
    else if (a === "--caps-dir") o.capsDir = argv[++i];
    else if (a === "--enforce") o.enforce = true;
    else if (a === "--json") o.json = true;
    else if (a === "--self-test") o.selfTest = true;
    else if (a === "-h" || a === "--help") { process.stdout.write(usage()); process.exit(0); }
    else { process.stderr.write(`readiness-shadow: unknown flag "${a}" (try --help)\n`); process.exit(2); }
  }
  return o;
}
function usage() {
  return (
    "readiness-shadow — config/secret readiness as a SHADOW precondition of C9/D7/C13 (RS-DOS §57.5).\n\n" +
    "  node readiness-shadow.mjs --gate <C9|D7|C13> --caps <id|file>[,...] --env <env>\n" +
    "       [--registry <path>] [--caps-dir <path>] [--enforce] [--json] [--self-test]\n\n" +
    "SHADOW / report-only: exit 0 ALWAYS — never blocks the live engine. --enforce ONLY proves the\n" +
    "fail-closed capability (exit 1 on MISSING/INVALID); the enforce-FLIP is gated to Sprint 2.2 (out of scope).\n"
  );
}
function fail(code, msg) { process.stderr.write(`readiness-shadow: ${msg}\n`); process.exit(code); }

// =============================================================================
// PURE CORE — the shadow verdict given required keys + an oracle report.
// Self-test drives this directly with an injected oracle report (no child procs).
// =============================================================================

// `requiredKeys` = string[] (the resolver's required_keys for this env).
// `oracleReport` = the i-config JSON report ({ keys:[{key,state,...}], drift:[...] }).
// Returns the shadow verdict — what each gate WOULD do, and whether it blocks (only
// asserted under --enforce; in shadow `would_block` is computed but never acted on).
function evaluateReadiness(gate, env, requiredKeys, oracleReport) {
  const meta = GATE_META[gate] || { name: gate, shadow_action: "(unknown gate)", spec: "?" };
  const byKey = new Map((oracleReport.keys || []).map((k) => [k.key, k]));
  const perKey = [];
  for (const key of requiredKeys) {
    const row = byKey.get(key);
    if (!row) {
      // The capability requires a key the oracle/registry never evaluated → treat as
      // a readiness UNKNOWN (a gap, surfaced — it is NOT silently treated as ready).
      perKey.push({ key, state: "UNKNOWN", detail: "required by a capability but not present in the registry/oracle report (registry gap)" });
      continue;
    }
    perKey.push({ key, state: row.state, lane: row.lane, detail: row.detail, data_class: row.data_class });
  }
  const blocking = perKey.filter((r) => BLOCKING.has(r.state) || r.state === "UNKNOWN");
  const drifted = perKey.filter((r) => r.state === "DRIFTED");
  const ready = blocking.length === 0;
  return {
    gate, gate_name: meta.name, spec: meta.spec, env,
    posture: "SHADOW (report-only — never blocks; §57.5 enforce-flip gated to Sprint 2.2)",
    required_keys: requiredKeys,
    per_key: perKey,
    ready,
    would_block: !ready,
    would_block_on: blocking.map((b) => `${b.key} [${b.state}]`),
    drifted: drifted.map((d) => `${d.key} [DRIFTED]`),
    shadow_action: ready ? "no action — every required key PRESENT/valid" : `IN ENFORCE MODE: ${meta.shadow_action}`,
  };
}

// The founder audit / boundary sink record (one structured line per gate evaluation).
function shadowAuditRecord(verdict) {
  return {
    sink: "founder-audit",
    kind: "readiness-shadow",
    ts: new Date().toISOString(),
    gate: verdict.gate,
    env: verdict.env,
    ready: verdict.ready,
    would_block: verdict.would_block,
    would_block_on: verdict.would_block_on,
    drifted: verdict.drifted,
    posture: verdict.posture,
    note: "SHADOW: logged, not enforced. The live engine was NOT failed closed by this evaluation.",
  };
}

// =============================================================================
// CLI reuse of the resolver + oracle (child processes — never reimplemented).
// =============================================================================
function runResolver(opts) {
  const args = [RESOLVER, "--caps", opts.caps.join(","), "--json"];
  if (opts.env) args.push("--env", opts.env);
  if (opts.registry) args.push("--registry", opts.registry);
  if (opts.capsDir) args.push("--caps-dir", opts.capsDir);
  let out;
  try { out = execFileSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { fail(2, `resolver failed: ${e.stderr || e.message}`); }
  try { return JSON.parse(out); } catch (e) { fail(2, `resolver did not return JSON: ${e.message}`); }
}

function runOracle(opts) {
  // ALWAYS report-only when called as a child (the SHADOW binding owns the enforce
  // decision; the oracle just reports verdicts). We pass --include-local so a local
  // value can be validated where the remote planes are unreadable.
  const args = [ORACLE, "--json", "--include-local"];
  if (opts.env) args.push("--env", opts.env);
  if (opts.registry) args.push("--registry", opts.registry);
  let out;
  try { out = execFileSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) {
    // The oracle is report-only (exit 0); a non-zero here is a harness/registry error.
    fail(2, `oracle failed: ${e.stderr || e.message}`);
  }
  try { return JSON.parse(out); } catch (e) { fail(2, `oracle did not return JSON: ${e.message}`); }
}

// =============================================================================
// Run.
// =============================================================================
function run(opts) {
  if (!opts.gate || !GATE_META[opts.gate]) fail(2, "pass --gate <C9|D7|C13>");
  if (!opts.caps.length) fail(2, "pass --caps <id|file>[,...]");
  if (!opts.env) fail(2, "pass --env <local|dev|QA|staging|prod>");
  if (opts.registry && !existsSync(abs(opts.registry))) fail(2, `registry not found: ${opts.registry}`);

  const resolved = runResolver(opts);
  const oracle = runOracle(opts);
  const verdict = evaluateReadiness(opts.gate, opts.env, resolved.required_keys, oracle);
  const audit = shadowAuditRecord(verdict);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ verdict, audit, resolver_issues: resolved.issues || [] }, null, 2) + "\n");
  } else {
    printHuman(verdict, resolved, opts);
  }

  // ── SHADOW: never block. Exit 0 regardless of verdict. ────────────────────
  if (!opts.enforce) process.exit(0);

  // ── --enforce: PROVE the fail-closed capability only. Loud banner. ─────────
  process.stderr.write(
    "\n*** readiness-shadow --enforce: CAPABILITY PROOF ONLY ***\n" +
    "    This exit code proves fail-closed is WIRED. It does NOT enable enforcement for the\n" +
    "    live engine. The enforce-FLIP is a separately-gated event (Sprint 2.2 proving ground).\n\n"
  );
  process.exit(verdict.would_block ? 1 : 0);
}

function printHuman(verdict, resolved, opts) {
  const L = (s = "") => process.stdout.write(s + "\n");
  L("");
  L(`readiness-shadow — ${verdict.gate_name}  [env=${verdict.env}]  (${verdict.spec})`);
  L(`posture: ${verdict.posture}`);
  L(`caps:    ${resolved.capabilities.join(", ")}`);
  L("");
  const icon = { PRESENT: "OK ", MISSING: "XX ", INVALID: "XX ", DRIFTED: ">> ", UNKNOWN: "?? ", "OPTIONAL-ABSENT": " . " };
  if (!verdict.per_key.length) L("  (this capability set requires no config/secret for this env)");
  for (const k of verdict.per_key) {
    L(`  ${icon[k.state] || "?  "}${String(k.state).padEnd(16)} ${k.key}${k.data_class ? `  (${k.data_class})` : ""}`);
    if (BLOCKING.has(k.state) || k.state === "UNKNOWN" || k.state === "DRIFTED") L(`        ${k.detail || ""}`);
  }
  L("");
  L(`readiness: ${verdict.ready ? "READY" : "NOT READY"}`);
  if (verdict.would_block) L(`would-block-on: ${verdict.would_block_on.join(", ")}`);
  if (verdict.drifted.length) L(`drifted (surfaced, non-blocking): ${verdict.drifted.join(", ")}`);
  L(`shadow-action: ${verdict.shadow_action}`);
  L("");
  L(verdict.ready
    ? `RESULT: gate ${verdict.gate} would PASS. (Shadow — logged, the engine is not gated either way this sprint.)`
    : `RESULT: gate ${verdict.gate} would BLOCK in enforce mode — but THIS IS SHADOW: the engine was NOT blocked. ${opts.enforce ? "(--enforce: exit 1 follows as a capability proof only.)" : "(exit 0.)"}`);
  L("");
}

function abs(p) { return isAbsolute(p) ? p : resolve(process.cwd(), p); }

// =============================================================================
// Self-test — offline proof of the SHADOW contract (no child procs / network).
// THE CENTRAL PROOF: a MISSING required key is DETECTED + LOGGED, and in shadow
// the evaluation does NOT block (would_block is computed but the run exits 0).
// =============================================================================
function selfTest() {
  const cases = [];
  const assert = (name, cond) => cases.push({ name, ok: !!cond });

  // An oracle report fixture: DATABASE_URL PRESENT, VERCEL_TOKEN MISSING, PUBLIC_BASE_URL DRIFTED.
  const oracleReport = {
    keys: [
      { key: "DATABASE_URL", state: "PRESENT", data_class: "SECRET", lane: "vercel-prod", detail: "set in Vercel." },
      { key: "VERCEL_TOKEN", state: "MISSING", data_class: "SECRET", lane: "github-secret", detail: "required for this env but not set." },
      { key: "PUBLIC_BASE_URL", state: "DRIFTED", data_class: "INTERNAL", lane: "vercel-prod", detail: "present where the registry does not scope it." },
    ],
    drift: [],
  };
  const required = ["DATABASE_URL", "VERCEL_TOKEN", "PUBLIC_BASE_URL"];

  // (1) The central shadow proof: a MISSING required key is DETECTED, and the gate
  //     would_block — but this is computed, NOT acted on (shadow exits 0; see run()).
  const d7 = evaluateReadiness("D7", "prod", required, oracleReport);
  assert("MISSING required key is DETECTED (not ready)", d7.ready === false);
  assert("the missing key is named in would_block_on", d7.would_block_on.some((s) => /VERCEL_TOKEN \[MISSING\]/.test(s)));
  assert("DRIFTED key is surfaced separately, NOT in the blocking set", d7.drifted.some((s) => /PUBLIC_BASE_URL/.test(s)) && !d7.would_block_on.some((s) => /PUBLIC_BASE_URL/.test(s)));
  assert("posture is explicitly SHADOW/report-only", /SHADOW \(report-only/.test(d7.posture));

  // (2) The audit record proves the non-block guarantee in the log itself.
  const audit = shadowAuditRecord(d7);
  assert("audit record carries the non-block guarantee note", /was NOT failed closed/.test(audit.note));
  assert("audit record sink is the founder boundary", audit.sink === "founder-audit");
  assert("audit record is JSON-serializable", typeof JSON.stringify(audit) === "string");

  // (3) Each gate states its own would-do action (C9 halt / D7 deploy-block / C13 summon).
  const c9 = evaluateReadiness("C9", "prod", required, oracleReport);
  const c13 = evaluateReadiness("C13", "prod", required, oracleReport);
  assert("C9 shadow-action is the hour-0 HALT", /HALT\(config-missing FAP\)/.test(c9.shadow_action));
  assert("D7 shadow-action is the deploy fail-closed", /FAIL-CLOSED on promotion/.test(d7.shadow_action));
  assert("C13 shadow-action is halt-and-summon", /HALT-AND-SUMMON/.test(c13.shadow_action));

  // (4) The all-present path: gate would PASS.
  const allPresent = { keys: [{ key: "DATABASE_URL", state: "PRESENT" }, { key: "VERCEL_TOKEN", state: "PRESENT" }], drift: [] };
  const ready = evaluateReadiness("D7", "prod", ["DATABASE_URL", "VERCEL_TOKEN"], allPresent);
  assert("all-PRESENT required keys → ready, would NOT block", ready.ready === true && ready.would_block === false);

  // (5) A required key the oracle never evaluated → UNKNOWN, treated as blocking (a
  //     registry gap is NOT silently treated as ready — fail-closed-by-default semantics).
  const gap = evaluateReadiness("D7", "prod", ["NEVER_DECLARED"], { keys: [], drift: [] });
  assert("a required key absent from the oracle report → UNKNOWN + would_block (not silently ready)", gap.ready === false && gap.would_block_on.some((s) => /NEVER_DECLARED \[UNKNOWN\]/.test(s)));

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "PASS" : "FAIL"}  ${c.name}\n`);
  process.stdout.write(`\nreadiness-shadow self-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// Exported for verifier harnesses (import-safe — entrypoint only runs as CLI).
export { evaluateReadiness, shadowAuditRecord };

// --- entrypoint (CLI only) ---------------------------------------------------
const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.selfTest) selfTest();
  else run(opts);
}
