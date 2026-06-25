#!/usr/bin/env node
// =============================================================================
// Delivery OS — stall-classify (the 4-way cause classifier). Zero-dep, Node ESM.
// PURE classifier — it NAMES the cause of a stall and the SANCTIONED action; it
// performs NO effectful action (no merge / deploy / push / bypass).
// =============================================================================
// When progress-stall reports a STALL, WHY did it stall? The cause decides who must
// act. The ORDERING is a fail-safe: the must-never-bypass causes are decided FIRST,
// so a real boundary or a real red can NEVER be mistaken for a benign loop.
//
//   1. founder-action        — the reason maps to a founder BOUNDARY (gate-state /
//                              credential-absent / approval / deploy-auth).
//                              action: 'emit-FAP-terminate'  (stop = a Founder Action Package)
//   2. impl-defect           — a REAL red (verify_status: failed, or a FAILURE_CLASS).
//                              action: 'route-author-ward'   (back to the building agent)
//   3. agent-failure         — a dispatched agent is running PAST its deadline.
//                              action: 'kill-respawn'        (reap the hung agent, respawn)
//   4. orchestration-failure — RESIDUAL: none of the above AND a provably-empty repeat
//                              (the loop is spinning with no boundary, no red, no agent).
//                              action: 'escalate-to-failure-FAP'
//
// >>> B4 (board-review) — THE BYPASS IS GONE. The residual action does NOT, and CANNOT,
//     proceed past any gate. "No progress" is INDISTINGUISHABLE from a gate that is
//     CORRECTLY REFUSING, so self-healing past it would be a §13 kernel-mechanism swap
//     (forbidden). orchestration-failure therefore STOPS self-healing and hands to the
//     founder via a `disposition: failure` FAP — collapsing into the goal-contract's H1
//     forced-failure-FAP. There is NO code path in this module that returns "proceed",
//     "bypass", or anything that skips a verify-gate / merge-gate / boundary. The
//     SANCTIONED_ACTIONS table below is the closed, asserted set — proof by construction.
//
//   import { classifyStall, CAUSES, SANCTIONED_ACTIONS } from "./stall-classify.mjs"
//   classifyStall({ reason, signals }) -> { cause, action, evidence }
//   node stall-classify.mjs --self-test
// =============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Reuse the single source of boundary truth (do NOT reimplement the boundary regexes).
import { classify as classifyBoundary, BOUNDARY_CLASSES, HARD_EVIDENCE_KINDS } from "./boundary-classify.mjs";

export const CAUSES = ["founder-action", "impl-defect", "agent-failure", "orchestration-failure"];

// The CLOSED action vocabulary, one per cause. NOTE: there is deliberately NO
// 'proceed' / 'bypass' / 'skip-gate' action anywhere in this table. The residual
// cause escalates to a failure FAP — it cannot skip a gate.
export const SANCTIONED_ACTIONS = {
  "founder-action": "emit-FAP-terminate",
  "impl-defect": "route-author-ward",
  "agent-failure": "kill-respawn",
  "orchestration-failure": "escalate-to-failure-FAP",
};

// Hard, re-checkable founder-boundary kinds (no_tool is excluded — H4, never alone).
const FOUNDER_HARD_KINDS = HARD_EVIDENCE_KINDS.filter((k) => k !== "cap_tripped"); // gate_state, credential_absent, tool_denial

// real reds — a genuine technical failure (NOT a boundary, NOT a benign loop).
export const FAILURE_CLASSES = [
  "test_failed", "build_failed", "typecheck_failed", "lint_failed", "eval_failed",
  "runtime_error", "assertion_failed", "contract_failed", "seam_mismatch", "red",
];

// --- (1) founder boundary -----------------------------------------------------
function founderBoundary(reason, s) {
  if (s.boundaryClass && BOUNDARY_CLASSES.includes(String(s.boundaryClass)))
    return `boundary signal: boundary_class=${s.boundaryClass}`;
  if (s.gateState || s.gate_state) return "boundary signal: gate-state (a fail-closed gate is refusing)";
  if (s.credentialAbsent || s.credential_absent) return "boundary signal: credential-absent";
  if (s.approval) return "boundary signal: approval required";
  if (s.deployAuth || s.deploy_auth) return "boundary signal: deploy-auth required";
  // reason text -> the boundary classifier (single source of truth).
  const b = classifyBoundary({ action: s.action || "", error: String(reason || "") });
  if (b.terminal === "boundary" && FOUNDER_HARD_KINDS.includes(b.evidence_kind))
    return `${b.class}: ${b.evidence_kind} — "${String(reason || "").slice(0, 80)}"`;
  return null;
}

