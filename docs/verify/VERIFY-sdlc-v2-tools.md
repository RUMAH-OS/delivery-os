---
verify_status: verified
slice: sdlc-v2-tools
author: implementation-session(coordinated)
verifier: independent-qa-subagent
date: 2026-06-25
machine_probe: node templates/tools/stall-classify.mjs --self-test
---

# VERIFY — SDLC v2 Tools (Classifier + Detector Suite)

## Test Results

### 1. change-classify --self-test
**Status: PASS**

```
change-classify --self-test PASS — fail-safe + C-wins + A-opt-in proofs:
  [C-wins/keyword] src/lib/pricing.ts + price body         -> C  "CONSEQUENTIAL (C wins): body keyword(s): price — human-gated, never auto."
  [C-wins/control]  .github/workflows/promote-to-prod.yml  -> C  "CONSEQUENTIAL (C wins): path(s): .github/workflows/promote-to-prod.yml [control-plane] — human-gated, never auto."
  [A-optin/clean]   tests/**.test.ts (clean, small)        -> A  "AUTO-SAFE: every path is A-allowlisted (2), clean of B/C, under the size cap."
  [A-optin/proof]   tests/foo.test.ts + weird/thing.xyz    -> B  "fail-safe -> B: unmatched/novel path(s): weird/unknown/thing.xyz (A is opt-in; an unproven path is never auto)."
  [oversize->B]     30x src/*.ts                           -> B  "escalate A->B: size 30 files / 0 LOC exceeds cap (25 files / 400 LOC)."
  [novel->B]        config/strange.weirdext                -> B  "fail-safe -> B: unmatched/novel path(s): config/strange.weirdext (A is opt-in; an unproven path is never auto)."
  [visible->B]      src/pages/Dashboard.tsx                -> B  "VISIBLE: src/pages/Dashboard.tsx [visible] — needs human eyes."
  [ambiguous->B]    src/lib/util.ts + src/ui/Button.jsx     -> B  "VISIBLE: src/ui/Button.jsx [visible] — needs human eyes."
  [parse-err->B]    tests/foo.test.ts (config broken)       -> B  "fail-safe -> B: classification.json parse error — A withheld (the rule table cannot be trusted)."
change-classify --self-test PASS — C WINS over everything (a body keyword or a control-plane/deny path forces C even on an otherwise-A path); A is OPT-IN (earned only when EVERY path is A-allowlisted, clean of B/C, and under the size cap — one novel path, one visible file, an oversize diff, an empty change, or a broken classification.json all fall to B); ambiguous/novel/unmatched ALWAYS -> B, never A.
```

### 2. verified-tree --self-test
**Status: PASS**

```
verified-tree --self-test PASS — the marker is keyed on the squash-INVARIANT tree hash (identical tree -> HIT, mutated tree -> MISS); fail-CLOSED throughout (a lookup error or an invalid hash is a MISS, never a false 'verified'); and mark is DRY by default (prints the ref + command, pushes nothing), with --push able to target ONLY refs/delivery-os/verified/* — structurally never a branch.
```

### 3. progress-stall --self-test
**Status: PASS**

```
progress-stall --self-test PASS — three identical no-progress stops STALL on the 3rd (K=3); a new commit (head), a fresher VERIFY (verifyMtime), or a completed dispatch (dispatchDone) each RESET the streak to 1; a distinct reasonHash RESETS; and re-stalling requires a full fresh streak.
```

### 4. stall-classify --self-test
**Status: PASS**

```
stall-classify --self-test PASS — fail-safe ordering + B4 (bypass-is-gone) proofs:
  [order-1 founder]  merge gate-state reason            -> founder-action / emit-FAP-terminate
  [order-2 impl]     verify_status: failed              -> impl-defect / route-author-ward
  [order-3 agent]    agent past deadline                -> agent-failure / kill-respawn
  [order-4 residual] empty repeat (no boundary/red/agent) -> orchestration-failure / escalate-to-failure-FAP
  [bypass-is-last]   boundary|red|agent + emptyRepeat   -> founder|impl|agent (residual escalation NEVER fires)
stall-classify --self-test PASS — the must-never-bypass causes are decided FIRST: a founder boundary (gate-state/credential/approval/deploy-auth) -> founder-action/emit-FAP-terminate; a real red (verify_status:failed / a FAILURE_CLASS) -> impl-defect/route-author-ward; a hung agent -> agent-failure/kill-respawn. The residual orchestration-failure -> escalate-to-failure-FAP and is chosen ONLY when no boundary, no red, and no hung agent is present — proven by adding emptyRepeat to each higher signal and seeing the higher cause win every time. B4: NO sanctioned action proceeds/bypasses/skips a gate (closed table + a runtime guard) — the residual cause escalates to a disposition:failure FAP (H1 collapse), structurally incapable of skipping a verify-gate / merge-gate / boundary.
```

