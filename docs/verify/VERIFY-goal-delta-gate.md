---
slice: "governance/H9 — verifier-driven goal-delta gate + M1 metric ledger"
verify_status: executed
author: "software-engineer (claude-opus-4-8 build session, branch feat/governance-goal-delta-gate-clean)"
verifier: "UNASSIGNED — independent QA required (author≠verifier, Governance §3/§12)"
date: "2026-06-28"
independence_basis: "NOT YET ESTABLISHED — this is an author self-check; status is capped at `executed` pending an independent verifier"
machine_probe: "node templates/tools/goal-init.mjs --self-test && node templates/tools/goal-progress.mjs --self-test && node templates/tools/goal-stop.mjs --self-test && node templates/tools/boundary-classify.mjs --self-test"
---

# VERIFY — Slice governance/H9 verifier-driven goal-delta gate

## Verdict
**verify_status:** `executed` · one line: every gate below was exercised by the AUTHOR and passes, but
author ≠ verifier is NOT yet satisfied — an INDEPENDENT QA run is required before this caps at `verified`.

> Honest limit (§12): the author wrote and ran these checks. This artifact proves the mechanism EXISTS
> and behaves as designed under the author's hand; it does NOT prove an independent lens reproduced it.
> Promote to `verified` only after a distinct verifier re-runs the self-tests + the live escalation cases.

## What was built (the consensus design from POSTMORTEM-2026-06-28 §E2/§F)
1. **Verifier-driven acceptance-delta gate (primary, the teeth).** `templates/hooks/verify-gate.mjs`
   (Stop path) now scans VERIFY artifacts for `goal_metric_reachable: false`; an independent verifier's
   `false` ESCALATES a Founder Action Package / strategy-review (reuse `skills/founder-action-package` +
   `templates/tools/boundary-classify.mjs`), with the verifier's finding as re-checkable evidence.
   - `scanGoalDeltaFindings()` — `templates/hooks/verify-gate.mjs:282`
   - `escalateGoalDelta()` / `clearGoalDeltaMarker()` — `templates/hooks/verify-gate.mjs:305` / `:304`
   - wired into Stop mode — `templates/hooks/verify-gate.mjs:428` (`scanGoalDeltaFindings()` + escalate/clear)
   - `GOAL_DELTA_MARKER` (`.claude/.goal-delta-escalation.json`) — `templates/hooks/verify-gate.mjs:63`
2. **M1 metric ledger.** `templates/tools/goal-init.mjs` gains an OPTIONAL `acceptance:{metric,op,target}`
   block + an empty append-only `progress:[]` (`buildAcceptance()` `:61`; `buildState()` `:79`; `--metric/--op/--target` CLI `:204`).
   New main-loop tool `templates/tools/goal-progress.mjs` appends `progress[]{turn,value,predicted,fix_ref}`
   each cycle (`appendProgress()` `:36`, `summarize()` `:63`).
3. **VERIFY input surface.** `templates/VERIFY.md.template` gains `goal_metric_reachable` / `metric_value`
   / `metric_target` (optional verifier fields).
4. **Contract + inheritance.** `capabilities/GOAL-EXECUTION-CONTRACT.md` H9 added (§8) + §7 inheritance
   updated; `capabilities/os-foundation.manifest.json` lists `templates/tools/goal-progress.mjs`.

## Execution evidence (direct runtime output)
| # | Command | Exit | Output (verbatim, abridged) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/goal-init.mjs --self-test` | 0 | `goal-init --self-test PASS … the M1 acceptance metric is OPTIONAL and, when present, STEERS but NEVER enters clears_on (the steers-not-gates invariant); progress[] starts empty; bad --op / --target fail closed.` |
| 2 | `node templates/tools/goal-progress.mjs --self-test` | 0 | `goal-progress --self-test PASS … the INVARIANT holds (clears_on is never touched and status never flips, even when the metric is REACHED — the metric STEERS, it never gates exit) … a blank value fails closed.` |
| 3 | `node templates/tools/goal-stop.mjs --self-test` | 0 | `goal-stop --self-test PASS …` (REGRESSION: kernel hook unchanged, all H1/H4/H6/H7 paths still pass) |
| 4 | `node templates/tools/boundary-classify.mjs --self-test` | 0 | `boundary-classify --self-test PASS …` (REGRESSION: unchanged, still pass) |
| 5 | live Stop hook, VERIFY with `goal_metric_reachable: false` (author≠verifier) | 0 | stderr `GOAL-DELTA ESCALATION …`; `.claude/.goal-delta-escalation.json` written with `escalation:"goal_metric_unreachable"`, `directive:"emit-founder-action-package:strategy-review"`, `independent:true`, `metric_value:8 / metric_target:20` |
| 6 | same VERIFY flipped to `goal_metric_reachable: true` | 0 | NO escalation printed; marker CLEARED |
| 7 | VERIFY with the field ABSENT | 0 | NO escalation; NO marker (passes unchanged) |
| 8 | `goal-init --metric floor_contacts --op ge --target 20` then 2× `goal-progress --value 8` | 0 | `clears_on:["objective_complete","valid_fap_at_boundary"]` (UNCHANGED); `status:active`; `progress samples:2`; `metric leaked into clears_on? false`; `--show` reports `latest=8 (NOT reached) … ⚠ FLAT` |

