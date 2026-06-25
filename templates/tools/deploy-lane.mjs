#!/usr/bin/env node
// Delivery OS — the standing AUDITED DEPLOY LANE (OS v6 #7). Zero-dep, node ESM.
//
// AUTHORIZATION IS BY SDLC STATE, NOT BY A FOUNDER SIGNATURE (founder directive 2026-06-25).
// Two files, two jobs:
//   • `.deploy-lane.json` is the POLICY — WHAT may run (named action classes), to WHICH
//     target env, and the irreversible/destructive guard denylist. It is not an authorization.
//   • `templates/tools/deployment-auth.mjs` is the AUTHORIZATION — WHETHER a deploy to a given
//     target env may run RIGHT NOW, decided from live SDLC signals (verification, approvals,
//     founder-review-if-applicable). Authorization depends on STATE, never on who runs the agent.
//
// This wrapper is the only door: for every in-scope action it asks deployment-auth whether the
// SDLC state authorizes the action's target env BEFORE running anything. Unfinished governance
// step ⇒ REFUSE (fail-closed, non-zero exit) and surface the step. Every action is appended to
// the audit log. Anything not declared in the lane is REFUSED. There is no override flag.
//
// USAGE:
//   node deploy-lane.mjs <action-class> [extra args...]   run an in-scope, state-authorized action (audited)
//   node deploy-lane.mjs <action-class> --plan            print what WOULD run + the auth verdict; execute nothing
//   node deploy-lane.mjs --list                           list policy action classes + the freeze switch
//   Optional context forwarded to deployment-auth: --pr <n> | --base <ref>  (or env DEPLOY_PR / DEPLOY_BASE)
//
// EXIT: 0 = ok / plan printed.  Non-zero = refused (out of scope / not state-authorized / frozen /
//       guard hit) or the underlying command failed (honest failure — the audit records the real result).
//
// The lane file never widens scope; deployment-auth never gets bypassed. Fail-closed on purpose.

import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit, env, cwd } from "node:process";

const ROOT = cwd();
const LANE_PATH = join(ROOT, ".deploy-lane.json");
const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const AUTH_TOOL = join(TOOLS_DIR, "deployment-auth.mjs");

function die(msg, code = 1) { console.error(msg); exit(code); }

// --- load + sanity-check the policy lane ------------------------------------
if (!existsSync(LANE_PATH))
  die(`REFUSED: no .deploy-lane.json at ${LANE_PATH}. Add the deploy-lane POLICY (docs/deploy-lane-setup.md) before any deploy.`);

let lane;
try { lane = JSON.parse(readFileSync(LANE_PATH, "utf8")); }
catch (e) { die(`REFUSED: .deploy-lane.json is not valid JSON (${e.message}). Fix the policy; fail-closed.`); }

const actions = lane.actions || {};
const guards = lane.guards?.deny_substrings || [];
const actor = env.DEPLOY_ACTOR || lane.actor_default || "unknown";
const auditPath = resolve(ROOT, lane.audit_log || "docs/deploy-lane/audit.log.jsonl");

// Optional founder kill-switch. The legacy `ratified` object is honored for back-compat, but it
// is no longer an authorization gate: an empty/absent block does NOT block — SDLC state-auth governs.
const freeze = lane.freeze || lane.ratified || {};

// --- audit: structured, append-only JSONL -----------------------------------
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

// --- target env per action: unknown/missing ⇒ prod (fail-closed, strictest) -
function targetEnvOf(spec) {
  const t = String(spec?.target_env || "").toLowerCase();
  return (t === "dev" || t === "preview" || t === "prod") ? t : "prod";
}