### 5. Syntax Check (node --check)
**Status: PASS**

```
ALLCHECK-OK
```

All four tool files passed Node.js syntax validation:
- `templates/tools/change-classify.mjs` ✓
- `templates/tools/verified-tree.mjs` ✓
- `templates/tools/progress-stall.mjs` ✓
- `templates/tools/stall-classify.mjs` ✓

### 6. Orchestration-Failure Action Verification (B4: Escalate-Only, No Proceed Path)
**Status: PASS**

```
5:// performs NO effectful action (no merge / deploy / push / bypass).
8:// act. The ORDERING is a fail-safe: the must-never-bypass causes are decided FIRST,
20://                              action: 'escalate-to-failure-FAP'
23://     proceed past any gate. "No progress" is INDISTINGUISHABLE from a gate that is
27://     forced-failure-FAP. There is NO code path in this module that returns "proceed",
28://     "bypass", or anything that skips a verify-gate / merge-gate / boundary. The
44:// 'proceed' / 'bypass' / 'skip-gate' action anywhere in this table. The residual
50:  "orchestration-failure": "escalate-to-failure-FAP",
114:    if (/proceed|bypass|skip/i.test(action)) throw new Error(`illegal action ${action} — stall-classify must never skip a gate`);
118:  // 1) FOUNDER-ACTION (must-never-bypass) — a founder boundary.
131:  //    It does NOT proceed past anything: it escalates to a failure FAP (H1 collapse).
140:// SELF-TEST (pure). Proves the fail-safe ORDERING and that the bypass is gone:
141:// orchestration-failure escalates (never 'proceed'/'bypass'), and is NEVER chosen
164:  // (4) same-reason-no-red-no-boundary -> orchestration-failure / escalate-to-failure-FAP (and ONLY then)
166:  ok(c4.cause === "orchestration-failure" && c4.action === "escalate-to-failure-FAP", "empty repeat -> orchestration-failure / escalate-to-failure-FAP");
171:  ok(c4.action === "escalate-to-failure-FAP", "residual action is escalate-to-failure-FAP");
172:  ok(!/proceed|bypass|skip/i.test(c4.action), "residual action contains NO proceed/bypass/skip");
174:  ok(Object.values(SANCTIONED_ACTIONS).every((a) => !/proceed|bypass|skip/i.test(a)), "NO sanctioned action skips a gate");
190:  log.push("  [bypass-is-last]   boundary|red|agent + emptyRepeat   -> founder|impl|agent (residual escalation NEVER fires)");
206:  console.error("stall-classify --self-test PASS — fail-safe ordering + B4 (bypass-is-gone) proofs:");
```

**Critical Findings:**
- Line 50: `"orchestration-failure": "escalate-to-failure-FAP"` ✓ — Correct action
- Line 114: Runtime guard throws on `proceed|bypass|skip` patterns ✓ — Enforced
- Line 174: Self-test proves NO sanctioned action skips a gate ✓ — Verified
- **B4 Verdict: ESCALATE-ONLY. No proceed/bypass/skip-gate path exists. Residual cause structurally incapable of skipping a verify-gate / merge-gate / boundary.**

### 7. Manifest Registration (os-foundation.manifest.json)
**Status: PASS**

```
change-classify true stall-classify true
```

Both tools are registered in `capabilities/os-foundation.manifest.json`:
- `templates/tools/change-classify.mjs` ✓ registered
- `templates/tools/stall-classify.mjs` ✓ registered

## Summary

| Criterion | Result |
|-----------|--------|
| change-classify --self-test | **PASS** |
| verified-tree --self-test | **PASS** |
| progress-stall --self-test | **PASS** |
| stall-classify --self-test | **PASS** |
| node --check (all 4) | **PASS** |
| B4: escalate-to-failure-FAP only (no proceed path) | **PASS** |
| change-classify in manifest | **PASS** |
| stall-classify in manifest | **PASS** |

## Honest Limits

These tools are **shadow/observe-only classifiers and detectors** — they categorize change risk and detect stall/progress signals but issue no effectful auto-merge or auto-promote decisions. The Class-A auto-merge envelope is **founder-gated** per ADR-001/DECISIONS D3 and is **not wired in this build**. Each tool performs pure classification or detection; the orchestration loop that consumes these signals remains under human/founder gating.

## Verification Proof

- **Machine probe:** `node templates/tools/stall-classify.mjs --self-test` (run at verification)
- **Syntax validated:** All four tools pass `node --check`
- **Fail-safe architecture:** The ordering of cause detection + runtime guard on proceed/bypass/skip proves the stall-classifier is structurally incapable of bypassing a gate
- **Manifest proof:** Both tools are registered and discoverable

---

**Verification complete. No issues found. Ready for merge.**
