---
slice: "os-upgrade-path / os-inherit (v6 — every project inherits)"
verify_status: verified
author: "claude-opus main build session 2026-06-14"
verifier: "qa-test subagent (independent, 2026-06-14)"
date: "2026-06-14"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/os-inherit.mjs check --from . --into <synced-project>  # exit 0 = inherited capabilities byte-current; non-zero = DRIFT/MISSING (fail-closed)"
---

# VERIFY — Slice os-upgrade-path / os-inherit (v6 — every project inherits)

## Verdict
**verify_status:** `verified` · The OS upgrade path works end-to-end: a clean project inherits exactly the manifest's tools+contracts+skills byte-for-byte, `check` is fail-closed on both DRIFT and MISSING (naming the file), the set is manifest-driven, and an inherited gate actually runs self-contained from the vendored copy. All 7 acceptance criteria PASS on their own surface (real execution, not description).

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test subagent · distinct invocation 2026-06-14 · ran its own `mktemp -d` dirs and re-executed `os-inherit.mjs` directly.
- Author identity (code under test): claude-opus main build session 2026-06-14 (authored `os-inherit.mjs` + `os-foundation.manifest.json`).
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** — a true second invocation against the engineer's checkout, using verifier-owned temp dirs and verifier-chosen tamper/delete fixtures.

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim / key line) |
|---|---------|------|------------------------------|
| 1 | `os-inherit.mjs sync --from <OS> --into <tmpA>` | 0 | `vendored 8 file(s)` — 7 under `.claude/os/tools/` (6 tools + 1 contract) + `learning-review/SKILL.md` + `INHERITED.json` |
| 2 | `diff` canonical vs vendored for experience-gate.mjs / admin-plos-seam-v1.mjs / seam-gate.mjs | 0,0,0 | all `IDENTICAL`; recorded sha256 `99da9773…c6b0` == `sha256sum` of vendored experience-gate.mjs |
| 3 | `os-inherit.mjs check` on freshly-synced tmpA | 0 | `PASS: every inherited capability is byte-current with the OS.` |
| 4 | append `// TAMPERED` to vendored workflow-gate.mjs; `check` | 1 | `FAIL: 1 inheritance violation(s): - DRIFT: .claude\os\tools\workflow-gate.mjs differs from canonical` |
| 5a | delete vendored seam-gate.mjs; `check` | 1 | `FAIL … - MISSING: .claude\os\tools\seam-gate.mjs (… project has not inherited this capability)` |
| 5b | `check` on a project that NEVER synced (empty tmp) | 1 | `FAIL: 8 inheritance violation(s)` — every manifest file reported MISSING |
| 6 | `sync --from <OS-copy with experience-gate removed from manifest> --into <tmp>` | 0 | `vendored 7 file(s)`; experience-gate.mjs ABSENT in target |
| 7 | `echo '[{"surface":"x","available":true,"latencyMs":56000}]' \| node <tmpA>/.claude/os/tools/experience-gate.mjs` | 1 | `[BROKEN] x 56000ms/4000ms — TOO SLOW`; `FAIL: 1 experience violation(s)` |

**Machine-guard line:** No shared store/queue/port touched. Each scenario ran in its own `mktemp -d` (or a verifier-unique native temp path for the criterion-6 OS copy); all temp dirs removed at end.

## Acceptance criteria  (verbatim from the slice — each PASS/FAIL + evidence)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | Inherit into a clean project: sync vendors exactly the manifest set + INHERITED.json | real `sync` into empty `mktemp -d`; `find .claude` | #1 | PASS |
| 2 | Byte-identical; INHERITED.json records sha256 per file | `diff` (3 files incl. experience-gate + admin-plos-seam) + sha cross-check | #2 | PASS |
| 3 | `check` PASS in-sync, exit 0, "every inherited capability is byte-current" | `check` on synced project | #3 | PASS |
| 4 | `check` FAIL on drift, non-zero, names DRIFT file | tamper vendored file + `check` | #4 | PASS |
| 5 | `check` FAIL on missing/un-inherited, names MISSING file | delete vendored file + never-synced project | #5a, #5b | PASS |
| 6 | Manifest-driven, not hardcoded | sync from reduced-manifest OS copy + `plan()` reads `man.tools/contracts/skills` | #6 + code | PASS |
| 7 | Inherited capability is real — runs self-contained from vendored copy | run vendored experience-gate.mjs from temp project | #7 | PASS |

