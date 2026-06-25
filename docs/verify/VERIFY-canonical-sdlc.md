---
slice: "canonical-sdlc — SDLC back-half ownership routing + post-commit auto-push hook"
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: 2026-06-25
independence_basis: "recorded-distinct-invocation"
machine_probe: "node scripts/ownership-gate.mjs --self-test"
---

# VERIFY — Slice canonical-sdlc (SDLC back-half routing + auto-push hook)

## Verdict
**verify_status:** `verified`  ·  one line: the 4 new SDLC routing rows resolve to the
correct specialists, no prior work-type regressed (backend catch-all is not shadowed,
most-specific-first order preserved), the post-commit hook is feature-branch-only /
ff-only / fail-soft / non-destructive, and neither change touches money/auth/PII/prod or
the verify/merge gates.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: independent-qa-subagent · distinct QA invocation · 2026-06-25
- Author identity (code under test): implementation-session(coordinated)
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation, not the same context restyled).

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `node --check scripts/ownership-gate.mjs` | 0 | (no output; valid syntax) |
| 2a | `node scripts/ownership-gate.mjs "deploy this release to production"` | 0 | `2 work-type(s)` · `deploy → deployment-operator` · `release → deployment-operator` · dominant `deploy → deployment-operator`; stdout `deployment-operator` |
| 2b | `node scripts/ownership-gate.mjs "clean up stale branches and consolidate prs"` | 0 | `1 work-type(s)` · `cleanup → software-engineer`; dominant `cleanup → software-engineer`; stdout `software-engineer` |
| 2c | `node scripts/ownership-gate.mjs "monitor ci and merge when green"` | 0 | `1 work-type(s)` · `ci → software-engineer`; dominant `ci → software-engineer`; stdout `software-engineer` |
| 3a | `node scripts/ownership-gate.mjs "add a migration"` | 0 | `database → database-data`; stdout `database-data` |
| 3b | `node scripts/ownership-gate.mjs "verify this slice"` | 0 | `verify → qa-test`; stdout `qa-test` |
| 3c | `node scripts/ownership-gate.mjs "review for scope"` | 0 | `review → reviewer-critic`; stdout `reviewer-critic` |
| 3d | `node scripts/ownership-gate.mjs "implement a backend tool"` | 0 | `1 work-type(s)` · `backend → software-engineer` (catch-all still fires, NOT shadowed); stdout `software-engineer` |
| 4 | `node scripts/ownership-gate.mjs --self-test` | 0 | 23/23 PASS — `PASS: ownership-gate self-test green` |
| 5 | `grep -n workType: scripts/ownership-gate.mjs` | 0 | order: security(58) → deploy(60) → release(61) → ci(62) → cleanup(63) → backend(65) — new rows precede the backend catch-all |

