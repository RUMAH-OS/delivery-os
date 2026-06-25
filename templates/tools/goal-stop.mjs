#!/usr/bin/env node
// =============================================================================
// Delivery OS — goal-stop (the /goal Execution Contract, §5 + Hardening H1/H4/H7).
// Zero-dep, Node ESM. A Claude Code STOP-HOOK, wired as a SECOND Stop entry
// ALONGSIDE verify-gate (Claude runs all Stop hooks; the turn ends only when ALL
// allow it — you cannot FAP-out with dangling unverified impl).
// =============================================================================
// Reads `.claude/.goal-state.json`. The autonomous frontier is the goal; the
// BOUNDARY = STOP = SUCCESS. This hook NEVER throttles work BEFORE a FAP — it
// gates the EXIT only:
//
//   no active goal                         -> exit 0 (allow stop)
//   objective_complete (H6-evidenced FAP)  -> exit 0 (clears: complete)
//   fresh valid FAP at a boundary/failure  -> exit 0 (clears: boundary)
//   H1 cap tripped, no fresh FAP           -> BLOCK: emit a cap_tripped failure FAP and stop
//   else                                   -> BLOCK: continue autonomous work; FAP only at a genuine boundary
//
// H1: it reads the harness `stop_hook_active` flag and NEVER drives an unbounded
//     re-entrant continuation (when set, it allows the stop). The wall-clock/turn
//     cap converts retry-forever into a surfaced blocked-failure.
// H4: a `no_tool` evidence kind is INVALID alone — it must co-occur with a hard
//     re-checkable kind (credential_absent | gate_state | tool_denial | cap_tripped).
// H7: a resume whose boundary signature equals the prior FAP's does NOT silently
//     clear — it escalates ("you resumed but <X> is unchanged; mark escalated:true").
//
//   node .claude/tools/goal-stop.mjs            (Stop-hook: reads hook JSON on stdin)
//   node goal-stop.mjs --self-test
// =============================================================================

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Closed vocabularies (kept in lock-step with boundary-classify.mjs).
export const DISPOSITIONS = ["complete", "boundary", "failure"];
export const BOUNDARY_CLASSES = [
  "approval", "merge-to-main", "credentials", "deploy-auth", "manual-testing",
  "external-login", "legal", "payment", "physical", "cross-repo-coordination", "other",
];
// Hard, re-checkable kinds. `no_tool` is NOT here (H4): valid only WITH one of these.
export const HARD_EVIDENCE_KINDS = ["tool_denial", "credential_absent", "gate_state", "cap_tripped"];

// --- frontmatter parser (mirrors verify-gate.mjs exactly) --------------------
export function parseFrontmatter(txt) {
  const m = (txt || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.+?)\s*$/i);
    if (kv) fm[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, "");
  }
  return fm;
}

const truthy = (v) => v === true || /^(true|yes)$/i.test(String(v || "").trim());
const splitKinds = (v) => String(v || "").split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);

