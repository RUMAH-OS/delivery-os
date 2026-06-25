---
slice: "ci-release-orchestrator — CI & Release Orchestrator (encoded failure->fix KB + human-gated state machine)"
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/ci-release-orchestrator.mjs --self-test"
test_pins_amended_by: ""
---

# VERIFY — Slice ci-release-orchestrator (CI & Release Orchestrator)

## Verdict
**verify_status:** `verified`  ·  one line: the F2 regression the prior QA caught is genuinely fixed —
`failingStep`/`workflow` are now CORROBORATING-only (never disqualifying), and a real next-build OOM
surfacing under the required `verify` check now classifies **F2** on the **live `orchestrate` evidence
surface** (proven via injected-IO drive, not source-reading). All other classes (F1/F3/F4/F5) still
classify on their live shapes, unrelated red is fail-closed UNCLASSIFIED, and the human-only merge gate
plus fail-closed preflight are intact and unchanged.

> Reaches `verified`: every acceptance criterion PASSES on its OWN (live) surface — driven through the
> real `orchestrate` state machine with a spy IO that emits the exact evidence the live diagnoser builds
> (`failingStep` = CHECK name). The prior `rejected` run's defect (F2 → UNCLASSIFIED) is reproduced on the
> OLD matcher shape and shown resolved on the new one. Safety invariants re-confirmed unchanged.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: `independent-qa-subagent` · distinct QA invocation · 2026-06-25 (NOT the build session)
- Author identity (code under test): `implementation-session(coordinated)` — authored `templates/tools/ci-release-orchestrator.mjs` @ `98c2be2`
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real**: a separate QA invocation that built its OWN injected-IO harness OUTSIDE the
  repo tree (`/tmp/qa-harness-cro.mjs`, `/tmp/qa-gate.mjs`, both deleted after) and drove the LIVE
  `orchestrate` path — it did not reuse the engineer's `--self-test` fixtures as its sole evidence.

## Execution evidence  (Governance §1 — direct runtime output, never a description of what *would* happen)
| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `node templates/tools/ci-release-orchestrator.mjs --self-test` | 0 | `ci-release-orchestrator --self-test PASS — 5 LIVE-SHAPE signal fixtures classify correctly (F1–F5 using the real orchestrate evidence contract [failingStep = CHECK name], incl. LIVE-SHAPE F2 OOM under the 'verify' check -> F2, + experience-review->F5 + unrelated->none), safe-to-auto split holds (SAFE:[F2,F3] APPROVAL:[F1,F4] NEVER:[F5], F3-real=NEEDS-APPROVAL), merge gate is human-only (no auto-merge without --merge; --merge cannot override red/missing).` |
| 2 | live-drive harness `orchestrate({pr,io:spy})` — F2 OOM under required `verify` check | 0 | `=== F2 live-shape (OOM under 'verify' check) ===` / `classifications: ["F2"]` / `result: awaiting-human` |
| 2b | same live evidence vs OLD buggy matcher (failingStep mandatory) vs fixed | 0 | `BEFORE (buggy failingStep-mandatory) classifies F2?: false (expected false = the bug)` / `AFTER (fixed classifyFailure) classifies: F2 (expected F2)` |
| 3 | live-drive F1/F3/F4/F5 + unrelated | 0 | `F1 -> ["F1"]` · `F3 -> ["F3"]` · `F4 -> ["F4"]` · `F5 -> ["F5"]` · `UNRELATED(eslint) -> ["UNCLASSIFIED"] result: escalated` |
| 4 | merge-gate drive (A–G) | 0 | `A) no --merge: result= awaiting-human mergeGate.action= await-human command= node merge-pr.mjs 1 ghMergeCalled= false` / `B) --merge all-green: result= ok merged= true ghMergeCalled= true args= ["pr","merge","1","--squash"]` / `C) decideMerge oneRed+merge: {"action":"blocked",...,"notPass":["verify"]}` / `D) decideMerge missing+merge: {"action":"blocked","missing":["experience-review","founder-experience-scorecard"]}` / `E) gh-missing: result= error` / `F) gh-unauthed: result= error` / `G) zero-checks: result= blocked` |
| 5 | `node --check` both copies + `diff` + `sha256sum` | 0 | `templates OK` / `.claude OK` / `IDENTICAL` / both = `6fd2dba50576c928c9464981d0cf4d8e69d53354c9f61b35f6e5bea577543c63` |

> Machine-guard line: no shared store/queue/port touched. The harness used an **injected IO** (no real
> `gh`/`git`/network/filesystem in the dry-run-ish path; `io.git()` throws if invoked, proving no mutation),
> and lived OUTSIDE the repo tree. Repo working tree was confirmed free of harness/orchestrator artifacts
> after the run.

