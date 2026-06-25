#!/usr/bin/env node
// =============================================================================
// Delivery OS — progress-stall (the stall DETECTOR). Zero-dep, Node ESM. PURE
// detector — it observes `.claude/.goal-state.json` and reports whether the goal
// has STALLED. It performs NO effectful action (it neither bypasses, terminates,
// nor heals — that is the classifier's/coordinator's job downstream).
// =============================================================================
// A goal STALLS when it keeps stopping for the SAME reason while NOTHING moves:
//   STALLED  ==  K consecutive stops (K=3) where the reasonHash is identical AND
//                none of the three progress signals advanced:
//                  head         — the repo HEAD (a new commit = forward progress)
//                  verifyMtime  — the newest VERIFY artifact mtime (verification moved)
//                  dispatchDone — completed-dispatch count (an agent finished work)
// Any one signal advancing, OR a different reasonHash, RESETS the streak to 1 (this
// stop becomes the new baseline). The first stop is always 1 (a streak can't be
// proven a stall until it repeats with no progress).
//
//   import { computeStall, recordStop, K } from "./progress-stall.mjs"
//   recordStop({ reasonHash, signals: { head, verifyMtime, dispatchDone } })
//     -> { stalled, stallCount, sameReason }   (and persists the `progress` block)
//   node progress-stall.mjs --self-test
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const K = 3; // consecutive same-reason no-progress stops that constitute a STALL

// advancedField — did a single signal move FORWARD?
//   numbers: strictly greater (mtime/count only count UP).
//   anything else (a head sha, a boolean): any change is progress.
//   first-ever value (no prior): treated as progress (we can't prove a stall yet).
function advancedField(prev, cur) {
  if (prev === undefined || prev === null) return cur !== undefined && cur !== null && cur !== prev;
  if (typeof cur === "number" && typeof prev === "number") return cur > prev;
  return cur !== prev;
}

// signalsAdvanced — did ANY of head / verifyMtime / dispatchDone advance?
export function signalsAdvanced(prev, cur) {
  if (!prev) return true; // no baseline -> cannot be a no-progress repeat
  return (
    advancedField(prev.head, cur.head) ||
    advancedField(prev.verifyMtime, cur.verifyMtime) ||
    advancedField(prev.dispatchDone, cur.dispatchDone)
  );
}

// =============================================================================
// computeStall (PURE) — fold the prior `progress` block + this stop into a verdict
// and the next `progress` block. No IO.
//   prevProgress: { stallCount, reasonHash, signals } | null
//   stop:         { reasonHash, signals: { head, verifyMtime, dispatchDone } }
//   -> { stalled, stallCount, sameReason, progress }
// =============================================================================
export function computeStall(prevProgress, stop) {
  const prev = prevProgress || { stallCount: 0, reasonHash: null, signals: null };
  const reasonHash = stop && stop.reasonHash != null ? String(stop.reasonHash) : null;
  const signals = (stop && stop.signals) || {};

  const advanced = signalsAdvanced(prev.signals, signals);
  const sameReason = prev.reasonHash != null && reasonHash != null && reasonHash === prev.reasonHash;

  // a no-progress repeat of the SAME reason extends the streak; anything else resets to 1.
  const stallCount = (prev.signals && sameReason && !advanced) ? (prev.stallCount || 0) + 1 : 1;
  const stalled = stallCount >= K;

  const progress = {
    stallCount,
    reasonHash,
    signals: {
      head: signals.head !== undefined ? signals.head : null,
      verifyMtime: signals.verifyMtime !== undefined ? signals.verifyMtime : null,
      dispatchDone: signals.dispatchDone !== undefined ? signals.dispatchDone : null,
    },
    stalled,
  };
  return { stalled, stallCount, sameReason, progress };
}

// --- live IO: read/write the `progress` block in .claude/.goal-state.json -----
function statePath(root) { return join(root, ".claude", ".goal-state.json"); }
function readState(root) { try { return JSON.parse(readFileSync(statePath(root), "utf8")); } catch { return null; } }
function writeState(root, state) {
  try { writeFileSync(statePath(root), JSON.stringify(state, null, 2) + "\n", "utf8"); } catch { /* non-fatal */ }
}

// recordStop — the live entrypoint: fold this stop into the persisted progress block.
export function recordStop(stop, opts = {}) {
  const root = opts.root || process.cwd();
  const state = (opts.state !== undefined ? opts.state : readState(root)) || {};
  const res = computeStall(state.progress || null, stop);
  if (opts.persist !== false) writeState(root, { ...state, progress: res.progress });
  return { stalled: res.stalled, stallCount: res.stallCount, sameReason: res.sameReason };
}

