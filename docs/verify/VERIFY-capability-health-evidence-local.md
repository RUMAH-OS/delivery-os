---
slice: "capability-health-evidence — skills:check counts as wiring for skill-frontmatter+skill-route; per-capability EVIDENCE emitted"
verify_status: verified
author: "claude-opus main build session 2026-06-15"
verifier: "qa-test subagent (independent, 2026-06-15)"
date: 2026-06-15
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/capability-health.mjs --self-test"
---

# VERIFY — capability-health-evidence (skill tools read ALIVE with real, mutation-proof evidence)

## Verdict
**verify_status:** `verified`  ·  `capability-health.mjs --project ../rumah-admin` now reports skill-frontmatter + skill-route = ALIVE each citing the real ci.yml, experience-gate + learning-review = INERT citing INHERITED.json (exit 1, 2 inert). The ALIVE classification + evidence FOLLOW real wiring (mutation: remove the skills gate → both flip to INERT; restore → ALIVE). `--self-test` 6/6 exit 0. The 2 INERT are honestly unwired.

## Independence header  (Governance §3/§12)
- Verifier identity / invocation: qa-test subagent · distinct invocation 2026-06-15 · NOT the build session that authored `capability-health.mjs`.
- Author identity (code under test): claude-opus main build session 2026-06-15.
- [x] I assert: the verifier did **not** author the production code under test. All mutation was on temp mirrors under the OS tmp dir; the real `../rumah-admin/.github/workflows/ci.yml` and the real `templates/tools/capability-health.mjs` were never modified by me (git status: capability-health.mjs shows only the build's diff).
- [x] Independence was **real**: separate invocation, every command self-run.

## Execution evidence  (Governance §1)
> Machine-guard line (shared resources): no shared store/queue/port. All mutation done on disposable mirror dirs created via `mktemp -d`; baseline-on-mirror confirmed byte-identical classification to the real project before mutating; all mirrors removed at end.

| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `cd delivery-os && node templates/tools/capability-health.mjs --project ../rumah-admin` | 1 | see Admin table below — skill-frontmatter + skill-route ALIVE (ci.yml); experience-gate + learning-review INERT; `FAIL: 2 capability(ies) ... INERT ...: experience-gate, learning-review` |
| 2 | `node templates/tools/capability-health.mjs --self-test` | 0 | 6/6 PASS — `PASS: capability-health classifies all known states correctly — it measures reality.` |
| 3 | (mirror) baseline `--project <mirror-of-admin>` | 1 | identical 7-row classification to #1 (skill-frontmatter+skill-route ALIVE, 2 inert) |
| 4 | (mirror) delete the `skills gate` step (name+run) from mirror ci.yml; re-run | 1 | skill-frontmatter + skill-route flip to `[INERT]`; `FAIL: 4 capability(ies) ... INERT ...: experience-gate, skill-frontmatter, skill-route, learning-review` |
| 5 | (mirror) restore ci.yml; re-run | 1 | `[ALIVE] skill-frontmatter — wired: .github/workflows/ci.yml (skill-frontmatter)` · `[ALIVE] skill-route — wired: .github/workflows/ci.yml (skill-route)`; back to 2 inert |
| 6 | `grep -rnE 'experience:review|experience-gate|learning-review|learning:review' ../rumah-admin/{.github/workflows,.githooks,.claude/hooks}` | 1 | `(no experience-gate / learning-review tokens — genuinely INERT)` |
| 7 | `grep -nE 'skill-frontmatter|skill-route|skills:check|seam:check|lifecycle:check|workflow:check' ../rumah-admin/.github/workflows/ci.yml` | 0 | every ALIVE row's cited token present in the real ci.yml (lines 46–47, 49, 51, 53) |

### Admin capability table (verbatim, cmd #1)
```
capability-health · project=rumah-admin · 7 capabilities (evidence-backed)
  [ALIVE  ] seam-gate          — wired: .github/workflows/ci.yml (seam:check)
  [ALIVE  ] lifecycle-gate     — wired: .github/workflows/ci.yml (lifecycle:check)
  [ALIVE  ] workflow-gate      — wired: .github/workflows/ci.yml (workflow:check)
  [INERT  ] experience-gate    — inherited: rumah-admin/.claude/os/INHERITED.json · wired: NONE
  [ALIVE  ] skill-frontmatter  — wired: .github/workflows/ci.yml (skill-frontmatter)
  [ALIVE  ] skill-route        — wired: .github/workflows/ci.yml (skill-route)
  [INERT  ] learning-review    — inherited: rumah-admin/.claude/os/INHERITED.json · wired: NONE
FAIL: 2 capability(ies) inherited/present but INERT (nothing runs them): experience-gate, learning-review
```

## Acceptance criteria  (verbatim — each PASS/FAIL + evidence pointer)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 3 | skill-frontmatter + skill-route = ALIVE citing the wiring file; experience-gate + learning-review = INERT citing INHERITED.json; exit 1 (2 inert); cross-check evidence vs real ci.yml | live run against real Admin + grep of real ci.yml | #1, #7 | PASS |
| 4 | Evidence is real, not cosmetic: remove skills:check step on a mirror → flip to INERT; restore → ALIVE | mirror mutation + re-run | #3, #4, #5 | PASS |
| 5 | `--self-test` exit 0, 6/6 | validate-the-validator | #2 | PASS |
| 6 | The 2 INERT genuinely have no wiring token in Admin ci.yml/hooks | grep across all 3 auto-exec contexts | #6 | PASS |

## Surface statement  (anti-Slice-1.0)
- Real surface: the actual `capability-health.mjs` reading the real Admin's auto-executed contexts (.github/workflows, .githooks, .claude/hooks) + INHERITED.json, and the same logic re-run against a disposable mirror to prove evidence tracks wiring.
- [x] No criterion verified via a bypass: the mutation test changed real wiring text and observed the classification flip; honesty was checked by grepping all 3 auto-exec context dirs, not by reading code.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| skills:check is treated as wiring for skill-frontmatter + skill-route | Confirmed (#1, source WIRING map) | Blocker |
| ALIVE evidence cites the real wiring file; INERT cites INHERITED.json + "wired: NONE" | Confirmed (#1) | Blocker |
| ALIVE/INERT FOLLOWS real wiring (mutation-proof, not cosmetic) | Confirmed (#3–#5) | Blocker (load-bearing) |
| Validator still trustworthy after the evidence upgrade | Confirmed (#2, 6/6) | Blocker |
| experience-gate + learning-review honestly INERT (no token anywhere) | Confirmed (#6) | Should-fix |
| Evidence token cited for skill-frontmatter/skill-route is the step NAME, not `skills:check` | Confirmed (#7) — still a real token in the real file; classification correctly grounded | Safe-to-defer (cosmetic) |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green | ✅ | #1, #2 |
| validate-the-validator (self-test) green | ✅ | #2 |
| Mutation proves evidence follows reality | ✅ | #3–#5 |
| Honesty: no false-green INERT | ✅ | #6 |
| Dedicated commit + slice id | ⬜ | not committed (per instruction: do NOT commit) |
| CI green — machine-read at merge | ⬜ | not exercised by this local verify |
| Failure paths → honest error | ✅ | #1 exits 1 naming the inert capabilities |

## FAIL history
- none

## Bug reports
1. [Safe-to-defer / cosmetic] For skill-frontmatter and skill-route the evidence cites token `(skill-frontmatter)` / `(skill-route)` rather than `(skills:check)`. Cause: `wiredEvidence` returns the first WIRING token found in file text, and those tokens appear in the CI step's descriptive NAME ("skills gate (skill-frontmatter contract + skill-route self-consistency)"), which precedes the `run: npm run skills:check` line. The cited file + token are both genuinely present in the real ci.yml, so the ALIVE classification is correctly grounded and mutation-proof — purely a cosmetic question of WHICH true token is surfaced. Optional: prefer the `:check` run-token, or cite the run line. → author (informational, non-blocking).