// --- SDLC-state authorization: ask deployment-auth, fail-closed -------------
// Returns the parsed verdict ({authorized, target, reason, signals}); on any error the verdict is
// a synthetic fail-closed refusal. authorized is true ONLY when the tool exits 0 AND says so.
function authorize(targetEnv, ctx) {
  if (!existsSync(AUTH_TOOL))
    return { authorized: false, target: targetEnv, reason: `deployment-auth.mjs not found at ${AUTH_TOOL} — cannot verify SDLC state`, signals: {} };

  const authArgs = ["check", "--target", targetEnv, "--lane", LANE_PATH];
  if (ctx.pr)   authArgs.push("--pr", String(ctx.pr));
  if (ctx.base) authArgs.push("--base", String(ctx.base));

  const res = spawnSync("node", [AUTH_TOOL, ...authArgs], { encoding: "utf8", shell: false });
  if (res.error)
    return { authorized: false, target: targetEnv, reason: `deployment-auth.mjs failed to run (${res.error.message})`, signals: {} };

  let verdict;
  try { verdict = JSON.parse(res.stdout); }
  catch {
    return { authorized: false, target: targetEnv, reason: `deployment-auth.mjs produced unparseable output (exit ${res.status ?? "?"})`, signals: {} };
  }
  // Contract: exit 0 iff authorized. Require BOTH the exit code AND the flag to agree (fail-closed).
  verdict.authorized = res.status === 0 && verdict.authorized === true;
  if (!verdict.target) verdict.target = targetEnv;
  if (typeof verdict.reason !== "string") verdict.reason = verdict.authorized ? "authorized" : "not authorized";
  if (!verdict.signals) verdict.signals = {};
  return verdict;
}

// --- args ------------------------------------------------------------------
const rawArgs = argv.slice(2);
if (rawArgs.length === 0 || rawArgs[0] === "--help" || rawArgs[0] === "-h")
  die("USAGE: deploy-lane.mjs <action-class> [args...] [--pr <n>] [--base <ref>] | <action-class> --plan | --list", 0);

// Pull optional --pr / --base context out of the arg stream (forwarded to deployment-auth).
function takeOpt(arr, flag) {
  const i = arr.indexOf(flag);
  if (i === -1) return undefined;
  const v = arr[i + 1];
  arr.splice(i, v === undefined ? 1 : 2);
  return v;
}
const args = [...rawArgs];
const ctx = {
  pr:   takeOpt(args, "--pr")   ?? env.DEPLOY_PR   ?? null,
  base: takeOpt(args, "--base") ?? env.DEPLOY_BASE ?? null,
};

if (args[0] === "--list") {
  const frozen = freeze.frozen === true
    ? `FROZEN by founder kill-switch${freeze.by ? ` (${freeze.by})` : ""} — every action is halted`
    : "not frozen — SDLC state-auth governs each deploy";
  console.log(`deploy lane (POLICY): ${frozen}`);
  console.log(`authorization:        deployment-auth.mjs check --target <env>  (SDLC state decides WHETHER a deploy may run)`);
  console.log(`audit log:            ${lane.audit_log}`);
  console.log("action classes (policy — WHAT may run):");
  for (const [name, a] of Object.entries(actions)) {
    if (name === "_comment") continue;
    console.log(`  - ${name}: ${[a.cmd, ...(a.args || [])].join(" ")}  -> [${targetEnvOf(a)}] ${(a.targets || []).join(", ")}${a.forward_only ? "  [forward-only]" : ""}`);
  }
  exit(0);
}

const action = args[0];
const isPlan = args.includes("--plan");
const extra = args.slice(1).filter((a) => a !== "--plan");

// --- fail-closed scope checks ----------------------------------------------
// 1) optional founder FREEZE kill-switch — a hard stop on ALL deploys regardless of state.
if (freeze.frozen === true) {
  audit({ action, args: extra, kind: "refused", reason: "founder-freeze", result: "refused" });
  die(`REFUSED: the deploy lane is FROZEN (freeze.frozen=true${freeze.by ? `, by ${freeze.by}` : ""}). The founder kill-switch halts ALL deploys regardless of SDLC state. Lift the freeze to resume.`);
}

// 2) action class must be declared in the policy.
const spec = actions[action];
if (!spec || action === "_comment") {
  audit({ action, args: extra, kind: "refused", reason: "action-not-in-policy", result: "refused" });
  die(`REFUSED: "${action}" is not a declared action class in this lane's POLICY. Known: ${Object.keys(actions).filter((k) => k !== "_comment").join(", ") || "(none)"}. Out-of-scope actions still require an explicit human yes (fail-closed).`);
}

