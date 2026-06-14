#!/usr/bin/env node
// Delivery OS — the standing AUDITED DEPLOY LANE (OS v6 #7). Zero-dep, node ESM.
//
// Removes the per-deploy founder authorization dance (FV-3): the founder ratifies
// `.deploy-lane.json` + adds the matching settings allow-rules ONCE; thereafter the
// deployment-operator agent runs IN-SCOPE deploys/forward-migrations through this wrapper
// with NO per-action prompt, and every action is appended to the audit log. Anything not
// declared in the lane is REFUSED (fail-closed, non-zero exit).
//
// USAGE:
//   node deploy-lane.mjs <action-class> [extra args...]   run an in-scope action (audited)
//   node deploy-lane.mjs <action-class> --plan            print what WOULD run; execute nothing
//   node deploy-lane.mjs --list                           list ratified action classes
//
// EXIT: 0 = ok / plan printed.  Non-zero = refused (out of scope / unratified / guard hit) or
//       the underlying command failed (honest failure — the audit records the real result).
//
// The lane file is the single source of truth. This wrapper NEVER widens scope and has no
// override flag for an out-of-scope action — on purpose.

import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { argv, exit, env, cwd } from "node:process";

const ROOT = cwd();
const LANE_PATH = join(ROOT, ".deploy-lane.json");

function die(msg, code = 1) { console.error(msg); exit(code); }

// --- load + sanity-check the ratified lane ---------------------------------
if (!existsSync(LANE_PATH))
  die(`REFUSED: no .deploy-lane.json at ${LANE_PATH}. Ratify the deploy lane once (docs/deploy-lane-setup.md) before any deploy.`);

let lane;
try { lane = JSON.parse(readFileSync(LANE_PATH, "utf8")); }
catch (e) { die(`REFUSED: .deploy-lane.json is not valid JSON (${e.message}). Fix + re-ratify; fail-closed.`); }

const actions = lane.actions || {};
const guards = lane.guards?.deny_substrings || [];
const actor = env.DEPLOY_ACTOR || lane.actor_default || "unknown";
const auditPath = resolve(ROOT, lane.audit_log || "docs/deploy-lane/audit.log.jsonl");

// --- audit: structured, append-only JSONL ----------------------------------
function audit(rec) {
  const line = JSON.stringify({ ts: new Date().toISOString(), actor, ...rec });
  try {
    mkdirSync(dirname(auditPath), { recursive: true });
    appendFileSync(auditPath, line + "\n", "utf8");
  } catch (e) {
    // An audit that cannot be written must not let a silent deploy proceed.
    die(`REFUSED: could not write audit log at ${auditPath} (${e.message}). No unaudited deploys.`);
  }
  return line;
}

// --- args ------------------------------------------------------------------
const args = argv.slice(2);
if (args.length === 0 || args[0] === "--help" || args[0] === "-h")
  die("USAGE: deploy-lane.mjs <action-class> [args...] | <action-class> --plan | --list", 0);

if (args[0] === "--list") {
  const ratified = lane.ratified?.by ? `ratified by ${lane.ratified.by} (${lane.ratified.date || "?"})` : "NOT RATIFIED (by is empty) — every action is out of scope until ratified";
  console.log(`deploy lane: ${ratified}`);
  console.log(`audit log:   ${lane.audit_log}`);
  console.log("action classes:");
  for (const [name, a] of Object.entries(actions)) {
    if (name === "_comment") continue;
    console.log(`  - ${name}: ${[a.cmd, ...(a.args || [])].join(" ")}  -> ${(a.targets || []).join(", ")}${a.forward_only ? "  [forward-only]" : ""}`);
  }
  exit(0);
}

const action = args[0];
const isPlan = args.includes("--plan");
const extra = args.slice(1).filter((a) => a !== "--plan");

// --- fail-closed scope checks ----------------------------------------------
// 1) lane must be ratified (standing authorization actually granted).
if (!lane.ratified || !lane.ratified.by) {
  audit({ action, args: extra, kind: "refused", reason: "lane-not-ratified", result: "refused" });
  die(`REFUSED: .deploy-lane.json is not ratified (ratified.by is empty). The founder must ratify the lane once (decision-ratification) before the operator may deploy. Out-of-scope ⇒ explicit human yes.`);
}

// 2) action class must be declared.
const spec = actions[action];
if (!spec || action === "_comment") {
  audit({ action, args: extra, kind: "refused", reason: "action-not-in-scope", result: "refused" });
  die(`REFUSED: "${action}" is not a ratified action class in this lane. Known: ${Object.keys(actions).filter((k) => k !== "_comment").join(", ") || "(none)"}. Out-of-scope actions still require an explicit human yes (fail-closed).`);
}

// 3) build the concrete command and run the irreversible/destructive guard.
const cmd = spec.cmd;
const fullArgs = [...(spec.args || []), ...extra];
const rendered = [cmd, ...fullArgs].join(" ");
const guardHit = guards.find((g) => rendered.toLowerCase().includes(g.toLowerCase()));
if (guardHit) {
  audit({ action, args: extra, kind: "refused", reason: `guard:${guardHit}`, command: rendered, result: "refused" });
  die(`REFUSED: command "${rendered}" matches the irreversible/destructive guard "${guardHit}". Never in any lane — requires an explicit human yes.`);
}

// --- plan (dry-run): print intent, execute nothing -------------------------
if (isPlan) {
  console.log(`PLAN (no execution):`);
  console.log(`  action class : ${action}${spec.forward_only ? "  [forward-only]" : ""}`);
  console.log(`  would run    : ${rendered}`);
  console.log(`  targets      : ${(spec.targets || []).join(", ") || "(none declared)"}`);
  console.log(`  actor        : ${actor}`);
  console.log(`  audit log    : ${lane.audit_log}`);
  audit({ action, args: extra, kind: "plan", command: rendered, result: "planned" });
  exit(0);
}

// --- execute the in-scope action (NO per-action prompt) ---------------------
console.log(`deploy-lane: in-scope action "${action}" — running: ${rendered}`);
const started = audit({ action, args: extra, kind: "execute", command: rendered, result: "started" });
console.log(`audit (start): ${started}`);

const run = spawnSync(cmd, fullArgs, { stdio: "inherit", shell: false });
const ok = run.status === 0 && !run.error;
const finished = audit({
  action, args: extra, kind: "execute", command: rendered,
  result: ok ? "success" : "failure",
  exit_code: run.status ?? null,
  error: run.error ? String(run.error.message || run.error) : null,
});
console.log(`audit (end):   ${finished}`);

if (!ok) die(`deploy-lane: action "${action}" FAILED (exit ${run.status ?? "?"}${run.error ? ", " + run.error.message : ""}). See audit log + the playbook (deploy-vercel-supabase).`, run.status || 1);
console.log(`deploy-lane: "${action}" succeeded. Run the smoke battery (deploy ≠ done — deploy-vercel-supabase).`);
exit(0);