// =============================================================================
// FAP VALIDATION (pure). `fap` = { text, mtimeMs } | null. `state` carries the
// freshness baseline (started_at) and the prior-FAP signature (H7).
// Returns { valid, disposition, dedup, reasons:[] }.
// =============================================================================
export function validateFap(fap, state) {
  const reasons = [];
  if (!fap || !fap.text) return { valid: false, disposition: null, dedup: false, reasons: ["no FAP file found"] };

  const fm = parseFrontmatter(fap.text);
  if (!Object.keys(fm).length) return { valid: false, disposition: null, dedup: false, reasons: ["FAP frontmatter did not parse"] };

  const disposition = String(fm.disposition || "").toLowerCase();
  if (!DISPOSITIONS.includes(disposition)) reasons.push(`disposition "${fm.disposition}" not in {complete,boundary,failure}`);

  // freshness: the FAP must be NEWER than the goal start (a stale FAP is not this goal's).
  if (!(fap.mtimeMs > (state.started_at || 0))) reasons.push("FAP is not newer than the goal start (stale)");

  // goal_id must name THIS goal (best-effort; a mismatched FAP is not ours).
  if (fm.goal_id && state.goal_id && fm.goal_id !== state.goal_id) reasons.push(`FAP goal_id "${fm.goal_id}" != active goal "${state.goal_id}"`);

  if (disposition === "complete") {
    // H6 — `complete` is the stronger, no-human claim: never a bare assertion.
    if (!truthy(fm.verify_clean)) reasons.push("H6: a `complete` FAP requires verify_clean:true (impl-touched goals need verified slices; a no-impl goal must still assert clean)");
  }

  if (disposition === "boundary") {
    if (!BOUNDARY_CLASSES.includes(String(fm.boundary_class || "").toLowerCase()))
      reasons.push(`boundary_class "${fm.boundary_class}" not in the §3 taxonomy`);
    if (!String(fm.boundary_evidence || "").trim())
      reasons.push("boundary_evidence is empty (a boundary needs re-checkable evidence)");
    const kinds = splitKinds(fm.boundary_evidence_kind);
    const hasHard = kinds.some((k) => HARD_EVIDENCE_KINDS.includes(k));
    if (!hasHard) {
      // H4: no_tool alone (or no kind at all) is INVALID.
      if (kinds.includes("no_tool"))
        reasons.push("H4: boundary_evidence_kind is no_tool ALONE — it must co-occur with a hard kind (credential_absent | gate_state | tool_denial | cap_tripped)");
      else
        reasons.push(`boundary_evidence_kind "${fm.boundary_evidence_kind}" has no recognized hard kind (${HARD_EVIDENCE_KINDS.join(" | ")})`);
    }
    if (!String(fm.resume_goal || "").trim()) reasons.push("resume_goal is missing (the founder needs the exact resume line)");
    if (!truthy(fm.verify_clean)) reasons.push("verify_clean:true is required (no FAP-out with unverified impl — §6.4)");
  }

  if (disposition === "failure") {
    // a genuine technical blocker: evidence required, but not the boundary taxonomy.
    if (!String(fm.boundary_evidence || "").trim()) reasons.push("a `failure` FAP requires boundary_evidence (what blocked, re-checkably)");
  }

  // H7 — resume de-dup: does this FAP's boundary signature equal the prior one's?
  let dedup = false;
  if (state.prior_fap && (disposition === "boundary" || disposition === "failure")) {
    const sameClass = (state.prior_fap.boundary_class || "") === (fm.boundary_class || "");
    const sameEvidence = (state.prior_fap.boundary_evidence || "") === (fm.boundary_evidence || "");
    if (sameClass && sameEvidence && (fm.boundary_class || fm.boundary_evidence)) dedup = true;
  }

  return { valid: reasons.length === 0, disposition, dedup, fm, reasons };
}