## Acceptance criteria  (each PASS/FAIL + its evidence pointer)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | Self-test passes, exit 0, uses LIVE-SHAPE fixtures (failingStep = CHECK name; F2 OOM under `verify`) | self-test code path | #1 (+ source: fixtures L553–582 set `failingStep:"verify"`; explicit LIVE-SHAPE F2 guard L578–580) | PASS |
| 2 | F2 OOM under live `verify`-check evidence classifies **F2** (was UNCLASSIFIED) via the diagnoser `orchestrate` uses | LIVE `orchestrate` state machine, spy IO | #2 | PASS |
| 2b | Before/after proof: OLD failingStep-mandatory matcher → false on the SAME evidence; fixed → F2 | classifier on identical live evidence | #2b | PASS |
| 3a | F1 conformance logRegex classifies F1 on live shape | LIVE path | #3 | PASS |
| 3b | F3 deploy workflow / invalid-Node classifies F3 on live shape | LIVE path | #3 | PASS |
| 3c | F4 mergeable CONFLICTING classifies F4 on live shape | LIVE path (pr-state evidence) | #3 | PASS |
| 3d | F5 experience check classifies F5 on live shape | LIVE path | #3 | PASS |
| 3e | Unrelated red → UNCLASSIFIED, fail-closed (never guesses a fix) | LIVE path | #3 | PASS |
| 4 | Human-only merge gate: no `gh pr merge` without `--merge` AND all 3 required checks green; `--merge` cannot override red/missing | LIVE `orchestrate` + `decideMerge` | #4 (A: no merge call without `--merge`; B: only merge on all-green+`--merge`; C/D: `--merge` blocked on red/missing) | PASS |
| 5a | `node --check` both copies clean | syntax | #5 | PASS |
| 5b | `.claude/tools/` copy byte-identical to `templates/tools/` | sha256/diff | #5 | PASS |
| 5c | Zero-dep (node: builtins only) | imports L30–33 | source: `node:child_process` `node:fs` `node:path` `node:url` only | PASS |
| 5d | Fail-closed on gh-missing / gh-unauthed | LIVE preflight | #4 (E,F) | PASS |

> Every criterion was exercised on its OWN surface: classification criteria driven through the real
> `orchestrate` diagnoser (which constructs `failingStep = c.name`), not by hand-built classifier fixtures
> alone. This is the surface the prior `verified` draft bypassed and the prior `rejected` run exposed.

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: a deterministic CLI/library state machine (`orchestrate`) over a data-driven
  failure-class KB, plus a human-gated merge decision. Driven by: an injected `io` spy that returns the
  exact `gh pr checks` / `gh pr view` / `gh run view --log-failed` shapes the live code consumes, so
  `orchestrate` builds its own evidence objects (`{checkName, failingChecks, log, failingStep:c.name,
  workflow}`) — the live shape, not a synthetic one.
- [x] No criterion was "verified" via a surface that bypasses the slice. The F2 classification was reached
  through `orchestrate`'s own `classifyFailure(ev)` call on `orchestrate`-constructed evidence (#2), and the
  before/after proof reuses that identical evidence object against the prior buggy matcher (#2b).

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| F2 next-build OOM under the required `verify` check now classifies F2 on the LIVE diagnoser surface | Confirmed (#2) | — |
| The prior bug (failingStep-mandatory → UNCLASSIFIED) is the one fixed, on identical evidence | Confirmed (#2b) | — |
| F1/F3/F4/F5 + unrelated still classify correctly on live shapes (no regression) | Confirmed (#3) | — |
| Human-only merge gate unchanged: no merge without `--merge`+all-green; `--merge` cannot override red/missing | Confirmed (#4 A–D) | — |
| Fail-closed on gh-missing/unauthed/zero-checks | Confirmed (#4 E–G) | — |
| Both copies byte-identical + syntactically valid + zero-dep | Confirmed (#5) | — |
| The corroborating fields (`failingStep`/`workflow`/`failingFiles`) are genuinely never evaluated as discriminators | Confirmed — `matchesSignal` (L167–196) only branches on `logRegex`/`mergeable`/`checkName`; corroborating fields have no code path | Safe-to-defer |
| The live SAFE-TO-AUTO fixers (`applyF2`/`applyF3Partial`+commit/push) were NOT exercised against a real workflow file | Unverified (out of scope: requires `--apply-safe` + a real repo mutation; the dry-run-ish path proven never invokes `io.git`) | Safe-to-defer |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (self-test) | ✅ | #1 (exit 0) |
| Dedicated commit + slice id | ⬜ | HEAD `98c2be2` on `feat/ci-release-orchestrator-tool`; coordinator commits tool-state + this VERIFY together through the gate (per instruction, QA does not commit) |
| **CI green — machine-read at merge** | ✅ (by design) | Merge routes through `decideMerge` reading the checks API; `--merge` cannot override red/missing (#4 C,D). No piped/watched output path to merge. |
| Migration reversible | n/a | no DB/migration in this slice |
| Failure paths → honest error, no false success | ✅ | gh-missing/unauthed → `result: error` (#4 E,F); zero-checks → `blocked` (#4 G); unrelated red → UNCLASSIFIED escalation, never a guessed fix (#3) |
| Human-only merge gate intact | ✅ | #4 A–D; single `pr merge` call site (L411) guarded by `decision.action === "merge"` |
| Zero-dep / both-copies-identical | ✅ | #5 |

## FAIL history  (kept in-doc — never overwritten)
- 2026-06-25 — **FAIL (prior QA run, this slice):** F2 next-build-OOM classified UNCLASSIFIED on the live
  surface because the matcher treated F2's `failingStep: "Build (next build)"` as a MANDATORY discriminator,
  while `orchestrate` sets `failingStep` to the CHECK name (`"verify"`). A SAFE-TO-AUTO capability was silently
  disabled and masked by a non-representative self-test fixture. **Re-verification (this run):** fix confirmed
  — `matchesSignal` (L167–196) no longer evaluates `failingStep`/`workflow` as discriminators (comment L187–193);
  live-drive #2 shows `["F2"]`; before/after #2b shows the OLD shape returns `false` and the new returns `F2`
  on identical evidence; self-test now carries an explicit LIVE-SHAPE F2 guard (L578–580). Status: RESOLVED.

## Bug reports
- None. No new defect found. The single open item is a scoped non-finding: the live SAFE-TO-AUTO file-mutating
  fixers (`applyF2`/`applyF3Partial`) were not driven end-to-end against a real workflow file (requires
  `--apply-safe` + an intentional repo mutation, out of scope for this regression verification). The
  dry-run-ish path was proven to never invoke `io.git` (spy throws if called), so no unintended mutation risk.