const targetEnv = targetEnvOf(spec);

// 3) SDLC-STATE AUTHORIZATION — deployment-auth decides WHETHER this target env may deploy now.
//    Never deploy past an unfinished governance step. Fail-closed: missing/erroring tool ⇒ REFUSE.
const verdict = authorize(targetEnv, ctx);

// --- plan (dry-run): print intent + the auth verdict, execute nothing -------
if (isPlan) {
  const cmdPlan = spec.cmd;
  const fullArgsPlan = [...(spec.args || []), ...extra];
  const renderedPlan = [cmdPlan, ...fullArgsPlan].join(" ");
  console.log(`PLAN (no execution):`);
  console.log(`  action class : ${action}${spec.forward_only ? "  [forward-only]" : ""}`);
  console.log(`  would run    : ${renderedPlan}`);
  console.log(`  target env   : ${targetEnv}`);
  console.log(`  targets      : ${(spec.targets || []).join(", ") || "(none declared)"}`);
  console.log(`  actor        : ${actor}`);
  console.log(`  audit log    : ${lane.audit_log}`);
  console.log(`  AUTH verdict : ${verdict.authorized ? "AUTHORIZED" : "REFUSED"} — ${verdict.reason}`);
  audit({ action, args: extra, kind: "plan", command: renderedPlan, target_env: targetEnv, authorized: verdict.authorized, reason: verdict.reason, result: "planned" });
  exit(0);
}

// Enforce the verdict for a real run.
if (!verdict.authorized) {
  audit({ action, args: extra, kind: "refused", reason: `governance:${verdict.reason}`, target_env: targetEnv, result: "refused" });
  die(`REFUSED: SDLC state does not authorize a "${targetEnv}" deploy. deployment-auth says: ${verdict.reason}. Finish the unfinished governance step — the operator never deploys past it. (Authorization is by state, not by who runs the lane.)`);
}

// 4) build the concrete command and run the irreversible/destructive guard (UNCHANGED discipline).
const cmd = spec.cmd;
const fullArgs = [...(spec.args || []), ...extra];
const rendered = [cmd, ...fullArgs].join(" ");
const guardHit = guards.find((g) => rendered.toLowerCase().includes(g.toLowerCase()));
if (guardHit) {
  audit({ action, args: extra, kind: "refused", reason: `guard:${guardHit}`, command: rendered, target_env: targetEnv, result: "refused" });
  die(`REFUSED: command "${rendered}" matches the irreversible/destructive guard "${guardHit}". Never in any lane — requires an explicit human yes.`);
}

// --- execute the in-scope, state-authorized action (NO per-action prompt) ---
console.log(`deploy-lane: "${action}" -> [${targetEnv}] AUTHORIZED by SDLC state (${verdict.reason}). Running: ${rendered}`);
const started = audit({ action, args: extra, kind: "execute", command: rendered, target_env: targetEnv, authorized: true, reason: verdict.reason, result: "started" });
console.log(`audit (start): ${started}`);

const run = spawnSync(cmd, fullArgs, { stdio: "inherit", shell: false });
const ok = run.status === 0 && !run.error;
const finished = audit({
  action, args: extra, kind: "execute", command: rendered, target_env: targetEnv,
  result: ok ? "success" : "failure",
  exit_code: run.status ?? null,
  error: run.error ? String(run.error.message || run.error) : null,
});
console.log(`audit (end):   ${finished}`);

if (!ok) die(`deploy-lane: action "${action}" FAILED (exit ${run.status ?? "?"}${run.error ? ", " + run.error.message : ""}). See audit log + the playbook (deploy-vercel-supabase).`, run.status || 1);
console.log(`deploy-lane: "${action}" succeeded. Run the smoke battery (deploy ≠ done — deploy-vercel-supabase).`);
exit(0);