// =============================================================================
// THE DECISION (pure). Returns { action:"allow"|"block", reason?, newState }.
// `loadFap(goalId)` -> { text, mtimeMs } | null  (injected for the self-test).
// =============================================================================
export function evaluate({ state, input, now, loadFap }) {
  // no active / already-cleared goal -> non-goal turns are unaffected.
  if (!state || !state.goal_id || state.status === "cleared")
    return { action: "allow", newState: state || null };

  const stopActive = !!(input && input.stop_hook_active === true);
  const newState = { ...state, turns: (state.turns || 0) + 1 };

  const fap = typeof loadFap === "function" ? loadFap(state.goal_id) : null;
  const v = validateFap(fap, state);

  // CLEAR PATHS — a fresh, valid FAP ends the goal successfully.
  if (v.valid) {
    // H7 — a resume that reproduces the prior boundary does NOT silently clear.
    if (v.dedup && !truthy(v.fm.escalated)) {
      return {
        action: "block",
        reason:
          `Goal "${state.goal_id}" RESUME LOOP (H7): the new FAP repeats the prior boundary ` +
          `(${v.fm.boundary_class || "?"} / "${(v.fm.boundary_evidence || "").slice(0, 80)}"). ` +
          `The founder action did not take effect — do NOT silently re-emit the same FAP. ` +
          `Re-check the boundary: did the fix land (e.g. is the credential now present, the label applied)? ` +
          `If it genuinely cleared, continue autonomous work. If it is genuinely STILL blocked, set ` +
          `escalated:true in the FAP frontmatter (escalating to the founder that their fix did not land) and stop.`,
        newState,
      };
    }
    // record this FAP's boundary signature (chains H7 for the next resume) + clear.
    const cleared = {
      ...newState,
      status: "cleared",
      cleared_as: v.disposition,
      prior_fap: v.fm && (v.fm.boundary_class || v.fm.boundary_evidence)
        ? { boundary_class: v.fm.boundary_class || null, boundary_evidence: v.fm.boundary_evidence || null }
        : (state.prior_fap || null),
    };
    return { action: "allow", newState: cleared };
  }

  // NO valid FAP yet. Compute the H1 cap.
  const cap = state.cap || {};
  const wallMs = now - (state.started_at || now);
  const overWall = cap.maxWallClockMs != null && wallMs > cap.maxWallClockMs;
  const overTurns = cap.maxTurns != null && newState.turns >= cap.maxTurns;
  const capTripped = overWall || overTurns;

  // H1 re-entrancy guard: NEVER drive an unbounded re-entrant continuation. If the
  // harness says this Stop is already a hook-induced re-entry, allow the stop —
  // the demand below was already surfaced on the first (non-reentrant) attempt.
  if (stopActive) return { action: "allow", newState: { ...newState, status: "halted_reentrant" } };

  if (capTripped) {
    const why = overWall ? `wall-clock ${wallMs}ms > cap ${cap.maxWallClockMs}ms` : `turns ${newState.turns} >= cap ${cap.maxTurns}`;
    return {
      action: "block",
      reason:
        `Goal "${state.goal_id}" CAP TRIPPED (H1: ${why}). This is a FORCED terminal — the autonomous segment ` +
        `is over and the outcome is ambiguous-failure, not success. Do NOT keep retrying. Emit ` +
        `docs/goals/FAP-${state.goal_id}.md with disposition: failure, boundary_evidence_kind: cap_tripped, ` +
        `a boundary_evidence line stating what was still being attempted when the cap tripped, and stop. ` +
        `(The cap is the kill-switch that converts retry-forever into a surfaced blocked-failure.)`,
      newState: { ...newState, cap_tripped: true },
    };
  }

  // Default: keep working. FAP only at a GENUINE founder boundary.
  return {
    action: "block",
    reason:
      `Goal "${state.goal_id}" not complete. Continue autonomous work. ` +
      `Only if the next required step is a genuine founder action you cannot automate, emit ` +
      `docs/goals/FAP-${state.goal_id}.md (boundary_class from the §3 taxonomy + re-checkable boundary_evidence of a ` +
      `recognized kind: ${HARD_EVIDENCE_KINDS.join(" | ")}; no_tool is never sufficient alone) and stop. ` +
      (v.reasons && v.reasons.length ? `(last FAP attempt rejected: ${v.reasons.join("; ")})` : `(no FAP present yet)`),
    newState,
  };
}

// --- IO adapters (the live path) ---------------------------------------------
function readState(root) {
  try { return JSON.parse(readFileSync(join(root, ".claude", ".goal-state.json"), "utf8")); }
  catch { return null; }
}
function writeState(root, state) {
  if (!state) return;
  try { writeFileSync(join(root, ".claude", ".goal-state.json"), JSON.stringify(state, null, 2) + "\n", "utf8"); }
  catch { /* non-fatal */ }
}
function makeLoadFap(root) {
  return (goalId) => {
    const p = join(root, "docs", "goals", `FAP-${goalId}.md`);
    if (!existsSync(p)) return null;
    try { return { text: readFileSync(p, "utf8"), mtimeMs: statSync(p).mtimeMs }; }
    catch { return null; }
  };
}