Verbatim self-test tail (#4):
```
  PASS  requiredOwner: backend → software-engineer
  PASS  detect: an unrelated task → [] (no false-positive)
PASS: ownership-gate self-test green (default-policy resilience · keyword+glob detection ·
order preserved · work-type→owner mapping · explicit-policy arg · unknown→null · no false-positive).
```

> Machine-guard line: no shared store/queue/port touched — ownership-gate is a pure
> string→owner resolver (reads only its in-memory DEFAULT_POLICY here; no project policy
> file present so the fail-closed built-in applies). The post-commit hook was read
> STATICALLY only — it was NOT executed against any real push (no network/git mutation).

## Acceptance criteria  (each PASS/FAIL + evidence pointer)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | `ownership-gate.mjs` parses (valid JS) | `node --check` | #1 | PASS |
| 2 | New SDLC routing: deploy+release→deployment-operator, cleanup→software-engineer, ci→software-engineer | running the CLI resolver | #2a/#2b/#2c | PASS |
| 3 | No regression: database/verify/review still resolve; backend catch-all still fires for generic build work (not shadowed); most-specific-first order preserved | running the CLI + self-test + source order | #3a–#3d, #4, #5 | PASS |
| 4a | Hook auto-pushes on FEATURE branch only — never main/master | static read of `templates/githooks/post-commit` L22 | below | PASS |
| 4b | Hook is fast-forward/safe — no `--force` | static read L26/L29 | below | PASS |
| 4c | Hook fails soft — a push failure does not corrupt the commit | static read L16/L27/L30/L32 | below | PASS |
| 4d | Hook contains no destructive git ops | static read full file | below | PASS |
| 5 | Neither change touches money/auth/PII/prod or the verify-gate/merge-gate itself | scope read of both files | below | PASS |

## Hook safety analysis (criterion 4 — `templates/githooks/post-commit`, static)
- **4a FEATURE-ONLY (PASS):** L21–22 — `branch=$(git rev-parse --abbrev-ref HEAD ...)` then
  `case "$branch" in main|master|HEAD|"") exit 0 ;;`. main, master, detached-HEAD, and the
  empty/unknown case all short-circuit to `exit 0` before any push. It is structurally
  impossible for this hook to push main/master.
- **4b FF-ONLY / NO FORCE (PASS):** the only push commands are `git push origin "$branch"`
  (L26) and `git push -u origin "$branch"` (L29). No `--force`, no `--force-with-lease`, no
  refspec rewrite. A plain push is fast-forward-only by default — a non-ff push fails rather
  than rewriting remote history, which routes to the fail-soft branch (4c).
- **4c FAIL-SOFT (PASS):** the script ends `exit 0` (L32) unconditionally; both push
  invocations are `... || printf 'AUTO-PUSH FAILED ...' >&2` — a failed push only emits a
  loud stderr warning and never changes exit status. post-commit runs AFTER the commit object
  exists, and this hook performs no working-tree/index/ref mutation, so a push failure cannot
  corrupt or unwind the commit. Explicit opt-out `AUTO_PUSH_OFF=1` (L23) also exits 0.
- **4d NO DESTRUCTIVE OPS (PASS):** the full command set is `git rev-parse` (read-only),
  `git push` (no force), and `printf`. No `reset`, `rebase`, `checkout`, `branch -D`,
  `push --force`, `clean`, `filter-branch`, or history rewrite anywhere in the file.

## Scope statement (criterion 5 — PASS)
- `scripts/ownership-gate.mjs` is a declarative work-type→owner routing resolver. It reads no
  secrets, touches no money/auth/PII/prod path, and does not modify `verify-gate.mjs` or
  `merge-pr.mjs`. The new rows only add advisory specialist routing; fail-closed behavior
  (unknown→null, advisory pick stands) is unchanged.
- `templates/githooks/post-commit` pushes verified commits of FEATURE branches to origin
  only. main reaches origin solely via PR → CI → merge-pr.mjs (branch protection intact); the
  hook does not modify, bypass, or weaken the verify-gate or merge-gate — it runs strictly
  after the pre-commit verify-gate has already passed.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| New SDLC rows resolve to the correct owners | Confirmed (#2a–#2c) | — |
| backend catch-all not shadowed by new rows; order most-specific-first | Confirmed (#3d, #4, #5) | — |
| No prior work-type regressed | Confirmed (#3a–#3d, #4) | — |
| Hook is feature-only / ff-only / fail-soft / non-destructive | Evidence-backed (static read; not executed against a real push) | Safe-to-defer |
| Neither change touches money/auth/PII/prod or the gates | Confirmed (scope read) | — |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green | ✅ | #1, #4 (self-test 23/23) |
| Dedicated commit + slice id | ⬜ | uncommitted working-tree change (by instruction — do NOT commit) |
| CI green — machine-read at merge | ⬜ | not yet at PR/merge (out of this QA's scope) |
| Migration reversible / fresh-DB | n/a | no migration in this slice |
| Failure paths → honest error, no false success | ✅ | hook fails soft+loud (#4c); resolver fail-closed (self-test) |
| verify/merge gate untouched | ✅ | scope read (criterion 5) |

## Honest limits
- This verdict covers (a) the ownership-routing policy via the live CLI resolver + self-test,
  and (b) STATIC + behavioral-reasoning verification of the post-commit hook. The hook was
  deliberately NOT executed against a real push (no git/network mutation), per instruction.
- The full canonical-SDLC end-to-end loop (deploy lane, release cut, CI monitor, branch
  lifecycle exercised against a live remote) is verified by its own downstream slices, not
  here. This VERIFY scopes the two working-tree changes only.

## FAIL history
- none.

## Bug reports
- none.