## Acceptance criteria (from the task)
| # | Criterion | Surface | Evidence | PASS/FAIL |
|---|-----------|---------|----------|-----------|
| 1 | VERIFY `goal_metric_reachable: false` → gate escalates / FAPs | live Stop hook on real verify-gate.mjs | #5 | PASS |
| 2 | `true` or absent → passes unchanged | live Stop hook | #6, #7 | PASS |
| 3 | M1 ledger: `acceptance{metric,op,target}` + `progress[]{turn,value,predicted,fix_ref}` | goal-init + goal-progress, on-disk state | #1, #2, #8 | PASS |
| 4 | INVARIANT: metric STEERS, never gates — `clears_on` stays structural pair | on-disk `.goal-state.json` after init + progress | #1, #2, #8 | PASS |
| 5 | NO auto-panel rung + NO probe network-I/O added to kernel `goal-stop.mjs` | `git diff` empty; `grep` 0 matches | see "Invariants" below | PASS |
| 6 | Existing tool self-tests still pass (no regression) | self-tests | #3, #4 | PASS |
| 7 | H9 amended into contract; wired to manifest + scaffolder surface | contract + manifest + VERIFY template | files changed | PASS (author-asserted; needs independent read) |

## Invariants preserved (explicit confirmation)
- **NO auto-panel `redirect` rung.** `templates/tools/goal-stop.mjs` is byte-unchanged (`git diff` empty).
  The auto-redirect panel (governance-lens M2/M3/M4) is DEFERRED and documented as such in the contract H9
  (it requires solving frame-inheritance first; a Stop hook cannot spawn fresh independent context).
- **NO probe network I/O in the kernel hook.** `grep -nc "fetch|http|execSync|probe|network" templates/tools/goal-stop.mjs`
  → `0`. The kernel's zero-I/O fail-closed posture is intact. H9 detection lives in `verify-gate` (Stop),
  which already parses VERIFY frontmatter; the halt is the existing FAP path (boundary = STOP = SUCCESS).
- **Metric never gates exit.** `goal-progress.mjs` only appends to `progress[]` and explicitly re-pins
  `clears_on` + `status` from the prior state (defense-in-depth); the self-test asserts a REACHED metric
  still does not clear the goal (#2, #8). `clears_on` is never the metric — the §5 human-gated-terminal
  bug is not reintroduced.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| The escalation marker gives "teeth" because the orchestrator reads it and emits a FAP | Assumption | Should-fix — same orchestrator-cooperation model as the existing auto-verify advisory; the binding halt is goal-stop + the FAP. An independent QA should confirm the end-to-end loop (escalation → FAP emitted → goal-stop clears as boundary). |
| `.claude/hooks/verify-gate.mjs` (the self-installed copy) also needs re-sync from templates/ for the dogfood to be live | Confirmed | Safe-to-defer — per CLAUDE.md the self-install lag is a known, separately-ratified step; canonical source is `templates/`. This slice changes canonical only. |
| Escalation fires even for a NON-independent verifier (author==verifier) | Confirmed (by design) | Safe-to-defer — escalation cost is one strategy review (eager-trigger); independence is recorded in the marker, not required to fire. An independent verifier should confirm this is the intended posture. |

## Bug reports
- none found by the author. Independent QA: please attempt to (a) silence the escalation by author==verifier,
  (b) make `goal-progress` mutate `clears_on`, (c) trip the kernel into any I/O — all three should be impossible.

## FAIL history
- none (no failed runs).