// =============================================================================
// SELF-TEST (pure — injected loadFap, no real Stop event, no disk).
// =============================================================================
function fapText(fm) {
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join("\n");
  return `---\n${lines}\n---\n# Founder Action Package\nbody.\n`;
}
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  const baseState = {
    goal_id: "ship-invoicing", objective: "ship invoicing", clears_on: ["objective_complete", "valid_fap_at_boundary"],
    started_at: 1000, start_ref: "abc", status: "active", turns: 0,
    cap: { maxTurns: 250, maxWallClockMs: 6 * 3600 * 1000, maxCostHint: null }, prior_fap: null,
  };
  const NOW = 2000;
  const validBoundaryFm = {
    goal_id: "ship-invoicing", disposition: "boundary", boundary_class: "merge-to-main",
    boundary_evidence_kind: "gate_state",
    boundary_evidence: "merge-pr.mjs exit 1: green checks but no founder-approved label (gh api labels=[])",
    founder_burden_category: "per_action_authorization", autonomous_work_done: true, verify_clean: true,
    resume_goal: "/goal resume FAP-ship-invoicing",
  };

  // (1) no active goal -> allow
  ok(evaluate({ state: null, input: {}, now: NOW, loadFap: () => null }).action === "allow", "no goal-state -> allow stop");
  ok(evaluate({ state: { ...baseState, status: "cleared" }, input: {}, now: NOW, loadFap: () => null }).action === "allow", "already-cleared goal -> allow stop");

  // (2) no FAP -> BLOCK (continue)
  const blockNoFap = evaluate({ state: baseState, input: {}, now: NOW, loadFap: () => null });
  ok(blockNoFap.action === "block", "active goal, no FAP -> block (continue autonomous work)");
  ok(/Continue autonomous work/.test(blockNoFap.reason), "block reason instructs to continue");

  // (3) fresh VALID boundary FAP -> CLEAR (allow)
  const clear = evaluate({ state: baseState, input: {}, now: NOW, loadFap: () => ({ text: fapText(validBoundaryFm), mtimeMs: 1500 }) });
  ok(clear.action === "allow", "fresh valid boundary FAP -> CLEARS the goal (allow stop)");
  ok(clear.newState.status === "cleared" && clear.newState.cleared_as === "boundary", "clearing marks state cleared_as boundary");

  // (4) H4 — no_tool ALONE is REJECTED -> block (does NOT clear)
  const noToolFm = { ...validBoundaryFm, boundary_class: "physical", boundary_evidence_kind: "no_tool", boundary_evidence: "no tool can press the physical button" };
  const noToolRes = evaluate({ state: baseState, input: {}, now: NOW, loadFap: () => ({ text: fapText(noToolFm), mtimeMs: 1500 }) });
  ok(noToolRes.action === "block", "H4: no_tool-ALONE FAP is REJECTED (does not clear)");
  const noToolV = validateFap({ text: fapText(noToolFm), mtimeMs: 1500 }, baseState);
  ok(!noToolV.valid && noToolV.reasons.some((r) => /H4/.test(r)), "H4: validation cites the no_tool-alone rule");
  // but no_tool CO-OCCURRING with a hard kind is valid
  const noToolPlus = { ...noToolFm, boundary_evidence_kind: "no_tool, gate_state" };
  ok(validateFap({ text: fapText(noToolPlus), mtimeMs: 1500 }, baseState).valid, "no_tool + a hard kind -> valid (H4 co-occurrence)");

  // (5) a stale FAP (older than goal start) does NOT clear
  ok(evaluate({ state: baseState, input: {}, now: NOW, loadFap: () => ({ text: fapText(validBoundaryFm), mtimeMs: 500 }) }).action === "block", "stale FAP (pre-start) -> block");

  // (6) a boundary FAP missing evidence does NOT clear
  const noEvid = { ...validBoundaryFm, boundary_evidence: "" };
  ok(evaluate({ state: baseState, input: {}, now: NOW, loadFap: () => ({ text: fapText(noEvid), mtimeMs: 1500 }) }).action === "block", "boundary FAP without evidence -> block");

  // (7) H1 — cap tripped (wall-clock) with no FAP -> forces a failure FAP demand
  const lateNow = baseState.started_at + baseState.cap.maxWallClockMs + 1;
  const capRes = evaluate({ state: baseState, input: {}, now: lateNow, loadFap: () => null });
  ok(capRes.action === "block" && /CAP TRIPPED/.test(capRes.reason), "H1: wall-clock cap trip -> block");
  ok(/disposition: failure/.test(capRes.reason) && /cap_tripped/.test(capRes.reason), "H1: cap-trip demands a failure FAP with cap_tripped evidence");
  // cap tripped by turns
  const turnCapState = { ...baseState, turns: baseState.cap.maxTurns - 1 };
  ok(/CAP TRIPPED/.test(evaluate({ state: turnCapState, input: {}, now: NOW, loadFap: () => null }).reason || ""), "H1: turn cap trip -> block");

  // (7b) H1 re-entrancy — stop_hook_active set -> NEVER force a re-entrant continuation (allow)
  const reentrant = evaluate({ state: baseState, input: { stop_hook_active: true }, now: lateNow, loadFap: () => null });
  ok(reentrant.action === "allow", "H1: stop_hook_active=true -> allow (no unbounded re-entrant continuation)");
  ok(reentrant.newState.status === "halted_reentrant", "re-entrant halt is recorded");

  // (8) H7 — a resume FAP equal to the prior boundary does NOT silently clear (escalates)
  const resumeState = { ...baseState, prior_fap: { boundary_class: "merge-to-main", boundary_evidence: validBoundaryFm.boundary_evidence } };
  const dup = evaluate({ state: resumeState, input: {}, now: NOW, loadFap: () => ({ text: fapText(validBoundaryFm), mtimeMs: 1500 }) });
  ok(dup.action === "block" && /RESUME LOOP/.test(dup.reason), "H7: a duplicate-boundary resume escalates, does not silently clear");
  // escalated:true lets it through
  const escalated = evaluate({ state: resumeState, input: {}, now: NOW, loadFap: () => ({ text: fapText({ ...validBoundaryFm, escalated: true }), mtimeMs: 1500 }) });
  ok(escalated.action === "allow", "H7: escalated:true on the repeat FAP clears (founder told their fix did not land)");

  // (9) objective_complete (H6) — verify_clean:true required
  const completeOk = { goal_id: "ship-invoicing", disposition: "complete", verify_clean: true, autonomous_work_done: true };
  ok(evaluate({ state: baseState, input: {}, now: NOW, loadFap: () => ({ text: fapText(completeOk), mtimeMs: 1500 }) }).action === "allow", "H6: complete + verify_clean -> clears");
  const completeBad = { goal_id: "ship-invoicing", disposition: "complete", verify_clean: false };
  ok(evaluate({ state: baseState, input: {}, now: NOW, loadFap: () => ({ text: fapText(completeBad), mtimeMs: 1500 }) }).action === "block", "H6: complete WITHOUT verify_clean -> block (never a bare self-assertion)");

  if (fails.length) {
    console.error("goal-stop --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "goal-stop --self-test PASS — no active goal allows the stop; an active goal with no FAP BLOCKS (continue); a fresh " +
    "valid boundary FAP CLEARS; H4 a no_tool-ALONE FAP is REJECTED (and no_tool+hard-kind is accepted); a stale or " +
    "evidence-less FAP does not clear; H1 the wall-clock/turn cap trip BLOCKS demanding a cap_tripped failure FAP, and " +
    "stop_hook_active=true ALWAYS allows the stop (no re-entrant loop); H7 a duplicate-boundary resume escalates unless " +
    "escalated:true; H6 a `complete` FAP needs verify_clean:true."
  );
  process.exit(0);
}

// --- CLI / hook entrypoint ----------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  else {
    const ROOT = process.cwd();
    let input = {};
    try { input = JSON.parse(readFileSync(0, "utf8")); } catch { /* no/!json stdin */ }
    const state = readState(ROOT);
    let res;
    try {
      res = evaluate({ state, input, now: Date.now(), loadFap: makeLoadFap(ROOT) });
    } catch (err) {
      // fail-closed: an unreadable goal state must not silently let a goal idle out.
      process.stdout.write(JSON.stringify({ decision: "block", reason: `goal-stop could not evaluate (${err && err.message || err}). Failing closed — resolve the goal state or clear .claude/.goal-state.json.` }));
      process.exit(0);
    }
    writeState(ROOT, res.newState);
    if (res.action === "block") process.stdout.write(JSON.stringify({ decision: "block", reason: res.reason }));
    // allow -> emit nothing + exit 0 (the Claude Code Stop-hook "allow" contract).
    process.exit(0);
  }
}
