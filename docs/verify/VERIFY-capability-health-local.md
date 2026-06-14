---
slice: "capability-health (v6 governance; validate-the-validator)"
verify_status: verified
author: "claude-opus main build session 2026-06-15"
verifier: "qa-test subagent (independent, 2026-06-15)"
date: 2026-06-15
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/capability-health.mjs --self-test  # exit 0 = validator still classifies all known states correctly"
---

# VERIFY — Slice capability-health (v6 governance; validate-the-validator)

## Verdict
**verify_status:** `verified`  ·  All six acceptance criteria PASS on their own surface by independent execution. The two load-bearing proofs hold: the self-test catches misclassification (criterion 1) and the mutation proves the tool's output FOLLOWS real CI wiring rather than a hardcode (criterion 3, lifecycle-gate ALIVE↔INERT tracking the `lifecycle:check` line).

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test subagent · distinct recorded invocation · 2026-06-15 (NOT the build session)
- Author identity (code under test): claude-opus main build session 2026-06-15
- [x] I assert: the verifier did **not** author the production code under test. No production code was modified during verification.
- [x] Independence was **real** — a separate invocation against the on-disk tool; all evidence is direct runtime output.

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `node capability-health.mjs --self-test` | 0 | 6/6 PASS: known-wired→ALIVE, known-inert→INERT, not-inherited→MISSING, wired-but-not-vendored→ALIVE, drift→DRIFT, no-drift→ok. "PASS: classifies all known states correctly — it measures reality." |
| 2 | `node capability-health.mjs --project ../../../rumah-admin` | 1 | seam/lifecycle/workflow = ALIVE; experience-gate/skill-frontmatter/skill-route/learning-review = INERT. "FAIL: 4 capability(ies) ... INERT" |
| 3a | mutation: Admin-mirror fixture, `lifecycle:check` line removed from ci.yml | 1 | lifecycle-gate = **INERT** (flipped from ALIVE) |
| 3b | control: same fixture, `lifecycle:check` line present | 1 | lifecycle-gate = **ALIVE** |
| 4 | fixture: `seam:check` ONLY in package.json (no CI/hooks), seam-gate inherited | 1 | seam-gate = **INERT** (package.json NOT treated as auto-executed) |
| 6 | fixture: all 7 manifest capabilities wired in ci.yml | 0 | all 7 ALIVE; "PASS: every measured capability is wired-to-run" |

Cross-checks against real files (read directly, not via the tool):
- `rumah-admin/.github/workflows/ci.yml` lines 47/49/51 contain `npm run seam:check` / `lifecycle:check` / `workflow:check`; contains NO `experience:review`, `skill:route`, `validate-skills`, or `learning-review` tokens → the ALIVE/INERT split in evidence #2 matches reality.
- `rumah-admin/.claude/os/INHERITED.json` vendors all six `.mjs` gates plus `.claude/skills/learning-review/SKILL.md` → all 7 manifest capabilities are inherited (so the 4 unwired ones read INERT, not MISSING).
- Machine-guard: all fixtures created under a per-run `mktemp -d` directory (run-unique); the real `rumah-admin/.github/workflows/ci.yml` was confirmed unmodified by `git status --porcelain` (empty) and `git diff --stat` (empty) after the run; temp dir removed and confirmed gone.

## Acceptance criteria  (verbatim — each PASS/FAIL + evidence)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | Self-test passes; all 6 known-state cases PASS | `--self-test` execution | #1 | **PASS** |
| 2 | Measures Admin's REAL state (seam/lifecycle/workflow ALIVE; experience/frontmatter/route/learning-review INERT; exit 1), cross-checked vs ci.yml + INHERITED.json | `--project ../rumah-admin` + file reads | #2 + cross-checks | **PASS** |
| 3 | Validate-the-validator mutation: removing the gate's CI step flips ALIVE→INERT; restoring → ALIVE (classification follows wiring, not hardcode) | mutated/control Admin-mirror fixture | #3a/#3b | **PASS** |
| 4 | package.json NOT auto-executed: token only in package.json scripts → INERT | package-only fixture | #4 | **PASS** |
| 5 | Skill matching: learning-review (skill dir in INHERITED.json) recognized as inherited → INERT when unwired, not falsely MISSING | #2 (Admin) + INHERITED.json regex `skills/([^/]+)/` | #2 | **PASS** |
| 6 | Fail-closed: exit 1 when any INERT (#2/#3/#4); exit 0 when all ALIVE | all-wired fixture | #6 + #2 | **PASS** |

## Surface statement  (anti-Slice-1.0)
- Real surface: the executable `capability-health.mjs` run as a CLI (`--self-test` and `--project`), exercised against the REAL rumah-admin project and against constructed temp fixtures. Classification claims were independently cross-checked by reading the actual `ci.yml` and `INHERITED.json`.
- [x] No criterion was "verified" via a surface that bypasses the slice. The mutation criterion in particular was proven by CHANGING the input (CI wiring) and observing the output follow — not by reading the source.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Tool classifies by real CI/hook wiring, not hardcoded labels | Confirmed (mutation #3a/#3b flips the label) | Blocker-class — confirmed |
| Self-test detects misclassification | Confirmed (#1 exercises all 6 known states incl. drift / no-drift) | Blocker-class — confirmed |
| package.json deliberately excluded from "auto-executed" | Confirmed (#4 INERT) + source lines 62-73 read only `.github/workflows`, `.githooks`, `.claude/hooks` | Confirmed |
| Skill dirs matched by dir name, not basename | Confirmed (#5; regex line 81) | Confirmed |
| Real Admin ci.yml unmodified by verification | Confirmed (git status/diff empty post-run) | Confirmed |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (self-test) | ✅ | #1 exit 0 |
| Measures-reality (mutation tracks wiring) | ✅ | #3a/#3b |
| Fail-closed on INERT / clean on all-ALIVE | ✅ | #2/#4 exit 1; #6 exit 0 |
| Dedicated commit | ⬜ | not committed (per instruction: do NOT commit) |
| Failure paths → honest error, no false success | ✅ | INERT correctly fails the pipeline (#2/#3/#4) |
| Real-file non-mutation | ✅ | git status/diff empty post-run |

## FAIL history
- none

## Bug reports  (defects flow author-ward — verifier files, never fixes)
1. [Safe-to-defer / observation, not a defect] The `measure()` path does not surface DRIFT against a ledger even though `isDrift` is exported and self-tested; drift is only proven via `--self-test`, not emitted in `--project` output. This does not violate any stated acceptance criterion (drift is part of validate-the-validator, which passes), so it is noted for the author, not a FAIL. No action required for this slice.