// --- (2) a real red -----------------------------------------------------------
function realRed(reason, s) {
  if (String(s.verify_status || s.verifyStatus || "").toLowerCase() === "failed") return "verify_status: failed";
  const fc = s.failureClass || s.failure_class;
  if (fc && FAILURE_CLASSES.includes(String(fc))) return `failure_class: ${fc}`;
  if (s.red === true) return "red signal";
  if (/verify_status\s*[:=]\s*failed/i.test(String(reason || ""))) return "reason: verify_status failed";
  for (const c of FAILURE_CLASSES) if (new RegExp(`\\b${c}\\b`, "i").test(String(reason || ""))) return `reason failure_class: ${c}`;
  return null;
}

// --- (3) a dispatched agent past its deadline ---------------------------------
function agentPastDeadline(reason, s) {
  if (s.agentPastDeadline === true || s.staleAgent === true) return "agent past deadline (signal)";
  const a = s.agent || s.dispatch;
  if (a && a.running) {
    if (a.pastDeadline === true) return `agent ${a.id || ""} past deadline (signal)`.trim();
    if (typeof a.startedAt === "number" && typeof a.deadlineMs === "number") {
      const now = typeof a.now === "number" ? a.now : Date.now();
      if (now - a.startedAt > a.deadlineMs) return `agent ${a.id || ""} ran ${now - a.startedAt}ms > deadline ${a.deadlineMs}ms`.trim();
    }
  }
  if (/(agent|dispatch)\b[^.\n]*\b(past|exceeded|over)\b[^.\n]*\b(deadline|timeout|budget)\b|stalled agent|hung agent|agent stuck/i.test(String(reason || "")))
    return "reason: agent past deadline";
  return null;
}

// =============================================================================
// THE CLASSIFIER (pure). Fail-safe ORDERING: founder-action and impl-defect are
// decided BEFORE anything residual, so a boundary or a real red is never read as a
// benign loop. The residual cause can ONLY escalate (it cannot skip a gate).
// =============================================================================
export function classifyStall({ reason = "", signals = {} } = {}) {
  const s = signals || {};
  const mk = (cause, evidence) => {
    const action = SANCTIONED_ACTIONS[cause];
    // proof-by-construction guard: this module never emits a gate-skipping action.
    if (/proceed|bypass|skip/i.test(action)) throw new Error(`illegal action ${action} — stall-classify must never skip a gate`);
    return { cause, action, evidence };
  };

  // 1) FOUNDER-ACTION (must-never-bypass) — a founder boundary.
  const fb = founderBoundary(reason, s);
  if (fb) return mk("founder-action", fb);

  // 2) IMPL-DEFECT — a real red.
  const red = realRed(reason, s);
  if (red) return mk("impl-defect", red);

  // 3) AGENT-FAILURE — a dispatched agent past its deadline.
  const ag = agentPastDeadline(reason, s);
  if (ag) return mk("agent-failure", ag);

  // 4) ORCHESTRATION-FAILURE (residual ONLY) — no boundary, no red, no hung agent.
  //    It does NOT proceed past anything: it escalates to a failure FAP (H1 collapse).
  return mk(
    "orchestration-failure",
    "residual: no founder boundary, no real red, no agent-past-deadline — a provably-empty repeat. " +
    "Escalating to a disposition:failure FAP (the founder decides). NOT self-healing past any gate (B4/§13)."
  );
}