> Every criterion exercised its own surface: actual `node os-inherit.mjs` invocations and an actual run of a *vendored* tool — no reading-code-instead-of-running, no canonical-source shortcut.

## Surface statement  (anti-Slice-1.0)
- Real surface: the `os-inherit.mjs` CLI (`sync`/`check`) operating on a real consuming-project filesystem, plus the vendored tool executing standalone. Driven by direct `node` invocations against verifier-owned temp project dirs.
- [x] No criterion verified via a bypassing surface. Criterion 7 specifically runs the *inherited copy* (`<tmp>/.claude/os/tools/experience-gate.mjs`), not the canonical OS file, proving self-containment with no sibling OS mounted.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| sync vendors exactly the manifest's 6 tools + 1 contract + 1 skill file (8 total) | Confirmed (#1) | Blocker-class — PASS |
| Vendored bytes == canonical; INHERITED.json sha256 matches actual | Confirmed (#2) | Blocker-class — PASS |
| check is fail-closed on DRIFT and on MISSING/never-synced, naming the file | Confirmed (#4,#5a,#5b) | Blocker-class — PASS |
| The set is manifest-driven (`plan()` reads manifest arrays; reduced manifest → reduced sync) | Confirmed (#6 + code review of plan()) | Should-fix-class — PASS |
| Inherited tool runs self-contained (zero-dep, no OS mounted) | Confirmed (#7, exit 1 BROKEN) | Blocker-class — PASS |
| Agents (integration-architect, founder-experience-reviewer) propagate via os-sync, NOT os-inherit | Confirmed (sync output states it; not in scope of this tool) | Safe-to-defer |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (tool runs, zero-dep) | ✅ | #1,#3,#7 all execute cleanly on Node v22 |
| Dedicated commit + slice id (or NO-GIT flagged) | ⬜ NO-GIT | verifier instructed: do NOT commit; this VERIFY doc is uncommitted |
| CI green — machine-read at merge | ⬜ | n/a this run (no PR opened by verifier) |
| Migration reversible / fresh-DB | n/a | no DB/migration in this slice |
| Failure paths → honest error, no false success | ✅ | #4 (drift) + #5 (missing) both exit non-zero with specific, honest messages; no false PASS |
| Manifest-driven (not hardcoded) | ✅ | #6 |

## FAIL history
- 2026-06-14 — none. (Note: criterion 6 required one re-run — my *first* attempt used a Git-bash `/tmp` path that Node resolved to `c:\tmp`, so my hand-rolled manifest-copy never landed where Node read it and os-inherit silently fell back to reading the real OS manifest. This was a verifier-harness path bug, NOT a defect in os-inherit.mjs; the clean re-run with a native temp path PASSED — see #6. Recorded for honesty.)

## Bug reports
None. No defects found in `os-inherit.mjs` or `os-foundation.manifest.json`.

### Minor observations (non-blocking, author-ward — informational, not gating)
1. [Safe-to-defer] Violation messages render the vendor rel-path with backslashes on Windows (`.claude\os\tools\…`) while `INHERITED.json` normalizes to forward slashes. Cosmetic only — the file is unambiguously identified; consider normalizing the check-output path for cross-platform consistency.
2. [Safe-to-defer] `check` does not flag *extra* un-manifested files present under `.claude/os/tools/` (e.g. a stale tool left after it's removed from the manifest). Out of the stated acceptance scope (drift + missing are covered), but a future "orphan" check would make inheritance fully reconciling.