// =============================================================================
// SELF-TEST (pure — no disk; folds an in-memory progress block).
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  const sig = (over = {}) => ({ head: "sha-1", verifyMtime: 1000, dispatchDone: 0, ...over });

  // (1) THREE identical no-progress stops -> STALLED on the 3rd.
  let p = null;
  const r1 = computeStall(p, { reasonHash: "R", signals: sig() }); p = r1.progress;
  ok(r1.stallCount === 1 && !r1.stalled, "stop 1 -> count 1, not stalled");
  const r2 = computeStall(p, { reasonHash: "R", signals: sig() }); p = r2.progress;
  ok(r2.stallCount === 2 && r2.sameReason && !r2.stalled, "stop 2 (same, no progress) -> count 2");
  const r3 = computeStall(p, { reasonHash: "R", signals: sig() }); p = r3.progress;
  ok(r3.stallCount === 3 && r3.stalled, "stop 3 (same, no progress) -> STALLED (K=3)");

  // (2) A NEW COMMIT (head advances) RESETS the counter.
  let q = computeStall(null, { reasonHash: "R", signals: sig() }).progress;
  q = computeStall(q, { reasonHash: "R", signals: sig() }).progress; // count 2
  const moved = computeStall(q, { reasonHash: "R", signals: sig({ head: "sha-2" }) });
  ok(moved.stallCount === 1 && !moved.stalled, "a new commit (head advanced) RESETS to 1");

  // verifyMtime advancing also resets
  let v = computeStall(null, { reasonHash: "R", signals: sig() }).progress;
  v = computeStall(v, { reasonHash: "R", signals: sig() }).progress; // 2
  ok(computeStall(v, { reasonHash: "R", signals: sig({ verifyMtime: 2000 }) }).stallCount === 1, "verifyMtime advancing RESETS");

  // dispatchDone advancing also resets
  let d = computeStall(null, { reasonHash: "R", signals: sig() }).progress;
  d = computeStall(d, { reasonHash: "R", signals: sig() }).progress; // 2
  ok(computeStall(d, { reasonHash: "R", signals: sig({ dispatchDone: 1 }) }).stallCount === 1, "dispatchDone advancing RESETS");

  // (3) A DISTINCT REASON resets the counter (different blocker -> not the same stall).
  let s = computeStall(null, { reasonHash: "R", signals: sig() }).progress;
  s = computeStall(s, { reasonHash: "R", signals: sig() }).progress; // 2
  const diff = computeStall(s, { reasonHash: "R2", signals: sig() });
  ok(diff.stallCount === 1 && !diff.sameReason, "a DIFFERENT reasonHash RESETS to 1");

  // (4) it takes a FULL fresh streak to re-stall after a reset.
  let t = computeStall(null, { reasonHash: "R", signals: sig() }).progress;       // 1
  t = computeStall(t, { reasonHash: "R", signals: sig() }).progress;              // 2
  t = computeStall(t, { reasonHash: "R", signals: sig({ head: "sha-9" }) }).progress; // reset 1
  t = computeStall(t, { reasonHash: "R", signals: sig({ head: "sha-9" }) }).progress; // 2
  const re = computeStall(t, { reasonHash: "R", signals: sig({ head: "sha-9" }) });    // 3
  ok(re.stalled, "after a reset, three more no-progress same-reason stops re-STALL");

  // (5) recordStop persists into a passed-in state object and returns the verdict (no disk).
  const state = {};
  const a = recordStop({ reasonHash: "R", signals: sig() }, { state, persist: false });
  ok(a.stallCount === 1 && !a.stalled, "recordStop returns the verdict shape { stalled, stallCount, sameReason }");

  if (fails.length) {
    console.error("progress-stall --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "progress-stall --self-test PASS — three identical no-progress stops STALL on the 3rd (K=3); a new commit (head), a " +
    "fresher VERIFY (verifyMtime), or a completed dispatch (dispatchDone) each RESET the streak to 1; a distinct reasonHash " +
    "RESETS; and re-stalling requires a full fresh streak."
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

  // stdin JSON { reasonHash, signals } OR flags.
  let stop = {};
  try { stop = JSON.parse(readFileSync(0, "utf8")); } catch { /* no stdin */ }
  if (flag("--reason-hash")) stop.reasonHash = flag("--reason-hash");
  if (!stop.signals) stop.signals = {};
  if (flag("--head")) stop.signals.head = flag("--head");
  if (flag("--verify-mtime")) stop.signals.verifyMtime = Number(flag("--verify-mtime"));
  if (flag("--dispatch-done")) stop.signals.dispatchDone = Number(flag("--dispatch-done"));

  const res = recordStop(stop, { root: process.cwd() });
  if (json) console.log(JSON.stringify(res, null, 2));
  else console.error(`progress-stall: stallCount=${res.stallCount} sameReason=${res.sameReason} stalled=${res.stalled}`);
  process.exit(0);
}