// =============================================================================
// SELF-TEST (pure). Proves the fail-safe ORDERING and that the bypass is gone:
// orchestration-failure escalates (never 'proceed'/'bypass'), and is NEVER chosen
// when a boundary OR a real red OR a hung agent is present.
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };
  const log = [];

  // (1) a merge-gate-state reason -> founder-action / emit-FAP-terminate
  const c1 = classifyStall({ reason: "merge-pr.mjs exit 1: green checks but no founder-approved label (gh api labels=[])" });
  ok(c1.cause === "founder-action" && c1.action === "emit-FAP-terminate", "merge gate-state reason -> founder-action / emit-FAP-terminate");
  log.push(`  [order-1 founder]  merge gate-state reason            -> ${c1.cause} / ${c1.action}`);

  // (2) a verify_status:failed -> impl-defect / route-author-ward
  const c2 = classifyStall({ reason: "slice stop", signals: { verify_status: "failed" } });
  ok(c2.cause === "impl-defect" && c2.action === "route-author-ward", "verify_status:failed -> impl-defect / route-author-ward");
  log.push(`  [order-2 impl]     verify_status: failed              -> ${c2.cause} / ${c2.action}`);

  // (3) a stalled-agent signal -> agent-failure / kill-respawn
  const c3 = classifyStall({ reason: "no stop reason", signals: { agent: { running: true, pastDeadline: true, id: "qa-test-1" } } });
  ok(c3.cause === "agent-failure" && c3.action === "kill-respawn", "hung agent -> agent-failure / kill-respawn");
  log.push(`  [order-3 agent]    agent past deadline                -> ${c3.cause} / ${c3.action}`);

  // (4) same-reason-no-red-no-boundary -> orchestration-failure / escalate-to-failure-FAP (and ONLY then)
  const c4 = classifyStall({ reason: "same stop repeated, nothing changed", signals: { emptyRepeat: true } });
  ok(c4.cause === "orchestration-failure" && c4.action === "escalate-to-failure-FAP", "empty repeat -> orchestration-failure / escalate-to-failure-FAP");
  log.push(`  [order-4 residual] empty repeat (no boundary/red/agent) -> ${c4.cause} / ${c4.action}`);

  // ---- B4: THE BYPASS IS GONE ----
  // the residual action is an ESCALATION, never a gate-skip
  ok(c4.action === "escalate-to-failure-FAP", "residual action is escalate-to-failure-FAP");
  ok(!/proceed|bypass|skip/i.test(c4.action), "residual action contains NO proceed/bypass/skip");
  // NO cause anywhere maps to a gate-skipping action
  ok(Object.values(SANCTIONED_ACTIONS).every((a) => !/proceed|bypass|skip/i.test(a)), "NO sanctioned action skips a gate");
  ok(CAUSES.every((c) => SANCTIONED_ACTIONS[c]), "every cause has exactly one sanctioned action");

  // ---- THE BYPASS (now: the escalation) IS LAST — never chosen when a boundary/red/agent is present ----
  // boundary PRESENT alongside an empty-repeat -> founder-action, NOT orchestration
  const bPlus = classifyStall({ reason: "loop", signals: { emptyRepeat: true, gateState: true } });
  ok(bPlus.cause === "founder-action", "boundary present + empty-repeat -> founder-action (NEVER the residual escalation)");
  // a real RED present alongside an empty-repeat -> impl-defect, NOT orchestration
  const rPlus = classifyStall({ reason: "loop", signals: { emptyRepeat: true, verify_status: "failed" } });
  ok(rPlus.cause === "impl-defect", "real red present + empty-repeat -> impl-defect (NEVER the residual escalation)");
  // a hung AGENT present alongside an empty-repeat -> agent-failure, NOT orchestration
  const aPlus = classifyStall({ reason: "loop", signals: { emptyRepeat: true, agent: { running: true, pastDeadline: true } } });
  ok(aPlus.cause === "agent-failure", "hung agent present + empty-repeat -> agent-failure (NEVER the residual escalation)");
  // credential-absent + deploy-auth reasons also -> founder-action
  ok(classifyStall({ signals: { credentialAbsent: true } }).cause === "founder-action", "credential-absent -> founder-action");
  ok(classifyStall({ reason: "deploy --prod requires founder authorization (deploy-auth)", signals: { deployAuth: true } }).cause === "founder-action", "deploy-auth -> founder-action");
  log.push("  [bypass-is-last]   boundary|red|agent + emptyRepeat   -> founder|impl|agent (residual escalation NEVER fires)");

  // the residual escalation fires ONLY in the fully-clean case
  ok(classifyStall({ reason: "x", signals: {} }).cause === "orchestration-failure", "fully-clean residual -> orchestration-failure (escalate)");

  // every result uses the closed vocabularies
  for (const r of [c1, c2, c3, c4, bPlus, rPlus, aPlus]) {
    ok(CAUSES.includes(r.cause), `cause "${r.cause}" is in the closed set`);
    ok(Object.values(SANCTIONED_ACTIONS).includes(r.action), `action "${r.action}" is sanctioned`);
  }

  if (fails.length) {
    console.error("stall-classify --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error("stall-classify --self-test PASS — fail-safe ordering + B4 (bypass-is-gone) proofs:");
  for (const l of log) console.error(l);
  console.error(
    "stall-classify --self-test PASS — the must-never-bypass causes are decided FIRST: a founder boundary " +
    "(gate-state/credential/approval/deploy-auth) -> founder-action/emit-FAP-terminate; a real red " +
    "(verify_status:failed / a FAILURE_CLASS) -> impl-defect/route-author-ward; a hung agent -> agent-failure/kill-respawn. " +
    "The residual orchestration-failure -> escalate-to-failure-FAP and is chosen ONLY when no boundary, no red, and no hung " +
    "agent is present — proven by adding emptyRepeat to each higher signal and seeing the higher cause win every time. " +
    "B4: NO sanctioned action proceeds/bypasses/skips a gate (closed table + a runtime guard) — the residual cause escalates " +
    "to a disposition:failure FAP (H1 collapse), structurally incapable of skipping a verify-gate / merge-gate / boundary."
  );
  process.exit(0);
}

// --- CLI ---------------------------------------------------------------------
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const json = argv.includes("--json");

  let input = {};
  try { input = JSON.parse(readFileSync(0, "utf8")); } catch { /* no stdin */ }
  if (flag("--reason")) input.reason = flag("--reason");
  if (!input.signals) input.signals = {};

  const res = classifyStall(input);
  if (json) console.log(JSON.stringify(res, null, 2));
  else {
    console.error(`stall-classify: cause=${res.cause} action=${res.action}`);
    console.error(`  evidence: ${res.evidence}`);
    console.log(res.cause);
  }
  process.exit(0);
}
